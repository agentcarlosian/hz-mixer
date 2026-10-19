import { SOUNDS, NOISES, BELLS, normalizeMix, audibleLayers, layerSettings } from './mix-state.mjs';
import { signalError, sessionSeconds } from './program.mjs';
import { toneGraph, outputGraph, bufferLayer, bellLayer, setLayerLevels } from './audio-graph.mjs';
import { generatorSpecs, studioRange } from './studio-state.mjs';

export function wavHeader(frames, sampleRate) {
  const bytes = new ArrayBuffer(44), view = new DataView(bytes);
  const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, 36 + frames * 4, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, frames * 4, true);
  return bytes;
}

export function pcm16(left, right, from = 0, count = left.length - from) {
  const bytes = new ArrayBuffer(count * 4), view = new DataView(bytes);
  const sample = (value) => { const x = Math.max(-1, Math.min(1, value)); return Math.round(x * (x < 0 ? 32768 : 32767)); };
  for (let i = 0; i < count; i++) { view.setInt16(i * 4, sample(left[from + i]), true); view.setInt16(i * 4 + 2, sample(right[from + i]), true); }
  return bytes;
}

export function wavError(mix, seconds, sampleRate) {
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 7200) return 'Export duration must be between 1 second and 2 hours.';
  if (![44100, 48000].includes(sampleRate)) return 'Choose 44.1 or 48 kHz.';
  const error = signalError(mix, sampleRate); if (error) return error;
  const audible = audibleLayers(mix);
  const nonzero = [...audible].some((id) => studioRange(mix, id + ':level', id === 'tone' ? mix.toneLevel : layerSettings(mix, id).level).max > 0);
  return mix.masterMuted || !mix.master || !nonzero ? 'Unmute and raise at least one audible layer and the master before exporting.' : '';
}

export async function renderWav(value, seconds, sampleRate, loadBuffer, onProgress, signal, chunkSeconds = 20, sink = null) {
  const error = wavError(normalizeMix(value), seconds, sampleRate); if (error) throw new Error(error);
  checkExportCancelled(signal);
  const frames = Math.round(seconds * sampleRate), parts = sink ? null : [wavHeader(frames, sampleRate)];
  if (sink) await sink.write(wavHeader(frames, sampleRate));
  for await (const { left, right, progress } of renderPcm(value, seconds, sampleRate, loadBuffer, onProgress, signal, chunkSeconds)) {
    const encoded = pcm16(left, right);
    if (sink) await sink.write(encoded); else parts.push(encoded);
    onProgress(progress, 'Rendering WAV');
  }
  checkExportCancelled(signal);
  return sink ? null : new Blob(parts, { type: 'audio/wav' });
}

export function checkExportCancelled(signal) {
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
}

// Detach this export without cancelling a download shared with live playback.
export function waitForExport(task, signal) {
  if (!signal) return Promise.resolve(task);
  return new Promise((resolve, reject) => {
    const finish = (callback, value) => { signal.removeEventListener('abort', abort); callback(value); };
    const abort = () => finish(reject, new DOMException('Export cancelled', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(task).then((value) => finish(resolve, value), (error) => finish(reject, error));
    if (signal.aborted) abort();
  });
}

export function blendRenderOverlap(channels, previous) {
  if (!previous) return;
  for (let channel = 0; channel < channels.length; channel++) {
    const data = channels[channel], tail = previous[channel], count = Math.min(data.length, tail.length);
    for (let i = 0; i < count; i++) {
      const weight = count > 1 ? .5 - .5 * Math.cos(Math.PI * i / (count - 1)) : 0;
      data[i] = tail[i] * (1 - weight) + data[i] * weight;
    }
  }
}

export async function* renderPcm(value, seconds, sampleRate, loadBuffer, onProgress, signal, chunkSeconds = 20) {
  const mix = normalizeMix(value);
  const error = wavError(mix, seconds, sampleRate); if (error) throw new Error(error);
  if (!Number.isFinite(chunkSeconds) || Math.round(chunkSeconds * sampleRate) < 1 || chunkSeconds > 30) throw new Error('Invalid render block size.');
  const cancelled = () => checkExportCancelled(signal);
  cancelled(); onProgress(0, 'Loading audio');
  const audible = audibleLayers(mix), buffers = new Map();
  for (const { id } of [...SOUNDS, ...NOISES, ...BELLS]) if (audible.has(id)) { cancelled(); buffers.set(id, await waitForExport(loadBuffer(id), signal)); }
  const frames = Math.round(seconds * sampleRate);
  const blockSize = Math.round(chunkSeconds * sampleRate);
  const blendFrames = generatorSpecs(mix).some((voice) => voice.enabled && audible.has(voice.id)) ? Math.min(blockSize, Math.round(sampleRate * .01)) : 0;
  let previous = null;
  for (let start = 0; start < frames; start += blockSize) {
    cancelled();
    const count = Math.min(blockSize, frames - start);
    // Warm the compressor; matching-time look-ahead tails smooth native oscillator restarts.
    const warm = Math.min(start, sampleRate * 3);
    const overlap = Math.min(blendFrames, frames - start - count);
    const from = (start - warm) / sampleRate, until = (start + count + overlap) / sampleRate;
    const context = new OfflineAudioContext(2, count + warm + overlap, sampleRate);
    const output = outputGraph(context, mix, context.destination, from, until, 0, seconds);
    const tone = toneGraph(context, mix, output.master, from, 0, until);
    const voices = new Map();
    for (const voice of generatorSpecs(mix)) if (voice.id !== 'tone' && voice.enabled) voices.set(voice.id, toneGraph(context, mix, output.master, from, 0, until, voice.id));
    const layers = new Map();
    for (const [id, buffer] of buffers) layers.set(id, mix.bells[id]
      ? bellLayer(context, buffer, output.master, mix.bells[id].interval, from, until, 0, seconds)
      : bufferLayer(context, buffer, output.master, from, 0, { mix, id, until }));
    setLayerLevels(context, mix, tone, layers, output.master, true, voices, { from, until, when: 0 });
    const rendered = await context.startRendering();
    cancelled();
    const channels = [0, 1].map((channel) => rendered.getChannelData(channel).subarray(warm, warm + count));
    blendRenderOverlap(channels, previous);
    previous = overlap ? [0, 1].map((channel) => rendered.getChannelData(channel).slice(warm + count)) : null;
    yield { left: channels[0], right: channels[1], progress: (start + count) / frames };
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  cancelled();
}

export function exportSeconds(mix) {
  return mix.automation.kind === 'sequence' ? sessionSeconds(mix) : mix.automation.kind === 'sweep' && mix.automation.sweep.repeat === 'once' ? mix.automation.sweep.seconds : sessionSeconds(mix) || 300;
}
