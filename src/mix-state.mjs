import { VOICE_IDS, defaultStudio, normalizeStudio, normalizeStageLanes, studioTargets, generatorSpecs } from './studio-state.mjs';

export const BEAT_MIN = .1, BEAT_MAX = 120, CARRIER_MIN = 1, CARRIER_MAX = 5000;
export const PULSE_HARMONICS = 128;

export const SOUNDS = [
  { id: 'cascade', name: 'Waterfall', detail: 'Small cascade', duration: '0:29', channels: 'Mono', icon: 'waterfall', color: 'blue' },
  { id: 'stream', name: 'Stream', detail: 'Mountain water', duration: '1:45', channels: 'Stereo', icon: 'stream-flow', color: 'teal' },
  { id: 'storm', name: 'Thunderstorm', detail: 'Rain and thunder', duration: '2:38', channels: 'Stereo', icon: 'thunderstorm', color: 'violet' },
  { id: 'waves', name: 'Sea waves', detail: 'Atlantic shore', duration: '2:47', channels: 'Stereo', icon: 'sea-waves', color: 'coral' },
  { id: 'campfire', name: 'Campfire', detail: 'Wood fire', duration: '0:13', channels: 'Stereo', icon: 'campfire', color: 'coral' },
  { id: 'window-rain', name: 'Window rain', detail: 'Rain against glass', duration: '0:11', channels: 'Stereo', icon: 'window-rain', color: 'blue' },
];

export const BELLS = [
  { id: 'bell-33', name: 'Singing Bowl I', detail: 'Tibetan bowl', duration: '0:11', channels: 'Stereo', icon: 'bell', color: 'teal', file: 'bell-33.wav' },
  { id: 'bell-37', name: 'Singing Bowl II', detail: 'Tibetan bowl', duration: '0:05', channels: 'Stereo', icon: 'bell', color: 'violet', file: 'bell-37.wav' },
];
export const RECORDINGS = [...SOUNDS, ...BELLS];
export function recordingPath(id) {
  const recording = RECORDINGS.find((item) => item.id === id);
  if (!recording) throw new Error('Unknown recording: ' + id);
  return 'assets/audio/' + (recording.file || recording.id + '.mp3');
}
export const layerSettings = (mix, id) => mix.sounds[id] || mix.noise[id] || mix.bells[id] || mix.studio?.voices.find((voice) => voice.id === id);

export const NOISES = [
  { id: 'white', name: 'White noise', detail: 'Broadband', icon: 'audio-lines', color: 'blue' },
  { id: 'pink', name: 'Pink noise', detail: 'Soft high frequencies', icon: 'noise-pink', color: 'pink' },
  { id: 'brown', name: 'Brown noise', detail: 'Low-frequency emphasis', icon: 'noise-brown', color: 'brown' },
];
export const STUDIO_SOURCES = [{ id: 'tone', name: 'Tone 1', kind: 'generator' }, ...VOICE_IDS.map((id, i) => ({ id, name: 'Tone ' + (i + 2), kind: 'generator' })), ...SOUNDS, ...NOISES];
export const STUDIO_TARGETS = studioTargets([...STUDIO_SOURCES, ...BELLS.map((bell) => ({ ...bell, kind: 'bell' }))]);
export const BANDS = [
  { id: 'delta', name: 'Delta', min: BEAT_MIN, max: 4 },
  { id: 'theta', name: 'Theta', min: 4, max: 8 },
  { id: 'alpha', name: 'Alpha', min: 8, max: 13 },
  { id: 'beta', name: 'Beta', min: 13, max: 30 },
  { id: 'gamma', name: 'Gamma', min: 30, max: BEAT_MAX + .01 },
];
export function bandFor(rate, mode = 'binaural') {
  return mode === 'off' ? 'nature' : BANDS.find((band) => rate >= band.min && rate < band.max)?.id || 'gamma';
}

function defaultStages() {
  return [{ type: 'hold', start: 10, end: 10, seconds: 120, curve: 'linear' }, { type: 'sweep', start: 10, end: 6, seconds: 480, curve: 'smooth' }, { type: 'hold', start: 6, end: 6, seconds: 900, curve: 'linear' }];
}

export function defaultMix() {
  return {
    mode: 'binaural', beat: 8, carrier: 200, toneLevel: 35, toneMuted: false, toneSolo: false,
    master: 55, masterMuted: false, duration: 1800,
    fades: { in: 3, out: 5 },
    pulse: { width: 46, softness: 35, depth: 100 },
    studio: defaultStudio(),
    automation: { kind: 'fixed', sweep: { start: 10, end: 6, seconds: 480, curve: 'smooth', repeat: 'once' }, stages: defaultStages() },
    noise: Object.fromEntries(NOISES.map(({ id }) => [id, { enabled: false, level: 15, pan: 0, muted: false, solo: false }])),
    bells: Object.fromEntries(BELLS.map(({ id }) => [id, { enabled: false, level: 35, pan: 0, muted: false, solo: false, interval: 60 }])),
    sounds: Object.fromEntries(SOUNDS.map(({ id }) => [id, {
      enabled: false, level: id === 'storm' ? 25 : 35, pan: 0, muted: false, solo: false,
    }])),
  };
}

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
function number(value, fallback, min, max, precision = 0) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Number(Math.max(min, Math.min(max, value)).toFixed(precision)) : fallback;
}
const boolean = (value, fallback) => typeof value === 'boolean' ? value : fallback;

export function normalizeMix(value) {
  const source = record(value);
  const mix = defaultMix();
  mix.studio = normalizeStudio(source.studio, STUDIO_SOURCES.map(({ id }) => id));
  if (['binaural', 'monaural', 'isochronic', 'off'].includes(source.mode)) mix.mode = source.mode;
  mix.beat = number(source.beat, mix.beat, BEAT_MIN, BEAT_MAX, 2);
  mix.carrier = number(source.carrier, mix.carrier, CARRIER_MIN, CARRIER_MAX);
  mix.toneLevel = number(source.toneLevel, mix.toneLevel, 0, 100);
  mix.master = number(source.master, mix.master, 0, 100);
  mix.duration = typeof source.duration === 'number' && Number.isFinite(source.duration) && (source.duration === 0 || source.duration >= 30) ? number(source.duration, mix.duration, 0, 7200) : mix.duration;
  for (const key of ['toneMuted', 'toneSolo', 'masterMuted']) mix[key] = boolean(source[key], mix[key]);
  for (const { id } of SOUNDS) {
    const input = record(record(source.sounds)[id]);
    const output = mix.sounds[id];
    for (const key of ['enabled', 'muted', 'solo']) output[key] = boolean(input[key], output[key]);
    output.level = number(input.level, output.level, 0, 100);
    output.pan = number(input.pan, output.pan, -100, 100);
    if (!output.enabled) output.solo = false;
  }
  for (const { id } of NOISES) {
    const input = record(record(source.noise)[id]);
    const output = mix.noise[id];
    for (const key of ['enabled', 'muted', 'solo']) output[key] = boolean(input[key], output[key]);
    output.level = number(input.level, output.level, 0, 100);
    output.pan = number(input.pan, output.pan, -100, 100);
    if (!output.enabled) output.solo = false;
  }
  for (const { id } of BELLS) {
    const input = record(record(source.bells)[id]), output = mix.bells[id];
    for (const key of ['enabled', 'muted', 'solo']) output[key] = boolean(input[key], output[key]);
    output.level = number(input.level, output.level, 0, 100);
    output.pan = number(input.pan, output.pan, -100, 100);
    output.interval = number(input.interval, output.interval, 15, 7200);
    if (!output.enabled) output.solo = false;
  }
  const fades = record(source.fades);
  mix.fades.in = number(fades.in, mix.fades.in, 0, 30, 1);
  mix.fades.out = number(fades.out, mix.fades.out, 0, 30, 1);
  const pulse = record(source.pulse);
  mix.pulse.width = number(pulse.width, mix.pulse.width, 10, 90);
  mix.pulse.softness = number(pulse.softness, mix.pulse.softness, 0, 100);
  mix.pulse.depth = number(pulse.depth, mix.pulse.depth, 0, 100);
  const automation = record(source.automation);
  if (['fixed', 'sweep', 'sequence'].includes(automation.kind)) mix.automation.kind = automation.kind;
  const sweep = record(automation.sweep);
  const outputSweep = mix.automation.sweep;
  outputSweep.start = number(sweep.start, outputSweep.start, BEAT_MIN, BEAT_MAX, 2);
  outputSweep.end = number(sweep.end, outputSweep.end, BEAT_MIN, BEAT_MAX, 2);
  outputSweep.seconds = number(sweep.seconds, outputSweep.seconds, 5, 7200);
  outputSweep.curve = sweep.curve === 'linear' ? 'linear' : 'smooth';
  outputSweep.repeat = sweep.repeat === 'pingpong' ? 'pingpong' : 'once';
  if (Array.isArray(automation.stages) && automation.stages.length) {
    let total = 0;
    mix.automation.stages = automation.stages.slice(0, 16).flatMap((raw) => {
      if (7200 - total < 5) return [];
      const stage = record(raw);
      const normalized = { type: stage.type === 'sweep' ? 'sweep' : 'hold', start: number(stage.start, mix.beat, BEAT_MIN, BEAT_MAX, 2), end: number(stage.end, mix.beat, BEAT_MIN, BEAT_MAX, 2), seconds: number(stage.seconds, 60, 5, Math.min(3600, 7200 - total)), curve: stage.curve === 'smooth' ? 'smooth' : 'linear' };
      if (normalized.type === 'hold') normalized.end = normalized.start;
      const lanes = normalizeStageLanes(stage.lanes, STUDIO_TARGETS);
      if (lanes.length) normalized.lanes = lanes;
      total += normalized.seconds;
      return [normalized];
    });
  }
  if (mix.mode === 'off') mix.toneSolo = false;
  return mix;
}

export function audibleLayers(mix) {
  const layers = [
    { id: 'tone', enabled: mix.mode !== 'off', muted: mix.toneMuted, solo: mix.toneSolo },
    ...generatorSpecs(mix).filter(({ id }) => id !== 'tone'),
    ...SOUNDS.map(({ id }) => ({ id, ...mix.sounds[id] })),
    ...NOISES.map(({ id }) => ({ id, ...mix.noise[id] })),
    ...BELLS.map(({ id }) => ({ id, ...mix.bells[id] })),
  ];
  const soloing = layers.some((layer) => layer.enabled && layer.solo);
  return new Set(layers.filter((layer) => layer.enabled && !layer.muted && (!soloing || layer.solo)).map((layer) => layer.id));
}

function preset(id, name, changes) {
  const base = defaultMix();
  const mix = normalizeMix({ ...base, ...changes, sounds: { ...base.sounds, ...changes.sounds } });
  return { id, name, band: bandFor(mix.beat, mix.mode), mix };
}

export const PRESETS = [
  preset('stream-8', 'Stream / 8 Hz', { sounds: { stream: { enabled: true } } }),
  preset('rain-6', 'Rain / 6 Hz', { mode: 'binaural', beat: 6, carrier: 180, toneLevel: 25, sounds: { stream: { enabled: false }, storm: { enabled: true, level: 40 } } }),
  preset('shore-10', 'Shore / 10 Hz', { mode: 'monaural', beat: 10, carrier: 240, toneLevel: 30, sounds: { stream: { enabled: false }, waves: { enabled: true, level: 45 } } }),
  preset('pulse-12', 'Cascade / 12 Hz', { mode: 'isochronic', beat: 12, carrier: 160, toneLevel: 25, sounds: { stream: { enabled: false }, cascade: { enabled: true, level: 40 } } }),
  preset('nature', 'Environment only', { mode: 'off', sounds: { stream: { enabled: true, level: 40, pan: -15 }, waves: { enabled: true, level: 25, pan: 15 } } }),
  preset('rain-2', 'Distant rain / 2 Hz', { beat: 2, carrier: 160, toneLevel: 18, sounds: { stream: { enabled: false }, storm: { enabled: true, level: 30, pan: -20 }, waves: { enabled: true, level: 10, pan: 20 } } }),
  preset('tide-4', 'Low tide / 4 Hz', { beat: 4, carrier: 180, toneLevel: 22, sounds: { stream: { enabled: false }, waves: { enabled: true, level: 40 } } }),
  preset('water-7-5', 'Open water / 7.5 Hz', { beat: 7.5, carrier: 220, toneLevel: 25, sounds: { stream: { enabled: true, level: 20, pan: -25 }, waves: { enabled: true, level: 35, pan: 25 } } }),
  preset('rain-10', 'Rain bed / 10 Hz', { beat: 10, carrier: 280, toneLevel: 20, sounds: { stream: { enabled: false }, storm: { enabled: true, level: 30 } } }),
  preset('stream-14', 'Mountain stream / 14 Hz', { mode: 'monaural', beat: 14, carrier: 300, toneLevel: 25, sounds: { stream: { enabled: true, level: 45 } } }),
  preset('current-18', 'Bright current / 18 Hz', { mode: 'monaural', beat: 18, carrier: 350, toneLevel: 22, sounds: { stream: { enabled: true, level: 15, pan: -15 }, cascade: { enabled: true, level: 30, pan: 15 } } }),
  preset('rain-20', 'Rain texture / 20 Hz', { mode: 'monaural', beat: 20, carrier: 400, toneLevel: 20, sounds: { stream: { enabled: false }, storm: { enabled: true, level: 35 } } }),
  preset('surf-6', 'Soft surf / 6 Hz', { mode: 'isochronic', beat: 6, carrier: 160, toneLevel: 15, sounds: { stream: { enabled: false }, waves: { enabled: true, level: 40 } } }),
  preset('water-16', 'Water pulse / 16 Hz', { mode: 'isochronic', beat: 16, carrier: 240, toneLevel: 18, sounds: { stream: { enabled: false }, cascade: { enabled: true, level: 40 } } }),
  preset('gamma-40', 'Gamma rhythm / 40 Hz', { mode: 'isochronic', beat: 40, carrier: 400, toneLevel: 15, sounds: { stream: { enabled: true, level: 20 } } }),
  preset('storm-only', 'Storm only', { mode: 'off', sounds: { stream: { enabled: false }, storm: { enabled: true, level: 45 } } }),
  preset('water-layers', 'Water layers', { mode: 'off', sounds: { stream: { enabled: true, level: 35, pan: -25 }, cascade: { enabled: true, level: 25, pan: 25 }, waves: { enabled: true, level: 15 } } }),
];

const bandRecipes = [
  ['delta-075', 'Delta / Pure 0.75 Hz', .75, 'binaural', 180, 'pure'],
  ['delta-150', 'Delta / Rain 1.50 Hz', 1.5, 'binaural', 160, 'storm'],
  ['delta-250', 'Delta / Surf 2.50 Hz', 2.5, 'monaural', 200, 'waves'],
  ['delta-350', 'Delta / Water pulse 3.50 Hz', 3.5, 'isochronic', 140, 'stream'],
  ['theta-450', 'Theta / Stream 4.50 Hz', 4.5, 'binaural', 200, 'stream'],
  ['theta-550', 'Theta / Rain 5.50 Hz', 5.5, 'monaural', 180, 'storm'],
  ['theta-650', 'Theta / Surf pulse 6.50 Hz', 6.5, 'isochronic', 160, 'waves'],
  ['theta-783', 'Theta / Pure 7.83 Hz', 7.83, 'binaural', 240, 'pure'],
  ['alpha-850', 'Alpha / Cascade 8.50 Hz', 8.5, 'binaural', 220, 'cascade'],
  ['alpha-950', 'Alpha / Shore 9.50 Hz', 9.5, 'monaural', 260, 'waves'],
  ['alpha-1050', 'Alpha / Stream pulse 10.50 Hz', 10.5, 'isochronic', 180, 'stream'],
  ['alpha-1250', 'Alpha / Pure 12.50 Hz', 12.5, 'binaural', 320, 'pure'],
  ['beta-1400', 'Beta / Stream 14 Hz', 14, 'binaural', 300, 'stream'],
  ['beta-1800', 'Beta / Rain 18 Hz', 18, 'monaural', 350, 'storm'],
  ['beta-2200', 'Beta / Cascade pulse 22 Hz', 22, 'isochronic', 240, 'cascade'],
  ['beta-2800', 'Beta / Pure 28 Hz', 28, 'binaural', 400, 'pure'],
  ['gamma-3000', 'Gamma / Stream pulse 30 Hz', 30, 'isochronic', 300, 'stream'],
  ['gamma-3200', 'Gamma / Shore 32 Hz', 32, 'monaural', 400, 'waves'],
  ['gamma-3500', 'Gamma / Pure 35 Hz', 35, 'binaural', 400, 'pure'],
  ['gamma-4000', 'Gamma / Rain pulse 40 Hz', 40, 'isochronic', 400, 'storm'],
];
for (const [id, name, beat, mode, carrier, environment] of bandRecipes) {
  const sounds = Object.fromEntries(SOUNDS.map(({ id: sound }) => [sound, { enabled: sound === environment, level: sound === 'storm' ? 30 : 35 }]));
  PRESETS.push(preset(id, name, { beat, mode, carrier, toneLevel: mode === 'isochronic' ? 18 : 25, sounds }));
}

const mixRecipes = [
  ['delta-embers-1', 'Embers & bowl / 1 Hz', {
    beat: 1, carrier: 180, toneLevel: 18,
    sounds: { campfire: { enabled: true, level: 32 } },
    bells: { 'bell-33': { enabled: true, level: 25, interval: 300 } },
  }],
  ['delta-brown-am-2', 'Brown AM bed / 2 Hz', {
    mode: 'monaural', beat: 2, carrier: 174, toneLevel: 16,
    noise: { brown: { enabled: true, level: 28 } },
    studio: { effects: { brown: { am: { enabled: true, depth: 30 } } } },
  }],
  ['theta-window-5', 'Window rain & bowl / 5 Hz', {
    beat: 5, carrier: 200,
    sounds: { 'window-rain': { enabled: true, level: 38 } },
    bells: { 'bell-37': { enabled: true, level: 24, interval: 60 } },
  }],
  ['theta-three-carriers', 'Three carriers / 7.83 Hz', {
    beat: 7.83, carrier: 174, toneLevel: 20,
    sounds: { waves: { enabled: true, level: 22 } },
    noise: { pink: { enabled: true, level: 12 } },
    studio: {
      voices: [{ id: 'voice-2', enabled: true, carrier: 348, level: 16 }, { id: 'voice-3', enabled: true, carrier: 522, level: 12 }],
      effects: { 'voice-2': { pitch: { mode: 'fm', rate: .12, depth: 1.5 } }, 'voice-3': { pitch: { mode: 'pm', rate: .07, depth: 6 } } },
    },
  }],
  ['alpha-campfire-10', 'Campfire & pink / 10 Hz', {
    mode: 'monaural', beat: 10, carrier: 285,
    sounds: { campfire: { enabled: true, level: 34 } }, noise: { pink: { enabled: true, level: 12 } },
  }],
  ['alpha-binaural-am-10', 'Binaural + AM / 10 Hz', {
    beat: 10, carrier: 220,
    sounds: { waves: { enabled: true, level: 30 } },
    studio: { effects: { tone: { am: { enabled: true, depth: 45 } } } },
  }],
  ['beta-window-pulse-16', 'Window pulse / 16 Hz', {
    mode: 'isochronic', beat: 16, carrier: 240, toneLevel: 16,
    pulse: { width: 35, softness: 75, depth: 85 },
    sounds: { 'window-rain': { enabled: true, level: 35 } },
  }],
  ['beta-two-rhythms', 'Two rhythms / 18 + 9 Hz', {
    mode: 'monaural', beat: 18, carrier: 360, toneLevel: 18,
    noise: { brown: { enabled: true, level: 18 } },
    studio: { voices: [{ id: 'voice-2', enabled: true, program: 'fixed', beat: 9, carrier: 220, level: 16 }] },
  }],
  ['gamma-pink-am-40', 'Pink AM / 40 Hz', {
    mode: 'monaural', beat: 40, carrier: 432, toneLevel: 14,
    noise: { pink: { enabled: true, level: 28 } },
    studio: { effects: { pink: { am: { enabled: true, depth: 30, channels: 'offset', rightPhase: 180 } } } },
  }],
  ['gamma-harmonic-pulse-60', 'Triangle pulse / 60 Hz', {
    mode: 'isochronic', beat: 60, carrier: 400, toneLevel: 14,
    pulse: { width: 35, softness: 80, depth: 85 },
    sounds: { waves: { enabled: true, level: 24 } }, studio: { timbre: { shape: 'triangle' } },
  }],
  ['sweep-embers-3-1', 'Embers sweep / 3 to 1 Hz', {
    beat: 3, carrier: 180, toneLevel: 18,
    sounds: { campfire: { enabled: true, level: 32 } }, bells: { 'bell-33': { enabled: true, level: 24, interval: 300 } },
    automation: { kind: 'sweep', sweep: { start: 3, end: 1, seconds: 900, curve: 'smooth', repeat: 'once' } },
    studio: { voices: [{ id: 'voice-2', enabled: true, mode: 'isochronic', carrier: 260, level: 12, pulse: { width: 30, softness: 75, depth: 85 } }] },
  }],
  ['sweep-rain-783-45', 'Rain dual sweep / 7.83 to 4.5 Hz', {
    beat: 7.83, carrier: 200,
    sounds: { 'window-rain': { enabled: true, level: 35 } }, noise: { pink: { enabled: true, level: 8 } },
    automation: { kind: 'sweep', sweep: { start: 7.83, end: 4.5, seconds: 900, curve: 'smooth', repeat: 'pingpong' } },
    studio: { voices: [{ id: 'voice-2', enabled: true, mode: 'isochronic', carrier: 300, level: 14, pulse: { width: 25, softness: 75, depth: 85 } }] },
  }],
  ['sweep-shore-8-12', 'Shore pendulum / 8 to 12 Hz', {
    mode: 'monaural', beat: 8, carrier: 260, toneLevel: 18,
    sounds: { waves: { enabled: true, level: 36 } },
    automation: { kind: 'sweep', sweep: { start: 8, end: 12, seconds: 300, curve: 'smooth', repeat: 'pingpong' } },
    studio: { effects: { waves: { am: { enabled: true, depth: 18 }, pan: { enabled: true, rate: .02, depth: 25 } } } },
  }],
  ['sweep-current-22-14', 'Current dual sweep / 22 to 14 Hz', {
    beat: 22, carrier: 320, toneLevel: 18, duration: 1200,
    sounds: { stream: { enabled: true, level: 30 } },
    automation: { kind: 'sweep', sweep: { start: 22, end: 14, seconds: 600, curve: 'smooth', repeat: 'once' } },
    studio: { voices: [{ id: 'voice-2', enabled: true, mode: 'isochronic', carrier: 440, level: 14, pulse: { width: 30, softness: 75, depth: 85 } }] },
  }],
  ['sweep-gamma-30-60', 'Rising pulse / 30 to 60 Hz', {
    mode: 'isochronic', beat: 30, carrier: 400, toneLevel: 14,
    pulse: { width: 30, softness: 75, depth: 85 }, noise: { pink: { enabled: true, level: 20 } },
    automation: { kind: 'sweep', sweep: { start: 30, end: 60, seconds: 600, curve: 'smooth', repeat: 'once' } },
  }],
  ['session-shore-12-45', 'Shore stages / 12 to 4.5 Hz', {
    beat: 12, carrier: 220, toneLevel: 18, sounds: { waves: { enabled: true, level: 32 } },
    studio: { voices: [{ id: 'voice-2', enabled: true, mode: 'isochronic', carrier: 330, level: 12, pulse: { width: 30, softness: 75, depth: 85 } }] },
    automation: { kind: 'sequence', stages: [
      { type: 'hold', start: 12, seconds: 120 },
      { type: 'sweep', start: 12, end: 8, seconds: 300, curve: 'smooth' },
      { type: 'hold', start: 8, seconds: 180 },
      { type: 'sweep', start: 8, end: 4.5, seconds: 600, curve: 'smooth' },
      { type: 'hold', start: 4.5, seconds: 600 },
    ] },
  }],
  ['session-current-embers', 'Current to embers / 18 to 6 Hz', {
    mode: 'monaural', beat: 18, carrier: 300, toneLevel: 18, duration: 1200,
    sounds: { stream: { enabled: true, level: 30 }, campfire: { enabled: true, level: 10 } },
    automation: { kind: 'sequence', stages: [
      { type: 'hold', start: 18, seconds: 120 },
      { type: 'sweep', start: 18, end: 10, seconds: 300, curve: 'smooth', lanes: [
        { target: 'stream:level', start: 30, end: 15, curve: 'smooth' }, { target: 'campfire:level', start: 10, end: 25, curve: 'smooth' },
      ] },
      { type: 'hold', start: 10, seconds: 180 },
      { type: 'sweep', start: 10, end: 6, seconds: 300, curve: 'smooth', lanes: [
        { target: 'stream:level', start: 15, end: 0, curve: 'smooth' }, { target: 'campfire:level', start: 25, end: 35, curve: 'smooth' },
      ] },
      { type: 'hold', start: 6, seconds: 300 },
    ] },
  }],
  ['session-bowl-water-6-3', 'Bowl & waterfall / 6 to 3 Hz', {
    beat: 6, carrier: 180, toneLevel: 18,
    sounds: { cascade: { enabled: true, level: 28 } }, noise: { pink: { enabled: true, level: 12 } },
    bells: { 'bell-37': { enabled: true, level: 25, interval: 180 } },
    automation: { kind: 'sequence', stages: [
      { type: 'hold', start: 6, seconds: 300 }, { type: 'sweep', start: 6, end: 3, seconds: 600, curve: 'smooth' }, { type: 'hold', start: 3, seconds: 900 },
    ] },
  }],
  ['ambience-campfire', 'Campfire only', { mode: 'off', toneLevel: 0, sounds: { campfire: { enabled: true, level: 42 } } }],
  ['ambience-window-brown', 'Window rain & brown noise', {
    mode: 'off', toneLevel: 0, sounds: { 'window-rain': { enabled: true, level: 38 } }, noise: { brown: { enabled: true, level: 20 } },
  }],
  ['ambience-stream-bowl', 'Stream & Singing Bowl I', {
    mode: 'off', toneLevel: 0, sounds: { stream: { enabled: true, level: 35 } }, bells: { 'bell-33': { enabled: true, level: 28, interval: 180 } },
  }],
  ['ambience-shore-bowl', 'Shore & Singing Bowl II', {
    mode: 'off', toneLevel: 0, sounds: { waves: { enabled: true, level: 35 } }, bells: { 'bell-37': { enabled: true, level: 26, interval: 300 } },
  }],
  ['ambience-rain-embers', 'Rain & embers', {
    mode: 'off', toneLevel: 0, sounds: { 'window-rain': { enabled: true, level: 34 }, campfire: { enabled: true, level: 25 } },
  }],
  ['ambience-white-drift', 'Filtered white drift', {
    mode: 'off', toneLevel: 0, noise: { white: { enabled: true, level: 30 } },
    studio: { effects: { white: { filter: { type: 'lowpass', frequency: 5000 }, pan: { enabled: true, rate: .03, depth: 35 } } } },
  }],
];
for (const [id, name, changes] of mixRecipes) {
  PRESETS.push(preset(id, name, { master: 50, toneLevel: 20, fades: { in: 5, out: 8 }, ...changes }));
}

export function normalizeLibrary(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.slice(0, 30).flatMap((entry) => {
    if (!entry || typeof entry.id !== 'string' || typeof entry.name !== 'string') return [];
    const id = entry.id.slice(0, 100);
    const name = entry.name.trim().slice(0, 40);
    if (!id || !name || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name, mix: normalizeMix(entry.mix) }];
  });
}
