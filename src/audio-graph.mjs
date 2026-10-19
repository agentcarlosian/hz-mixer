import { SOUNDS, NOISES, BELLS, PULSE_HARMONICS, audibleLayers, layerSettings } from './mix-state.mjs';
import { beatCycles, scheduleRate, scheduleEnvelope, sessionSeconds, signalError } from './program.mjs';
import { generatorSpecs, effectsFor, timbreCoefficients } from './studio-state.mjs';
import { sourceProgram, studioIntegral, hasStudioLane, studioSchedule } from './studio-program.mjs';
import { studioEffectsGraph } from './effects-graph.mjs';

export function pulseValue(phase, pulse) {
  const width = pulse.width / 100;
  const edge = width * (.02 + .43 * pulse.softness / 100);
  const smooth = (x) => .5 - .5 * Math.cos(Math.PI * x);
  const p = ((phase % 1) + 1) % 1;
  const value = p < edge ? smooth(p / edge) : p < width - edge ? 1 : p < width ? smooth((width - p) / edge) : 0;
  return 1 - pulse.depth / 100 * (1 - value);
}

export function crossfadeData(channels, sampleRate, seconds = 1.5) {
  const n = channels[0].length;
  const overlap = Math.max(1, Math.min(Math.round(seconds * sampleRate), Math.floor(n / 4)));
  const result = channels.map((input) => {
    const output = input.slice(overlap);
    const body = n - 2 * overlap;
    for (let i = 0; i < overlap; i++) {
      const p = i / Math.max(1, overlap - 1);
      output[body + i] = input[n - overlap + i] * Math.cos(p * Math.PI / 2) + input[i] * Math.sin(p * Math.PI / 2);
    }
    return output;
  });
  let peak = 0;
  for (const channel of result) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  if (peak > .95) for (const channel of result) for (let i = 0; i < channel.length; i++) channel[i] *= .95 / peak;
  return result;
}

export function loopBuffer(context, input, seconds = 1.5) {
  const channels = crossfadeData(Array.from({ length: input.numberOfChannels }, (_, i) => input.getChannelData(i)), input.sampleRate, seconds);
  const output = context.createBuffer(channels.length, channels[0].length, input.sampleRate);
  channels.forEach((values, i) => output.copyToChannel(values, i));
  return output;
}

export function noiseData(kind, sampleRate, seconds = 10) {
  let seed = { white: 173, pink: 641, brown: 997 }[kind];
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296 * 2 - 1; };
  const output = new Float32Array(Math.round(sampleRate * seconds));
  const rows = new Float64Array(12);
  for (let i = 0; i < rows.length; i++) rows[i] = random();
  let brown = 0, energy = 0;
  for (let i = 0; i < output.length; i++) {
    const white = random();
    if (kind === 'white') output[i] = white;
    else if (kind === 'brown') { brown = (brown + .02 * white) / 1.02; output[i] = brown; }
    else {
      let index = 0, counter = i + 1;
      while ((counter & 1) === 0 && index < rows.length - 1) { index++; counter >>>= 1; }
      rows[index] = random();
      output[i] = (rows.reduce((a, b) => a + b, 0) + white) / 13;
    }
    energy += output[i] * output[i];
  }
  const gain = .16 / Math.sqrt(energy / output.length);
  for (let i = 0; i < output.length; i++) output[i] = Math.max(-.9, Math.min(.9, output[i] * gain));
  return output;
}

export function noiseBuffer(context, kind) {
  const data = noiseData(kind, context.sampleRate);
  const buffer = context.createBuffer(1, data.length, context.sampleRate);
  buffer.copyToChannel(data, 0);
  return loopBuffer(context, buffer, .02);
}

function phasedSine(context, oscillator, cycles, timbre = null) {
  const phase = 2 * Math.PI * (cycles % 1);
  if (timbre && timbre.shape !== 'sine') {
    const weights = timbreCoefficients(timbre), real = new Float32Array(weights.length), imaginary = new Float32Array(weights.length);
    for (let i = 1; i < weights.length; i++) { real[i] = weights[i] * Math.sin(i * phase); imaginary[i] = weights[i] * Math.cos(i * phase); }
    oscillator.setPeriodicWave(context.createPeriodicWave(real, imaginary, { disableNormalization: true })); return;
  }
  oscillator.setPeriodicWave(context.createPeriodicWave(new Float32Array([0, Math.sin(phase)]), new Float32Array([0, Math.cos(phase)]), { disableNormalization: true }));
}

function pulseWave(context, pulse, cycles) {
  const real = new Float32Array(PULSE_HARMONICS + 1), imaginary = new Float32Array(PULSE_HARMONICS + 1);
  let mean = 0;
  const count = 1024;
  const samples = Array.from({ length: count }, (_, i) => pulseValue(i / count, pulse));
  for (const value of samples) mean += value / count;
  for (let harmonic = 1; harmonic < real.length; harmonic++) {
    let a = 0, b = 0;
    for (let i = 0; i < count; i++) {
      const angle = 2 * Math.PI * harmonic * i / count;
      a += samples[i] * Math.cos(angle) * 2 / count;
      b += samples[i] * Math.sin(angle) * 2 / count;
    }
    const phase = 2 * Math.PI * harmonic * (cycles % 1);
    real[harmonic] = a * Math.cos(phase) + b * Math.sin(phase);
    imaginary[harmonic] = b * Math.cos(phase) - a * Math.sin(phase);
  }
  return { mean, wave: context.createPeriodicWave(real, imaginary, { disableNormalization: true }) };
}

export function toneGraph(context, mix, destination, from = 0, when = context.currentTime, until = from + 3600, id = 'tone') {
  const voice = generatorSpecs(mix).find((item) => item.id === id), program = sourceProgram(mix, id), profile = effectsFor(mix, id);
  const output = context.createGain(); output.gain.value = 0; output.connect(destination);
  const oscillators = [], carriers = [];
  const control = context.createConstantSource();
  scheduleRate(control.offset, program, from, until, when);
  const cycles = beatCycles(program, from);
  const merger = context.createChannelMerger(2);
  const effects = studioEffectsGraph(context, mix, id, merger, output, from, until, when, null, true, voice.pan);
  const pitch = profile.pitch;
  const pitchCycles = (time) => pitch.mode === 'fm' ? pitch.depth / (2 * Math.PI * pitch.rate) * (1 - Math.cos(2 * Math.PI * pitch.rate * time)) : pitch.mode === 'pm' ? pitch.depth / 360 * Math.sin(2 * Math.PI * pitch.rate * time) : 0;
  let pitchGain = null;
  if (pitch.mode !== 'off' && pitch.depth) {
    const lfo = context.createOscillator(); lfo.frequency.value = pitch.rate;
    phasedSine(context, lfo, pitch.rate * from + (pitch.mode === 'pm' ? .25 : 0));
    pitchGain = context.createGain(); pitchGain.gain.value = pitch.mode === 'pm' ? pitch.depth / 360 * 2 * Math.PI * pitch.rate : pitch.depth;
    lfo.connect(pitchGain); oscillators.push(lfo);
  }
  const addCarrier = (destinationNode, level, split = 0) => {
    const oscillator = context.createOscillator();
    studioSchedule(oscillator.frequency, mix, id + ':carrier', voice.carrier, from, until, when);
    phasedSine(context, oscillator, studioIntegral(mix, id + ':carrier', voice.carrier, from) + split * cycles + pitchCycles(from), voice.timbre);
    if (pitchGain) pitchGain.connect(oscillator.frequency);
    if (split) {
      const coefficient = context.createGain(); coefficient.gain.value = split;
      control.connect(coefficient).connect(oscillator.frequency);
    }
    const gain = context.createGain(); gain.gain.value = level;
    oscillator.connect(gain).connect(destinationNode);
    oscillators.push(oscillator); carriers.push(oscillator);
  };
  if (voice.mode === 'binaural') {
    for (const channel of [0, 1]) {
      const gain = context.createGain(); gain.connect(merger, 0, channel);
      addCarrier(gain, .5, channel ? .5 : -.5);
    }
  } else if (voice.mode !== 'off') {
    const mono = context.createGain(); mono.connect(merger, 0, 0); mono.connect(merger, 0, 1);
    if (voice.mode === 'monaural') { addCarrier(mono, .25, -.5); addCarrier(mono, .25, .5); }
    else {
      const pulse = pulseWave(context, voice.pulse, cycles); mono.gain.value = pulse.mean;
      addCarrier(mono, .5);
      const lfo = context.createOscillator(); lfo.frequency.value = 0; lfo.setPeriodicWave(pulse.wave);
      control.connect(lfo.frequency); lfo.connect(mono.gain); oscillators.push(lfo);
    }
  }
  control.start(when); oscillators.forEach((node) => node.start(when));
  return {
    output, control, mode: voice.mode, effects,
    carrier(value) { carriers.forEach((node) => node.frequency.setTargetAtTime(value, context.currentTime, .025)); },
    stop(time = context.currentTime) {
      control.stop(time); oscillators.forEach((node) => node.stop(time));
      effects.stop(time);
      control.onended = () => { control.disconnect(); output.disconnect(); effects.disconnect(); };
    },
  };
}

export function outputGraph(context, mix, destination, from = 0, until = from + 3600, when = context.currentTime, duration = sessionSeconds(mix)) {
  const master = context.createGain(); master.gain.value = mix.masterMuted ? 0 : mix.master / 100 * .8;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -14; compressor.knee.value = 12; compressor.ratio.value = 5; compressor.attack.value = .003; compressor.release.value = .2;
  const envelope = context.createGain(); scheduleEnvelope(envelope.gain, mix, from, until, when, duration);
  // Keep native compressor processing through silent gaps between bell strikes.
  const silentInput = context.createConstantSource(); silentInput.offset.value = 0;
  silentInput.connect(compressor); silentInput.start(when);
  master.connect(compressor).connect(envelope).connect(destination);
  return { master, envelope, compressor, silentInput };
}

export function bufferLayer(context, buffer, destination, offset, when = context.currentTime, studio = null) {
  const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
  const gain = context.createGain(); gain.gain.value = 0;
  const pan = context.createStereoPanner(); gain.connect(pan).connect(destination);
  const effects = studio ? studioEffectsGraph(context, studio.mix, studio.id, source, gain, offset, studio.until, when, pan) : null;
  if (!effects) source.connect(gain);
  const sourceOffset = studio?.sourceOffset ?? offset;
  source.start(when, ((sourceOffset % buffer.duration) + buffer.duration) % buffer.duration);
  return { source, gain, pan, effects, sourcePosition() { return sourceOffset + context.currentTime - when; }, stop(time = context.currentTime) { source.stop(time); effects?.stop(time); source.onended = () => { source.disconnect(); gain.disconnect(); pan.disconnect(); effects?.disconnect(); }; } };
}

export function* bellEvents(from, until, interval, duration, end = Infinity) {
  if (!Number.isFinite(interval) || interval < 15 || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(from) || !Number.isFinite(until) || from < 0) throw new Error('Invalid bell schedule.');
  if (from >= end) return;
  const first = Math.max(0, Math.floor((from - duration) / interval) + 1);
  for (let index = first; index * interval < Math.min(until, end); index++) {
    const time = index * interval;
    yield { time, offset: Math.max(0, from - time) };
  }
}

export function bellLayer(context, buffer, destination, interval, from, until, when = context.currentTime, end = Infinity, initialStrike = false) {
  const gain = context.createGain(); gain.gain.value = 0;
  const pan = context.createStereoPanner(); gain.connect(pan).connect(destination);
  const sources = new Set();
  const schedule = ({ time, offset, whole = false }) => {
    offset = whole ? 0 : Math.max(offset, from + context.currentTime - when - time);
    if (offset >= buffer.duration) return;
    const source = context.createBufferSource(); source.buffer = buffer;
    source.connect(gain); sources.add(source);
    source.onended = () => { source.disconnect(); sources.delete(source); };
    source.start(Math.max(context.currentTime, when + time - from), offset);
  };
  const fullStart = initialStrike && from < Math.min(interval, end);
  if (fullStart) schedule({ time: 0, offset: 0, whole: true });
  for (const event of bellEvents(from, until, interval, buffer.duration, end)) if (!fullStart || event.time !== 0) schedule(event);
  let scheduledUntil = until;
  return { gain, pan, get until() { return scheduledUntil; }, extend(nextUntil) {
    if (nextUntil <= scheduledUntil) return;
    const start = Math.max(scheduledUntil, from + context.currentTime - when);
    for (const event of bellEvents(start, nextUntil, interval, buffer.duration, end)) if (event.time >= scheduledUntil) schedule(event);
    scheduledUntil = nextUntil;
  }, stop(time = context.currentTime) {
    for (const source of sources) source.stop(time);
    if (time <= context.currentTime || !sources.size) { gain.disconnect(); pan.disconnect(); }
    else for (const source of sources) source.onended = () => {
      source.disconnect(); sources.delete(source);
      if (!sources.size) { gain.disconnect(); pan.disconnect(); }
    };
  } };
}

export function setLayerLevels(context, mix, tone, layers, master, instant = false, voices = new Map(), timing = null) {
  const audible = audibleLayers(mix);
  const set = (parameter, value) => instant ? parameter.setValueAtTime(value, context.currentTime) : parameter.setTargetAtTime(value, context.currentTime, .025);
  const clock = timing || { from: 0, until: sessionSeconds(mix) || 3600, when: context.currentTime };
  const automate = (parameter, id, key, value, coefficient, enabled) => {
    if (hasStudioLane(mix, id + ':' + key)) {
      parameter.cancelScheduledValues(context.currentTime);
      if (enabled) studioSchedule(parameter, mix, id + ':' + key, value, clock.from, clock.until, clock.when, coefficient / 100);
      else set(parameter, 0);
    } else set(parameter, enabled ? value / 100 * coefficient : 0);
  };
  const generators = generatorSpecs(mix), trim = 1 / Math.max(1, generators.filter((voice) => voice.enabled && audible.has(voice.id)).length);
  set(master.gain, mix.masterMuted ? 0 : mix.master / 100 * .8);
  for (const voice of generators) {
    const graph = voice.id === 'tone' ? tone : voices.get(voice.id); if (!graph) continue;
    if (signalError(mix, context.sampleRate)) {
      graph.output.gain.cancelScheduledValues(context.currentTime);
      graph.output.gain.setValueAtTime(0, context.currentTime);
    } else automate(graph.output.gain, voice.id, 'level', voice.level, .46 * trim, audible.has(voice.id));
    graph.effects?.setPan?.(voice.pan);
  }
  for (const { id } of [...SOUNDS, ...NOISES, ...BELLS]) {
    const layer = layers.get(id); if (!layer?.gain) continue;
    const config = layerSettings(mix, id);
    automate(layer.gain.gain, id, 'level', config.level, mix.noise[id] ? .6 : .38, audible.has(id));
    automate(layer.pan.pan, id, 'pan', config.pan, 1, true);
  }
}
