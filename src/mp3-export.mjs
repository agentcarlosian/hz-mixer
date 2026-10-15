import { normalizeMix } from './mix-state.mjs';
import { renderPcm, wavError, checkExportCancelled } from './wav-export.mjs';
import { loadMp3Encoder } from './resources.js';

export const MP3_BITRATES = [128, 192, 256, 320];

export function mp3Error(mix, seconds, sampleRate, bitrate) {
  return wavError(mix, seconds, sampleRate) || (MP3_BITRATES.includes(bitrate) ? '' : 'Choose a supported MP3 bitrate.');
}

export function planarPcm16(samples) {
  return Int16Array.from(samples, (value) => {
    const bounded = Math.max(-1, Math.min(1, value));
    return Math.round(bounded * (bounded < 0 ? 32768 : 32767));
  });
}

export async function renderMp3(value, seconds, sampleRate, bitrate, loadBuffer, onProgress, signal, chunkSeconds = 20, sink = null) {
  const mix = normalizeMix(value), error = mp3Error(mix, seconds, sampleRate, bitrate);
  if (error) throw new Error(error);
  checkExportCancelled(signal); onProgress(0, 'Loading MP3 encoder');
  const Mp3Encoder = await loadMp3Encoder();
  checkExportCancelled(signal);
  // One stereo encoder spans every render block; never downmix binaural channels.
  const encoder = new Mp3Encoder(2, sampleRate, bitrate), parts = sink ? null : [];
  const write = async (bytes) => { if (bytes.length) { if (sink) await sink.write(bytes); else parts.push(bytes); } };
  let completed = 0;
  for await (const { left, right, progress } of renderPcm(mix, seconds, sampleRate, loadBuffer, onProgress, signal, chunkSeconds)) {
    const l = planarPcm16(left), r = planarPcm16(right);
    // Yield after small batches so progress and cancellation remain responsive.
    for (let offset = 0; offset < l.length; offset += 1152 * 16) {
      checkExportCancelled(signal);
      const end = Math.min(l.length, offset + 1152 * 16);
      await write(encoder.encodeBuffer(l.subarray(offset, end), r.subarray(offset, end)));
      onProgress(completed + (progress - completed) * end / l.length, 'Encoding MP3');
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    completed = progress;
  }
  checkExportCancelled(signal); await write(encoder.flush()); checkExportCancelled(signal);
  onProgress(1, 'MP3 complete');
  return sink ? null : new Blob(parts, { type: 'audio/mpeg' });
}
