export const VOICE_IDS = ['voice-2', 'voice-3'];
export const CARRIER_BOOKMARKS = [174, 200, 250, 285, 300, 396, 400, 417, 432, 528, 639, 741, 852, 963];
export const STUDIO_HARMONICS = 64;
const sRecord = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const sNumber = (value, fallback, min, max, decimals = 2) => typeof value === 'number' && Number.isFinite(value) ? Number(Math.min(max, Math.max(min, value)).toFixed(decimals)) : fallback;
const sChoice = (value, choices, fallback) => choices.includes(value) ? value : fallback;
const sBoolean = (value, fallback) => typeof value === 'boolean' ? value : fallback;

export function defaultTimbre() { return { shape: 'sine', partials: [25, 12, 6] }; }
export function normalizeTimbre(value) {
  const input = sRecord(value);
  return { shape: sChoice(input.shape, ['sine', 'triangle', 'square', 'sawtooth', 'harmonic'], 'sine'), partials: [0, 1, 2].map((i) => sNumber(input.partials?.[i], [25, 12, 6][i], 0, 100)) };
}
export function defaultEffects() {
  return {
    am: { enabled: false, shape: 'sine', sync: true, rate: 8, depth: 50, width: 50, softness: 50, phase: 0, channels: 'linked', rightRate: 8, rightPhase: 180 },
    pan: { enabled: false, rate: .1, depth: 60, phase: 0 },
    pitch: { mode: 'off', rate: .2, depth: 5 },
    filter: { type: 'off', frequency: 1000, q: .707 },
  };
}
export function normalizeEffects(value, generator = false) {
  const input = sRecord(value), output = defaultEffects();
  for (const [name, limits] of Object.entries({ am: { rate: [.1, 120], depth: [0, 100], width: [10, 90], softness: [0, 100], phase: [0, 360], rightRate: [.1, 120], rightPhase: [0, 360] }, pan: { rate: [.01, 120], depth: [0, 100], phase: [0, 360] }, pitch: { rate: [.01, 120], depth: [0, 500] }, filter: { frequency: [20, 18000], q: [.1, 30] } })) {
    const source = sRecord(input[name]);
    for (const [key, [min, max]] of Object.entries(limits)) output[name][key] = sNumber(source[key], output[name][key], min, max, key === 'q' ? 3 : 2);
  }
  output.am.enabled = sBoolean(input.am?.enabled, false); output.am.sync = sBoolean(input.am?.sync, true);
  output.pan.enabled = sBoolean(input.pan?.enabled, false);
  output.am.shape = sChoice(input.am?.shape, ['sine', 'triangle', 'square', 'pulse'], 'sine');
  output.am.channels = sChoice(input.am?.channels, ['linked', 'offset', 'independent'], 'linked');
  output.pitch.mode = generator ? sChoice(input.pitch?.mode, ['off', 'fm', 'pm'], 'off') : 'off';
  if (output.pitch.mode === 'pm') output.pitch.depth = Math.min(180, output.pitch.depth);
  output.filter.type = sChoice(input.filter?.type, ['off', 'lowpass', 'highpass', 'bandpass', 'notch'], 'off');
  return output;
}
export function defaultStudio() {
  return { timbre: defaultTimbre(), pan: 0, effects: {}, voices: VOICE_IDS.map((id, i) => ({ id, enabled: false, mode: 'binaural', program: 'follow', beat: 8, carrier: 300 + i * 100, level: 25, pan: 0, muted: false, solo: false, timbre: defaultTimbre(), pulse: { width: 46, softness: 35, depth: 100 }, sweep: { start: 10, end: 6, seconds: 480, curve: 'smooth', repeat: 'once' } })) };
}
export function normalizeStudio(value, sourceIds) {
  const input = sRecord(value), output = defaultStudio();
  output.timbre = normalizeTimbre(input.timbre); output.pan = sNumber(input.pan, 0, -100, 100);
  for (const id of sourceIds) if (input.effects && Object.hasOwn(input.effects, id)) {
    const effects = normalizeEffects(input.effects[id], id === 'tone' || VOICE_IDS.includes(id));
    if (JSON.stringify(effects) !== JSON.stringify(defaultEffects())) output.effects[id] = effects;
  }
  for (const voice of output.voices) {
    const source = Array.isArray(input.voices) ? sRecord(input.voices.find((entry) => entry?.id === voice.id)) : {};
    for (const key of ['enabled', 'muted', 'solo']) voice[key] = sBoolean(source[key], voice[key]);
    if (!voice.enabled) voice.solo = false;
    voice.mode = sChoice(source.mode, ['binaural', 'monaural', 'isochronic'], voice.mode);
    voice.program = sChoice(source.program, ['follow', 'fixed', 'sweep'], 'follow');
    voice.beat = sNumber(source.beat, voice.beat, .1, 120); voice.carrier = sNumber(source.carrier, voice.carrier, 1, 5000, 0);
    voice.level = sNumber(source.level, voice.level, 0, 100); voice.pan = sNumber(source.pan, 0, -100, 100);
    voice.timbre = normalizeTimbre(source.timbre);
    for (const key of ['width', 'softness', 'depth']) voice.pulse[key] = sNumber(source.pulse?.[key], voice.pulse[key], key === 'width' ? 10 : 0, key === 'width' ? 90 : 100);
    for (const key of ['start', 'end']) voice.sweep[key] = sNumber(source.sweep?.[key], voice.sweep[key], .1, 120);
    voice.sweep.seconds = sNumber(source.sweep?.seconds, 480, 5, 7200, 0);
    voice.sweep.curve = sChoice(source.sweep?.curve, ['linear', 'smooth'], 'smooth'); voice.sweep.repeat = sChoice(source.sweep?.repeat, ['once', 'pingpong'], 'once');
  }
  return output;
}
export function effectsFor(mix, id) { return mix.studio?.effects[id] || defaultEffects(); }
export function generatorSpecs(mix) {
  const studio = mix.studio || defaultStudio();
  return [{ id: 'tone', enabled: mix.mode !== 'off', mode: mix.mode, program: 'follow', beat: mix.beat, carrier: mix.carrier, level: mix.toneLevel, pan: studio.pan, muted: mix.toneMuted, solo: mix.toneSolo, timbre: studio.timbre, pulse: mix.pulse }, ...studio.voices];
}
export function studioTargets(sources) {
  return sources.flatMap(({ id, name, kind }) => [
    { key: id + ':level', label: name + ' / Level', min: 0, max: 100, step: .1 },
    ...(kind === 'bell' ? [] : [{ key: id + ':pan', label: name + ' / Balance', min: -100, max: 100, step: 1 }, { key: id + ':amDepth', label: name + ' / AM depth', min: 0, max: 100, step: .1 }, { key: id + ':filterFrequency', label: name + ' / Filter Hz', min: 20, max: 18000, step: 1 }]),
    ...(kind === 'generator' ? [{ key: id + ':carrier', label: name + ' / Carrier Hz', min: 1, max: 5000, step: 1 }] : []),
  ]);
}
export function normalizeStageLanes(value, targets) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).slice(0, 16).flatMap((entry) => {
    const source = sRecord(entry), spec = targets.find((target) => target.key === source.target);
    if (!spec || seen.has(source.target)) return [];
    seen.add(source.target);
    return [{ target: source.target, start: sNumber(source.start, spec.min, spec.min, spec.max), end: sNumber(source.end, spec.min, spec.min, spec.max), curve: sChoice(source.curve, ['linear', 'smooth'], 'linear') }];
  });
}
export function studioBaseValue(mix, target) {
  const [id, parameter] = target.split(':');
  const generator = generatorSpecs(mix).find((voice) => voice.id === id);
  const layer = generator || mix.sounds[id] || mix.noise[id] || mix.bells[id];
  if (parameter === 'level' || parameter === 'carrier' || parameter === 'pan') return layer?.[parameter] || 0;
  const effects = effectsFor(mix, id);
  return parameter === 'amDepth' ? effects.am.depth : effects.filter.frequency;
}
export function studioRange(mix, target, base) {
  const values = [base];
  if (mix.automation.kind === 'sequence') for (const stage of mix.automation.stages) for (const lane of stage.lanes || []) if (lane.target === target) values.push(lane.start, lane.end);
  return { min: Math.min(...values), max: Math.max(...values) };
}
export function timbreCoefficients(timbre) {
  const output = new Float32Array(9); output[1] = 1;
  if (timbre.shape === 'harmonic') timbre.partials.forEach((value, i) => { output[i + 2] = value / 100; });
  else for (let i = 2; i < output.length; i++) {
    if (timbre.shape === 'square' && i % 2) output[i] = 1 / i;
    if (timbre.shape === 'triangle' && i % 2) output[i] = (i % 4 === 1 ? 1 : -1) / (i * i);
    if (timbre.shape === 'sawtooth') output[i] = (i % 2 ? 1 : -1) / i;
  }
  const total = output.reduce((sum, value) => sum + Math.abs(value), 0);
  return output.map((value) => value / total);
}
export function modulationValue(phase, am) {
  const p = ((phase % 1) + 1) % 1;
  if (am.shape === 'sine') return .5 + .5 * Math.cos(p * Math.PI * 2);
  if (am.shape === 'triangle') return Math.abs(p * 2 - 1);
  const width = am.width / 100;
  if (am.shape === 'square') return p < width ? 1 : 0;
  const edge = width * (.02 + .43 * am.softness / 100), smooth = (x) => .5 - .5 * Math.cos(Math.PI * x);
  return p < edge ? smooth(p / edge) : p < width - edge ? 1 : p < width ? smooth((width - p) / edge) : 0;
}
const modulationCache = new Map();
export function modulationCoefficients(am) {
  const key = [am.shape, am.width, am.softness].join(':');
  if (modulationCache.has(key)) return modulationCache.get(key);
  const count = 1024, real = new Float32Array(STUDIO_HARMONICS + 1), imaginary = new Float32Array(STUDIO_HARMONICS + 1);
  if (am.shape === 'sine') { real[1] = .5; const result = { real, imaginary, mean: .5 }; modulationCache.set(key, result); return result; }
  const samples = Array.from({ length: count }, (_, i) => modulationValue(i / count, am));
  const mean = samples.reduce((sum, value) => sum + value, 0) / count;
  for (let harmonic = 1; harmonic <= STUDIO_HARMONICS; harmonic++) {
    // Fejer weighting keeps the reconstructed unit envelope bounded at sharp edges.
    const weight = 1 - harmonic / (STUDIO_HARMONICS + 1);
    for (let i = 0; i < count; i++) { const angle = 2 * Math.PI * harmonic * i / count; real[harmonic] += samples[i] * Math.cos(angle) * 2 / count * weight; imaginary[harmonic] += samples[i] * Math.sin(angle) * 2 / count * weight; }
  }
  const result = { real, imaginary, mean };
  if (modulationCache.size > 64) modulationCache.clear();
  modulationCache.set(key, result); return result;
}
export function amLevelFactor(am) {
  const { real, imaginary, mean } = modulationCoefficients(am), depth = am.depth / 100;
  let energy = (1 - depth * (1 - mean)) ** 2;
  for (let i = 1; i < real.length; i++) energy += .5 * depth ** 2 * (real[i] ** 2 + imaginary[i] ** 2);
  return Math.sqrt(energy);
}
