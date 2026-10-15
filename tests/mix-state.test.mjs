import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMix, normalizeMix, normalizeLibrary, audibleLayers, PRESETS, NOISES } from '../src/mix-state.mjs';

test('colored noise artwork matches its channel without changing stored audio state', () => {
  assert.equal(NOISES.find(({ id }) => id === 'pink').icon, 'noise-pink');
  assert.equal(NOISES.find(({ id }) => id === 'pink').color, 'pink');
  assert.equal(NOISES.find(({ id }) => id === 'brown').icon, 'noise-brown');
  assert.equal(NOISES.find(({ id }) => id === 'brown').color, 'brown');
  assert.equal(NOISES.find(({ id }) => id === 'white').icon, 'audio-lines');
  assert.deepEqual(normalizeMix(defaultMix()), defaultMix());
});

test('solo isolates enabled layers, with mute taking precedence', () => {
  const mix = defaultMix();
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
  assert.deepEqual([...audibleLayers(restored)], ['tone', 'stream']);
});

test('stored settings cannot introduce invalid audio parameters or unknown sources', () => {
  const mix = normalizeMix({ mode: 'unknown', beat: 500, carrier: -30, master: NaN,
    duration: -10, sounds: { stream: { pan: -500, level: 500 }, remote: { url: 'https://example.com' } } });
  assert.equal(mix.beat, 40);
  assert.equal(mix.carrier, 20);
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
  assert.deepEqual([...audibleLayers(rain)], ['tone', 'storm']);
  const nature = PRESETS.find((preset) => preset.id === 'nature').mix;
  assert.deepEqual([...audibleLayers(nature)], ['stream', 'waves']);
});

test('the expanded preset library has unique names and usable mixes in every mode', () => {
  assert.equal(new Set(PRESETS.map((preset) => preset.id)).size, PRESETS.length);
  assert.equal(new Set(PRESETS.map((preset) => preset.name)).size, PRESETS.length);
  assert.equal(PRESETS.length, 37);
  for (const band of ['delta', 'theta', 'alpha', 'beta', 'gamma']) assert(PRESETS.filter((preset) => preset.band === band).length >= 4);
  for (const mode of ['binaural', 'monaural', 'isochronic', 'off']) assert(PRESETS.filter((preset) => preset.mix.mode === mode).length >= 3);
  for (const preset of PRESETS) {
    assert(audibleLayers(preset.mix).size > 0);
    assert(preset.mix.beat >= 0.5 && preset.mix.beat <= 40);
    assert(preset.mix.carrier >= 20 && preset.mix.carrier <= 2000);
  }
});

test('hundredth-hertz beats and the expanded carrier range survive saving and reload', () => {
  for (const carrier of [20, 2000]) {
    const mix = normalizeMix({ ...defaultMix(), beat: 7.83, carrier });
    const restored = normalizeLibrary(JSON.parse(JSON.stringify([{ id: 'precision', name: 'Precision mix', mix }])))[0].mix;
    assert.equal(restored.beat, 7.83);
    assert.equal(restored.carrier, carrier);
    assert.equal(normalizeMix({ ...restored, beat: 7.83000000001 }).beat, 7.83);
  }
  assert.equal(normalizeMix({ ...defaultMix(), carrier: 3000 }).carrier, 2000);
});
