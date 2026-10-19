import test from 'node:test';
import assert from 'node:assert/strict';
import { randomMix } from '../src/random-mix.mjs';
import { defaultMix, normalizeMix, audibleLayers, bandFor, PRESETS } from '../src/mix-state.mjs';
import { defaultStudio } from '../src/studio-state.mjs';
import { signalError, sessionSeconds } from '../src/program.mjs';
import { makeMixFile, parseBackup } from '../src/library.mjs';
import { wavError } from '../src/wav-export.mjs';

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}

test('random rolls preserve master/mute, fades, timing and the source object', () => {
  for (const id of ['stream-8', 'sweep-rain-783-45', 'session-current-embers']) {
    const current = structuredClone(PRESETS.find((preset) => preset.id === id).mix);
    Object.assign(current, { master: 17, masterMuted: true }); current.fades = { in: 12, out: 18 };
    const before = structuredClone(current);
    const mix = randomMix(current, { advanced: true, random: seededRandom(123) });
    assert.deepEqual(current, before); assert.equal(mix.master, 17); assert.equal(mix.masterMuted, true);
    assert.deepEqual(mix.fades, current.fades); assert.equal(mix.duration, current.duration);
    assert.equal(mix.automation.kind, current.automation.kind);
    assert.equal(sessionSeconds(mix), sessionSeconds(current));
    assert.equal(mix.automation.sweep.seconds, current.automation.sweep.seconds);
    assert.equal(mix.automation.sweep.repeat, current.automation.sweep.repeat);
    assert(mix.automation.stages.every((stage) => !stage.lanes));
    assert.notDeepEqual(mix, current);
  }
  const infinite = defaultMix(); infinite.duration = 0; infinite.master = 0;
  assert.equal(randomMix(infinite).duration, 0); assert.equal(randomMix(infinite).master, 0);
});

test('simple rolls are truly single-tone mixes, including when leaving an advanced preset', () => {
  const current = structuredClone(PRESETS.find(({ id }) => id === 'session-current-embers').mix);
  current.automation.kind = 'fixed';
  const random = seededRandom(42), modes = new Set(), bands = new Set(), settings = new Set();
  for (let i = 0; i < 200; i++) {
    const mix = randomMix(current, { random });
    assert.deepEqual(mix.studio, defaultStudio());
    assert(mix.automation.stages.every((stage) => !stage.lanes));
    assert.deepEqual(normalizeMix(mix), mix);
    assert(Object.values(mix.sounds).filter((layer) => layer.enabled).length <= 2);
    assert(Object.values(mix.noise).filter((layer) => layer.enabled).length <= 1);
    assert(Object.values(mix.bells).filter((layer) => layer.enabled).length <= 1);
    modes.add(mix.mode); bands.add(bandFor(mix.beat)); settings.add(JSON.stringify(mix));
  }
  assert.equal(modes.size, 3); assert.equal(bands.size, 5); assert.equal(settings.size, 200);
});

test('random programs preserve timing and stage transitions while keeping rates continuous', () => {
  for (const kind of ['sweep', 'sequence']) {
    const current = defaultMix(); current.automation.kind = kind;
    const mix = randomMix(current, { random: seededRandom(9) });
    assert.equal(mix.automation.sweep.curve, current.automation.sweep.curve);
    if (kind === 'sweep') assert.equal(mix.automation.sweep.start, mix.beat);
    else {
      assert.equal(mix.automation.stages[0].start, mix.beat);
      for (const [index, stage] of mix.automation.stages.entries()) {
        assert.equal(stage.seconds, current.automation.stages[index].seconds);
        assert.equal(stage.type, current.automation.stages[index].type);
        assert.equal(stage.curve, current.automation.stages[index].curve);
        if (stage.type === 'hold') assert.equal(stage.end, stage.start);
        if (index) assert.equal(stage.start, mix.automation.stages[index - 1].end);
      }
    }
  }
});

test('seeded random settings remain bounded, non-silent and valid across device budgets', () => {
  const modes = new Set(), sources = new Set(), effects = new Set();
  for (const sampleRate of [8000, 16000, 22050, 32000, 44100, 48000, 96000]) {
    const random = seededRandom(sampleRate), current = defaultMix();
    for (let i = 0; i < 300; i++) {
      const mix = randomMix(current, { advanced: true, sampleRate, random });
      assert.deepEqual(normalizeMix(mix), mix);
      assert.equal(signalError(mix, sampleRate), '', sampleRate + ': ' + JSON.stringify(mix));
      assert.equal(wavError(mix, 1, 44100), ''); assert.equal(wavError(mix, 1, 48000), '');
      assert(audibleLayers(mix).has('tone')); assert(mix.toneLevel >= 15 && mix.toneLevel <= 28);
      assert(mix.pulse.softness >= 55 && mix.pulse.softness <= 90);
      assert(mix.studio.voices.filter((voice) => voice.enabled).length <= 2);
      for (const group of [mix.sounds, mix.noise, mix.bells]) for (const [id, layer] of Object.entries(group)) {
        assert(!layer.solo && !layer.muted); if (layer.enabled) sources.add(id);
      }
      for (const profile of Object.values(mix.studio.effects)) {
        if (profile.am.enabled) effects.add('am'); if (profile.pan.enabled) effects.add('pan');
        if (profile.pitch.mode !== 'off') effects.add(profile.pitch.mode); if (profile.filter.type !== 'off') effects.add('filter');
      }
      modes.add(mix.mode);
    }
  }
  assert.equal(modes.size, 3); assert.equal(sources.size, 11);
  assert.deepEqual([...effects].sort(), ['am', 'filter', 'fm', 'pan', 'pm']);
});

test('random rolls are reproducible in tests and round-trip all generated settings', () => {
  assert.deepEqual(randomMix(defaultMix(), { advanced: true, random: seededRandom(10) }), randomMix(defaultMix(), { advanced: true, random: seededRandom(10) }));
  const random = seededRandom(100);
  for (let i = 0; i < 50; i++) {
    const mix = randomMix(defaultMix(), { advanced: true, random });
    assert.deepEqual(parseBackup(JSON.stringify(makeMixFile(mix))).entries[0].mix, mix);
  }
  for (const sampleRate of [NaN, Infinity, 0, -1]) assert.equal(signalError(randomMix(null, { sampleRate, advanced: true, random: seededRandom(10) }), 32000), '');
});

test('minimum and maximum random draws remain valid at the generator budget boundaries', () => {
  for (const sampleRate of [8000, 16000, 22050, 32000, 44100, 48000]) for (const draw of [0, .999999999]) {
    const mix = randomMix(defaultMix(), { sampleRate, advanced: true, random: () => draw });
    assert.deepEqual(normalizeMix(mix), mix); assert.equal(signalError(mix, sampleRate), '');
    assert(mix.beat >= .5 && mix.beat <= 80);
  }
});
