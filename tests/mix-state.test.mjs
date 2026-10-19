import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMix, normalizeMix, normalizeLibrary, audibleLayers, bandFor, PRESETS, NOISES, BEAT_MIN, BEAT_MAX, CARRIER_MIN, CARRIER_MAX } from '../src/mix-state.mjs';

test('colored noise artwork matches its channel without changing stored audio state', () => {
  assert.equal(NOISES.find(({ id }) => id === 'pink').icon, 'noise-pink');
  assert.equal(NOISES.find(({ id }) => id === 'pink').color, 'pink');
  assert.equal(NOISES.find(({ id }) => id === 'brown').icon, 'noise-brown');
  assert.equal(NOISES.find(({ id }) => id === 'brown').color, 'brown');
  assert.equal(NOISES.find(({ id }) => id === 'white').icon, 'audio-lines');
  assert.deepEqual(normalizeMix(defaultMix()), defaultMix());
});

test('fresh and reset defaults are tone-only without discarding explicit saved channels', () => {
  const mix = defaultMix();
  assert.deepEqual([...audibleLayers(mix)], ['tone']);
  for (const group of [mix.sounds, mix.noise, mix.bells]) assert(Object.values(group).every((layer) => !layer.enabled && !layer.muted && !layer.solo));
  assert(mix.studio.voices.every((tone) => !tone.enabled));
  const saved = structuredClone(mix); saved.sounds.stream.enabled = true;
  const restored = normalizeMix(JSON.parse(JSON.stringify(saved)));
  assert(restored.sounds.stream.enabled, 'explicit saved Stream selection is preserved');
  assert(!defaultMix().sounds.stream.enabled, 'fresh calls do not inherit a restored selection');
});

test('solo isolates enabled layers, with mute taking precedence', () => {
  const mix = defaultMix();
  mix.sounds.stream.enabled = true;
  assert.deepEqual([...audibleLayers(mix)], ['tone', 'stream']);
  mix.sounds.stream.solo = true;
  assert.deepEqual([...audibleLayers(mix)], ['stream']);
  mix.toneSolo = true;
  assert.deepEqual([...audibleLayers(mix)], ['tone', 'stream']);
  mix.sounds.stream.muted = true;
  assert.deepEqual([...audibleLayers(mix)], ['tone']);
});

test('disabled solo channels cannot silence the rest of a restored mix', () => {
  const mix = defaultMix();
  mix.sounds.storm.solo = true;
  const restored = normalizeMix(mix);
  assert.equal(restored.sounds.storm.solo, false);
  assert.deepEqual([...audibleLayers(restored)], ['tone']);
});

test('stored settings cannot introduce invalid audio parameters or unknown sources', () => {
  const mix = normalizeMix({ mode: 'unknown', beat: 500, carrier: -30, master: NaN,
    duration: -10, sounds: { stream: { pan: -500, level: 500 }, remote: { url: 'https://example.com' } } });
  assert.equal(mix.beat, 120);
  assert.equal(mix.carrier, 1);
  assert.equal(mix.master, 55);
  assert.equal(mix.duration, 1800);
  assert.equal(mix.sounds.stream.pan, -100);
  assert.equal(mix.sounds.stream.level, 100);
  assert.equal(mix.sounds.remote, undefined);
  assert.deepEqual(normalizeMix(null), defaultMix());
});

test('saved mixes are independent snapshots and malformed library entries are discarded', () => {
  const source = defaultMix();
  const saved = normalizeLibrary([{ id: 'a', name: ' My mix ', mix: source }, null, { id: 'a', name: 'Duplicate' }, { id: 'b', name: '' }]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, 'My mix');
  source.sounds.stream.level = 99;
  assert.equal(saved[0].mix.sounds.stream.level, 35);
});

test('presets survive JSON persistence with their intended active sources', () => {
  for (const preset of PRESETS) assert.deepEqual(normalizeMix(JSON.parse(JSON.stringify(preset.mix))), preset.mix);
  const rain = PRESETS.find((preset) => preset.id === 'rain-6').mix;
  assert.deepEqual([...audibleLayers(PRESETS.find((preset) => preset.id === 'stream-8').mix)], ['tone', 'stream']);
  assert.deepEqual([...audibleLayers(rain)], ['tone', 'storm']);
  const nature = PRESETS.find((preset) => preset.id === 'nature').mix;
  assert.equal(PRESETS.find((preset) => preset.id === 'nature').name, 'Environment only');
  assert.deepEqual([...audibleLayers(nature)], ['stream', 'waves']);
});

test('the expanded preset library has unique names and usable mixes in every mode', () => {
  assert.equal(new Set(PRESETS.map((preset) => preset.id)).size, PRESETS.length);
  assert.equal(new Set(PRESETS.map((preset) => preset.name)).size, PRESETS.length);
  assert.equal(PRESETS.length, 61);
  for (const band of ['delta', 'theta', 'alpha', 'beta', 'gamma']) assert(PRESETS.filter((preset) => preset.band === band).length >= 4);
  for (const mode of ['binaural', 'monaural', 'isochronic', 'off']) assert(PRESETS.filter((preset) => preset.mix.mode === mode).length >= 3);
  for (const preset of PRESETS) {
    assert(audibleLayers(preset.mix).size > 0);
    assert(preset.mix.beat >= BEAT_MIN && preset.mix.beat <= BEAT_MAX);
    assert(preset.mix.carrier >= CARRIER_MIN && preset.mix.carrier <= CARRIER_MAX);
  }
});

test('hundredth-hertz beats and the expanded carrier range survive saving and reload', () => {
  for (const carrier of [1, 20, 2000, 5000]) {
    const mix = normalizeMix({ ...defaultMix(), beat: 7.83, carrier });
    const restored = normalizeLibrary(JSON.parse(JSON.stringify([{ id: 'precision', name: 'Precision mix', mix }])))[0].mix;
    assert.equal(restored.beat, 7.83);
    assert.equal(restored.carrier, carrier);
    assert.equal(normalizeMix({ ...restored, beat: 7.83000000001 }).beat, 7.83);
  }
  assert.equal(normalizeMix({ ...defaultMix(), carrier: 6000 }).carrier, 5000);
});

test('expanded frequency endpoints and program fields survive normalization and saved libraries', () => {
  for (const beat of [.1, .11, 119.99, 120]) for (const carrier of [1, 5000]) {
    const mix = defaultMix(); mix.beat = beat; mix.carrier = carrier;
    mix.automation.sweep.start = .1; mix.automation.sweep.end = 120;
    mix.automation.stages[1].start = 120; mix.automation.stages[1].end = .1;
    const saved = normalizeLibrary(JSON.parse(JSON.stringify([{ id: 'wide', name: 'Wide', mix }])))[0].mix;
    assert.deepEqual(saved, mix);
  }
  assert.equal(normalizeMix({ beat: 0 }).beat, .1);
  assert.equal(normalizeMix({ beat: 121 }).beat, 120);
  assert.equal(bandFor(.1), 'delta'); assert.equal(bandFor(120), 'gamma');
});
