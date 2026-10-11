import { SOUNDS, NOISES, audibleLayers } from './mix-state.mjs';
import { beatCycles, scheduleRate, scheduleEnvelope, sessionSeconds, signalError } from './program.mjs';

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

function phasedSine(context, oscillator, cycles) {
  const phase = 2 * Math.PI * (cycles % 1);
  oscillator.setPeriodicWave(context.createPeriodicWave(new Float32Array([0, Math.sin(phase)]), new Float32Array([0, Math.cos(phase)]), { disableNormalization: true }));
}

function pulseWave(context, pulse, cycles) {
  const real = new Float32Array(129), imaginary = new Float32Array(129);
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

export function toneGraph(context, mix, destination, from = 0, when = context.currentTime, until = from + 3600) {
  const output = context.createGain(); output.gain.value = 0; output.connect(destination);
  const oscillators = [], carriers = [];
  const control = context.createConstantSource();
  scheduleRate(control.offset, mix, from, until, when);
  const cycles = beatCycles(mix, from);
  const merger = context.createChannelMerger(2); merger.connect(output);
  const addCarrier = (destinationNode, level, split = 0) => {
    const oscillator = context.createOscillator(); oscillator.frequency.value = mix.carrier;
    phasedSine(context, oscillator, mix.carrier * from + split * cycles);
    if (split) {
      const coefficient = context.createGain(); coefficient.gain.value = split;
      control.connect(coefficient).connect(oscillator.frequency);
    }
    const gain = context.createGain(); gain.gain.value = level;
    oscillator.connect(gain).connect(destinationNode);
    oscillators.push(oscillator); carriers.push(oscillator);
  };
  if (mix.mode === 'binaural') {
    for (const channel of [0, 1]) {
      const gain = context.createGain(); gain.connect(merger, 0, channel);
      addCarrier(gain, .5, channel ? .5 : -.5);
    }
  } else if (mix.mode !== 'off') {
    const mono = context.createGain(); mono.connect(merger, 0, 0); mono.connect(merger, 0, 1);
    if (mix.mode === 'monaural') { addCarrier(mono, .25, -.5); addCarrier(mono, .25, .5); }
    else {
      const pulse = pulseWave(context, mix.pulse, cycles); mono.gain.value = pulse.mean;
      addCarrier(mono, .5);
      const lfo = context.createOscillator(); lfo.frequency.value = 0; lfo.setPeriodicWave(pulse.wave);
      control.connect(lfo.frequency); lfo.connect(mono.gain); oscillators.push(lfo);
    }
  }
  control.start(when); oscillators.forEach((node) => node.start(when));
  return {
    output, control, mode: mix.mode,
    carrier(value) { carriers.forEach((node) => node.frequency.setTargetAtTime(value, context.currentTime, .025)); },
    stop(time = context.currentTime) {
      control.stop(time); oscillators.forEach((node) => node.stop(time));
      control.onended = () => { control.disconnect(); output.disconnect(); };
    },
  };
}

export function outputGraph(context, mix, destination, from = 0, until = from + 3600, when = context.currentTime, duration = sessionSeconds(mix)) {
  const master = context.createGain(); master.gain.value = mix.masterMuted ? 0 : mix.master / 100 * .8;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -14; compressor.knee.value = 12; compressor.ratio.value = 5; compressor.attack.value = .003; compressor.release.value = .2;
  const envelope = context.createGain(); scheduleEnvelope(envelope.gain, mix, from, until, when, duration);
  master.connect(compressor).connect(envelope).connect(destination);
  return { master, envelope, compressor };
}

export function bufferLayer(context, buffer, destination, offset, when = context.currentTime) {
  const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
  const gain = context.createGain(); gain.gain.value = 0;
  const pan = context.createStereoPanner(); source.connect(gain).connect(pan).connect(destination);
  source.start(when, ((offset % buffer.duration) + buffer.duration) % buffer.duration);
  return { source, gain, pan, stop(time = context.currentTime) { source.stop(time); source.onended = () => { source.disconnect(); gain.disconnect(); pan.disconnect(); }; } };
}

export function setLayerLevels(context, mix, tone, layers, master, instant = false) {
  const audible = audibleLayers(mix);
  const set = (parameter, value) => instant ? parameter.setValueAtTime(value, context.currentTime) : parameter.setTargetAtTime(value, context.currentTime, .025);
  set(master.gain, mix.masterMuted ? 0 : mix.master / 100 * .8);
  if (tone) set(tone.output.gain, audible.has('tone') && !signalError(mix) ? mix.toneLevel / 100 * .46 : 0);
  for (const { id } of [...SOUNDS, ...NOISES]) {
    const layer = layers.get(id); if (!layer?.source) continue;
    const config = mix.sounds[id] || mix.noise[id];
    set(layer.gain.gain, audible.has(id) ? config.level / 100 * (mix.sounds[id] ? .38 : .6) : 0);
    set(layer.pan.pan, config.pan / 100);
  }
}
