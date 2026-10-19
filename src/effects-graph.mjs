import { effectsFor, modulationCoefficients } from './studio-state.mjs';
import { beatCycles, scheduleRate } from './program.mjs';
import { sourceProgram, hasStudioLane, studioSchedule } from './studio-program.mjs';

function effectWave(context, real, imaginary, cycles) {
  const a = new Float32Array(real.length), b = new Float32Array(real.length);
  for (let i = 1; i < real.length; i++) { const angle = 2 * Math.PI * i * (cycles % 1); a[i] = real[i] * Math.cos(angle) + imaginary[i] * Math.sin(angle); b[i] = imaginary[i] * Math.cos(angle) - real[i] * Math.sin(angle); }
  return context.createPeriodicWave(a, b, { disableNormalization: true });
}

export function studioEffectsGraph(context, mix, id, input, destination, from, until, when, panNode = null, preserveEars = false, balance = 0) {
  const profile = effectsFor(mix, id), sources = [], nodes = [];
  const keep = (node) => { nodes.push(node); return node; };
  const constant = (value, target) => { const source = context.createConstantSource(); source.offset.value = value; source.connect(target); source.start(when); sources.push(source); return source; };
  const oscillate = (rate, phase, target, amplitude = 1) => {
    const source = context.createOscillator(), gain = keep(context.createGain()); source.frequency.value = rate;
    source.setPeriodicWave(effectWave(context, Float32Array.of(0, 1), Float32Array.of(0, 0), rate * from + phase / 360));
    gain.gain.value = amplitude; source.connect(gain).connect(target); source.start(when); sources.push(source); return source;
  };
  let tail = input;
  if (profile.filter.type !== 'off') {
    const filter = keep(context.createBiquadFilter()); filter.type = profile.filter.type; filter.Q.value = profile.filter.q;
    studioSchedule(filter.frequency, mix, id + ':filterFrequency', profile.filter.frequency, from, until, when);
    tail.connect(filter); tail = filter;
  }
  const addAM = (channel, phase, independent) => {
    const gain = keep(context.createGain()), depth = keep(context.createGain()); gain.gain.value = 1;
    studioSchedule(depth.gain, mix, id + ':amDepth', profile.am.depth, from, until, when, .01);
    const coefficients = modulationCoefficients(profile.am), source = context.createOscillator();
    const program = sourceProgram(mix, id), rate = independent ? profile.am.rightRate : profile.am.rate;
    const linked = profile.am.sync && !independent;
    const cycles = linked ? beatCycles(program, from) : rate * from;
    source.setPeriodicWave(effectWave(context, coefficients.real, coefficients.imaginary, cycles + phase / 360));
    if (linked) scheduleRate(source.frequency, program, from, until, when); else source.frequency.value = rate;
    source.connect(depth).connect(gain.gain); constant(coefficients.mean - 1, depth);
    source.start(when); sources.push(source);
    if (channel) channel.connect(gain);
    return gain;
  };
  if (profile.am.enabled) {
    if (profile.am.channels === 'linked') tail = addAM(tail, profile.am.phase, false);
    else {
      const spread = keep(context.createGain()); spread.channelCount = 2; spread.channelCountMode = 'explicit'; spread.channelInterpretation = 'speakers';
      const split = keep(context.createChannelSplitter(2)), merge = keep(context.createChannelMerger(2)); tail.connect(spread).connect(split);
      for (const channel of [0, 1]) { const gain = addAM(null, profile.am.phase + (channel ? profile.am.rightPhase : 0), channel === 1 && profile.am.channels === 'independent'); split.connect(gain, channel); gain.connect(merge, 0, channel); }
      tail = merge;
    }
  }
  let setPan = null;
  if (preserveEars && (balance !== 0 || profile.pan.enabled || hasStudioLane(mix, id + ':pan'))) {
    const split = keep(context.createChannelSplitter(2)), merge = keep(context.createChannelMerger(2)); tail.connect(split);
    const center = context.createConstantSource(); sources.push(center);
    studioSchedule(center.offset, mix, id + ':pan', balance, from, until, when, .01); center.start(when);
    const sum = keep(context.createGain()); center.connect(sum);
    if (profile.pan.enabled) oscillate(profile.pan.rate, profile.pan.phase, sum, profile.pan.depth / 100);
    for (const channel of [0, 1]) {
      const shape = keep(context.createWaveShaper()), gain = keep(context.createGain()); gain.gain.value = 0;
      shape.curve = Float32Array.from({ length: 2049 }, (_, i) => { const p = i / 1024 - 1; return channel ? 1 + Math.min(p, 0) : 1 - Math.max(p, 0); });
      sum.connect(shape).connect(gain.gain); split.connect(gain, channel); gain.connect(merge, 0, channel);
    }
    tail = merge;
    setPan = (value) => { if (!hasStudioLane(mix, id + ':pan')) center.offset.setTargetAtTime(value / 100, context.currentTime, .025); };
  } else if (panNode && profile.pan.enabled) oscillate(profile.pan.rate, profile.pan.phase, panNode.pan, profile.pan.depth / 100);
  tail.connect(destination);
  return { setPan, stop(time = context.currentTime) { for (const source of sources) source.stop(time); }, disconnect() { for (const source of sources) source.disconnect(); for (const node of nodes) node.disconnect(); } };
}
