import { PULSE_HARMONICS, SOUNDS, NOISES } from './mix-state.mjs';
import { generatorSpecs, effectsFor, studioRange, timbreCoefficients, STUDIO_HARMONICS } from './studio-state.mjs';

export function sessionSeconds(mix) {
  return mix.automation.kind === 'sequence' ? mix.automation.stages.reduce((sum, stage) => sum + stage.seconds, 0) : mix.duration;
}

export function curveValue(start, end, progress, curve = 'linear') {
  const p = Math.max(0, Math.min(1, progress));
  const weight = curve === 'smooth' ? p * p * (3 - 2 * p) : p;
  return start + (end - start) * weight;
}

export function programAt(mix, elapsed) {
  const time = Math.max(0, elapsed);
  const automation = mix.automation;
  if (automation.kind === 'fixed') return { rate: mix.beat, progress: 0, stage: -1, label: 'Fixed rate' };
  if (automation.kind === 'sweep') {
    const sweep = automation.sweep;
    const cycle = Math.floor(time / sweep.seconds);
    const pingpong = sweep.repeat === 'pingpong';
    const progress = pingpong ? (time % sweep.seconds) / sweep.seconds : Math.min(1, time / sweep.seconds);
    const backwards = pingpong && cycle % 2 === 1;
    return {
      rate: curveValue(backwards ? sweep.end : sweep.start, backwards ? sweep.start : sweep.end, progress, sweep.curve),
      progress, stage: 0, label: !pingpong && progress === 1 ? 'Holding end rate' : backwards ? 'Return sweep' : 'Sweep',
    };
  }
  let startTime = 0;
  for (let i = 0; i < automation.stages.length; i++) {
    const stage = automation.stages[i];
    if (time < startTime + stage.seconds || i === automation.stages.length - 1) {
      const progress = Math.min(1, (time - startTime) / stage.seconds);
      return {
        rate: stage.type === 'hold' ? stage.start : curveValue(stage.start, stage.end, progress, stage.curve),
        progress, stage: i, label: 'Stage ' + (i + 1) + ' / ' + (stage.type === 'hold' ? 'Hold' : 'Sweep'),
      };
    }
    startTime += stage.seconds;
  }
}

export function rateSegments(mix, from, until) {
  const segments = [];
  if (until <= from) return segments;
  const automation = mix.automation;
  const add = (startTime, endTime, start, end, curve) => {
    const lo = Math.max(from, startTime);
    const hi = Math.min(until, endTime);
    if (hi > lo) segments.push({ from: lo, until: hi, start, end, curve, phaseStart: (lo - startTime) / (endTime - startTime), phaseEnd: (hi - startTime) / (endTime - startTime) });
  };
  if (automation.kind === 'fixed') add(from, until, mix.beat, mix.beat, 'linear');
  else if (automation.kind === 'sweep') {
    const sweep = automation.sweep;
    if (sweep.repeat === 'pingpong') {
      for (let cycle = Math.floor(from / sweep.seconds); cycle * sweep.seconds < until; cycle++) {
        const back = cycle % 2 === 1;
        add(cycle * sweep.seconds, (cycle + 1) * sweep.seconds, back ? sweep.end : sweep.start, back ? sweep.start : sweep.end, sweep.curve);
      }
    } else {
      add(0, sweep.seconds, sweep.start, sweep.end, sweep.curve);
      if (until > sweep.seconds) add(Math.max(from, sweep.seconds), until, sweep.end, sweep.end, 'linear');
    }
  } else {
    let time = 0;
    for (const stage of automation.stages) {
      add(time, time + stage.seconds, stage.start, stage.type === 'hold' ? stage.start : stage.end, stage.curve);
      time += stage.seconds;
    }
    if (until > time) {
      const last = automation.stages.at(-1);
      const value = last.type === 'hold' ? last.start : last.end;
      add(Math.max(from, time), until, value, value, 'linear');
    }
  }
  return segments;
}

export function scheduleRate(parameter, mix, from, until, contextStart = 0) {
  parameter.setValueAtTime(programAt(mix, from).rate, contextStart);
  for (const segment of rateSegments(mix, from, until)) {
    const when = contextStart + segment.from - from;
    const length = segment.until - segment.from;
    const first = curveValue(segment.start, segment.end, segment.phaseStart, segment.curve);
    const last = curveValue(segment.start, segment.end, segment.phaseEnd, segment.curve);
    if (first === last) parameter.setValueAtTime(first, when);
    else if (segment.curve === 'linear') {
      parameter.setValueAtTime(first, when);
      parameter.linearRampToValueAtTime(last, when + length);
    } else {
      const points = segmentPoints(segment);
      parameter.setValueAtTime(points[0].value, when);
      for (const point of points.slice(1)) parameter.linearRampToValueAtTime(point.value, contextStart + point.time - from);
    }
  }
}

// A fixed global grid keeps partial renders and resumed sweeps phase-aligned.
function segmentPoints(segment) {
  const full = (segment.until - segment.from) / (segment.phaseEnd - segment.phaseStart);
  const value = (phase) => {
    if (segment.curve !== 'smooth') return curveValue(segment.start, segment.end, phase);
    const lo = Math.floor(phase * 256) / 256;
    const hi = Math.min(1, lo + 1 / 256);
    return curveValue(curveValue(segment.start, segment.end, lo, 'smooth'), curveValue(segment.start, segment.end, hi, 'smooth'), (phase - lo) * 256);
  };
  const phases = [segment.phaseStart];
  if (segment.curve === 'smooth') for (let i = Math.floor(segment.phaseStart * 256) + 1; i / 256 < segment.phaseEnd; i++) phases.push(i / 256);
  phases.push(segment.phaseEnd);
  return phases.map((phase) => ({ time: segment.from + (phase - segment.phaseStart) * full, value: value(phase) }));
}

export function beatCycles(mix, time) {
  let cycles = 0;
  for (const segment of rateSegments(mix, 0, time)) {
    const points = segmentPoints(segment);
    for (let i = 1; i < points.length; i++) cycles += (points[i].time - points[i - 1].time) * (points[i].value + points[i - 1].value) / 2;
  }
  return cycles;
}

export function envelopeAt(mix, time, duration = sessionSeconds(mix)) {
  const fadeIn = Math.min(mix.fades.in, duration ? duration / 2 : mix.fades.in);
  const fadeOut = Math.min(mix.fades.out, duration ? duration / 2 : mix.fades.out);
  if (duration && time >= duration) return 0;
  const start = fadeIn ? Math.min(1, Math.max(0, time) / fadeIn) : 1;
  const end = duration && fadeOut ? Math.min(1, Math.max(0, duration - time) / fadeOut) : 1;
  return Math.min(start, end);
}

export function scheduleEnvelope(parameter, mix, from, until, contextStart = 0, duration = sessionSeconds(mix)) {
  const fadeIn = Math.min(mix.fades.in, duration ? duration / 2 : mix.fades.in);
  const fadeOut = Math.min(mix.fades.out, duration ? duration / 2 : mix.fades.out);
  const points = [from, until, fadeIn, duration - fadeOut, duration].filter((time) => time >= from && time <= until && time >= 0);
  const ordered = [...new Set(points)].sort((a, b) => a - b);
  parameter.setValueAtTime(envelopeAt(mix, from, duration), contextStart);
  for (const time of ordered.slice(1)) {
    const value = envelopeAt(mix, time, duration), when = contextStart + time - from;
    if (duration && !fadeOut && time === duration) parameter.setValueAtTime(value, when);
    else parameter.linearRampToValueAtTime(value, when);
  }
}

export function signalError(mix, sampleRate) {
  const rates = mix.automation.kind === 'fixed' ? [mix.beat] : mix.automation.kind === 'sweep' ? [mix.automation.sweep.start, mix.automation.sweep.end] : mix.automation.stages.flatMap((stage) => [stage.start, stage.type === 'hold' ? stage.start : stage.end]);
  for (const voice of generatorSpecs(mix).filter((item) => item.enabled)) {
    const maximum = Math.max(...(voice.program === 'follow' ? rates : voice.program === 'sweep' ? [voice.sweep.start, voice.sweep.end] : [voice.beat]));
    const carrier = studioRange(mix, voice.id + ':carrier', voice.carrier), profile = effectsFor(mix, voice.id), pitch = profile.pitch;
    const deviation = pitch.mode === 'fm' ? pitch.depth : pitch.mode === 'pm' ? pitch.depth / 360 * Math.PI * 2 * pitch.rate : 0;
    const prefix = voice.id === 'tone' ? '' : voice.id.replace('voice-', 'Tone ') + ': ';
    const split = ['binaural', 'monaural'].includes(voice.mode) ? maximum / 2 : 0;
    if (carrier.min <= split) return prefix + 'For this two-tone rate, raise the carrier above ' + split.toFixed(2) + ' Hz so both tones have a positive frequency.';
    if (carrier.min - split - deviation <= 0) return prefix + 'Raise the carrier or reduce pitch modulation depth to keep a positive frequency.';
    if (sampleRate !== undefined) {
      if (!Number.isFinite(sampleRate) || sampleRate <= 0) return 'The audio sample rate is unavailable.';
      const weights = timbreCoefficients(voice.timbre); let harmonic = 1;
      weights.forEach((value, index) => { if (value) harmonic = index; });
      const amRate = Math.max(profile.am.sync ? maximum : profile.am.rate, profile.am.channels === 'independent' ? profile.am.rightRate : 0);
      const amBudget = profile.am.enabled ? amRate * (profile.am.shape === 'sine' ? 1 : STUDIO_HARMONICS) : 0;
      const panBudget = profile.pan.enabled ? profile.pan.rate * STUDIO_HARMONICS : 0;
      const highest = harmonic * (carrier.max + split + deviation + (pitch.mode === 'off' ? 0 : pitch.rate)) + (voice.mode === 'isochronic' ? maximum * PULSE_HARMONICS : 0) + amBudget + panBudget;
      if (highest >= sampleRate / 2) return prefix + 'These tone settings exceed the ' + (sampleRate / 1000).toFixed(1) + ' kHz audio sample rate. Lower the carrier, rate, harmonics or modulation depth.';
    }
  }
  if (sampleRate !== undefined && Number.isFinite(sampleRate)) {
    const active = [...generatorSpecs(mix).filter((voice) => voice.enabled).map((voice) => voice.id), ...[...SOUNDS, ...NOISES].filter(({ id }) => (mix.sounds[id] || mix.noise[id]).enabled).map(({ id }) => id)];
    for (const id of active) {
      const filter = effectsFor(mix, id).filter;
      if (filter.type !== 'off' && studioRange(mix, id + ':filterFrequency', filter.frequency).max >= sampleRate / 2) return 'Filter frequency exceeds this audio sample rate. Lower the filter cutoff.';
    }
  }
  return '';
}
