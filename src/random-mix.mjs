import { SOUNDS, NOISES, BELLS, defaultMix, normalizeMix } from './mix-state.mjs';
import { signalError } from './program.mjs';

export function randomMix(value, { advanced = false, sampleRate = 32000, random = Math.random } = {}) {
  const current = normalizeMix(value), mix = defaultMix();
  const choose = (values) => values[Math.floor(random() * values.length)];
  const between = (min, max, precision = 0) => Number((min + random() * (max - min)).toFixed(precision));
  const carriers = [120, 174, 200, 240, 285, 320, 396, 432, 528];
  const rate = () => { const [min, max] = choose([[.5, 3.9], [4, 7.9], [8, 12.9], [13, 29], [30, 80]]); return between(min, max, 2); };
  const pulse = () => ({ width: between(25, 60), softness: between(55, 90), depth: between(70, 100) });
  mix.master = current.master; mix.masterMuted = current.masterMuted;
  mix.duration = current.duration; mix.fades = { ...current.fades };
  mix.mode = choose(['binaural', 'monaural', 'isochronic']);
  mix.beat = rate(); mix.carrier = choose(carriers); mix.toneLevel = between(15, 28); mix.pulse = pulse();
  mix.automation = structuredClone(current.automation);
  for (const stage of mix.automation.stages) delete stage.lanes;
  if (mix.automation.kind === 'sweep') {
    mix.automation.sweep.start = mix.beat; mix.automation.sweep.end = rate();
  } else if (mix.automation.kind === 'sequence') {
    let start = mix.beat;
    mix.automation.stages = current.automation.stages.map((stage) => {
      const end = stage.type === 'hold' ? start : rate();
      const next = { type: stage.type, start, end, seconds: stage.seconds, curve: stage.curve };
      start = end;
      return next;
    });
  }
  const remaining = SOUNDS.map(({ id }) => id), environmentCount = choose([0, 1, 1, 2]);
  for (let i = 0; i < environmentCount; i++) {
    const id = remaining.splice(Math.floor(random() * remaining.length), 1)[0];
    Object.assign(mix.sounds[id], { enabled: true, level: between(22, 38), pan: between(-25, 25) });
  }
  if (random() < .4) Object.assign(mix.noise[choose(NOISES).id], { enabled: true, level: between(10, 22), pan: between(-15, 15) });
  if (random() < .2) Object.assign(mix.bells[choose(BELLS).id], { enabled: true, level: between(18, 28), interval: choose([60, 120, 180, 300, 600]) });
  if (advanced) {
    mix.studio.timbre.shape = choose(['sine', 'sine', 'triangle', 'harmonic']);
    mix.studio.timbre.partials = [between(5, 20), between(0, 10), between(0, 5)];
    for (const voice of mix.studio.voices.slice(0, choose([0, 1, 1, 2]))) {
      Object.assign(voice, { enabled: true, mode: choose(['binaural', 'monaural', 'isochronic']), carrier: choose(carriers), level: between(12, 22), pulse: pulse() });
    }
    const sources = ['tone', ...mix.studio.voices.filter((voice) => voice.enabled).map(({ id }) => id),
      ...[...SOUNDS, ...NOISES].filter(({ id }) => (mix.sounds[id] || mix.noise[id]).enabled).map(({ id }) => id)];
    for (const id of sources) {
      const effects = {};
      if (random() < .4) effects.am = { enabled: true, shape: choose(['sine', 'sine', 'triangle', 'pulse']), depth: between(15, 55), width: between(35, 65), softness: between(65, 95), channels: choose(['linked', 'linked', 'offset']), rightPhase: 180 };
      if (random() < .2) effects.pan = { enabled: true, rate: between(.02, .1, 2), depth: between(10, 35) };
      if (id === 'tone' || id.startsWith('voice-')) {
        if (random() < .2) effects.pitch = { mode: choose(['fm', 'pm']), rate: between(.05, .4, 2), depth: between(1, 3) };
      } else if (random() < .35) effects.filter = { type: 'lowpass', frequency: between(800, Math.min(5000, Math.max(8000, sampleRate) * .4)), q: .707 };
      if (Object.keys(effects).length) mix.studio.effects[id] = effects;
    }
  }
  const result = normalizeMix(mix), rateLimit = Number.isFinite(sampleRate) && sampleRate >= 8000 ? sampleRate : 32000;
  // Keep a roll usable when pulse harmonics and optional effects exceed a device's budget.
  if (signalError(result, rateLimit)) {
    result.studio.timbre.shape = 'sine';
    for (const id of ['tone', ...result.studio.voices.map((voice) => voice.id)]) delete result.studio.effects[id];
    if (signalError(result, rateLimit)) {
      if (result.mode === 'isochronic') result.mode = 'monaural';
      for (const voice of result.studio.voices) if (voice.mode === 'isochronic') voice.mode = 'monaural';
    }
  }
  return normalizeMix(result);
}
