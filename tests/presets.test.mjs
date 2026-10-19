import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PRESETS, normalizeMix, audibleLayers, bandFor } from '../src/mix-state.mjs';
import { makeMixFile, parseBackup } from '../src/library.mjs';
import { programAt, sessionSeconds, signalError } from '../src/program.mjs';
import { generatorSpecs, effectsFor } from '../src/studio-state.mjs';
import { sourceProgram, studioValue } from '../src/studio-program.mjs';
import { wavError } from '../src/wav-export.mjs';

const additions = PRESETS.slice(37);
const mixFor = (id) => PRESETS.find((preset) => preset.id === id).mix;

test('the original 37 presets retain their IDs, names, order and complete settings', () => {
  const digest = createHash('sha256').update(JSON.stringify(PRESETS.slice(0, 37))).digest('hex');
  assert.equal(digest, '5f08c7d98e1b9ff115c8d5431db6659c76fbd92ad5616c6b6bc2aaa1bd106b34');
});

test('24 additional presets cover fixed layers, sweeps, sessions and environment mixes with valid signal budgets', () => {
  assert.equal(additions.length, 24);
  assert.equal(additions.filter(({ mix }) => mix.mode !== 'off' && mix.automation.kind === 'fixed').length, 10);
  assert.equal(additions.filter(({ mix }) => mix.automation.kind === 'sweep').length, 5);
  assert.equal(additions.filter(({ mix }) => mix.automation.kind === 'sequence').length, 3);
  assert.equal(additions.filter(({ mix }) => mix.mode === 'off').length, 6);
  for (const { id, name, mix } of additions) {
    assert(name.length <= 40, id);
    assert.deepEqual(normalizeMix(mix), mix, id);
    assert(audibleLayers(mix).size > 0, id);
    assert(sessionSeconds(mix) >= 1200 && sessionSeconds(mix) <= 1800, id);
    assert.equal(mix.master, 50, id);
    assert(mix.toneLevel <= 20 && mix.studio.voices.every((tone) => tone.level <= 25), id);
    for (const sampleRate of [32000, 44100, 48000]) assert.equal(signalError(mix, sampleRate), '', id);
    for (const sampleRate of [44100, 48000]) assert.equal(wavError(mix, 1, sampleRate), '', id);
    if (mix.mode === 'off') assert(generatorSpecs(mix).every((tone) => !tone.enabled), id);
  }
});

test('every new preset retains all layers, effects and stage changes through versioned JSON', () => {
  const versions = new Set();
  for (const { id, mix } of additions) {
    const file = makeMixFile(mix); versions.add(file.version);
    assert.deepEqual(parseBackup(JSON.stringify(file)).entries[0].mix, mix, id);
  }
  assert(versions.has(4) && versions.has(5) && versions.has(6));
});

test('moving presets are grouped by their starting rate and have continuous stage boundaries', () => {
  for (const { id, band, mix } of additions.filter(({ mix }) => mix.automation.kind !== 'fixed')) {
    assert.equal(programAt(mix, 0).rate, mix.beat, id);
    assert.equal(band, bandFor(mix.beat, mix.mode), id);
    if (mix.automation.kind === 'sweep') {
      const sweep = mix.automation.sweep;
      assert.equal(programAt(mix, sweep.seconds).rate, sweep.end, id);
      assert.equal(programAt(mix, sweep.seconds * 2).rate, sweep.repeat === 'pingpong' ? sweep.start : sweep.end, id);
    } else {
      let elapsed = 0;
      for (const [index, stage] of mix.automation.stages.entries()) {
        assert.equal(programAt(mix, elapsed).rate, stage.start, id);
        const next = mix.automation.stages[index + 1];
        if (next) assert.equal(stage.end, next.start, id);
        elapsed += stage.seconds;
      }
      assert.equal(elapsed, mix.duration, id);
      assert.equal(programAt(mix, elapsed).rate, mix.automation.stages.at(-1).end, id);
    }
  }
});

test('dual sweeps, independent rhythms, multi-carrier tones and bowl recipes retain their intended routing', () => {
  for (const id of ['sweep-embers-3-1', 'sweep-rain-783-45', 'sweep-current-22-14', 'session-shore-12-45']) {
    const mix = mixFor(id), tones = generatorSpecs(mix).filter((tone) => tone.enabled);
    assert.deepEqual(tones.map((tone) => tone.mode), ['binaural', 'isochronic'], id);
    assert.equal(sourceProgram(mix, 'voice-2'), mix, id);
  }
  const layered = generatorSpecs(mixFor('theta-three-carriers')).filter((tone) => tone.enabled);
  assert.deepEqual(layered.map((tone) => tone.carrier), [174, 348, 522]);
  assert(layered.every((tone) => tone.program === 'follow' && tone.mode === 'binaural'));
  assert.equal(programAt(sourceProgram(mixFor('beta-two-rhythms'), 'voice-2'), 0).rate, 9);
  assert(effectsFor(mixFor('alpha-binaural-am-10'), 'tone').am.enabled);
  assert.equal(effectsFor(mixFor('gamma-pink-am-40'), 'pink').am.channels, 'offset');
  assert.equal(mixFor('ambience-stream-bowl').bells['bell-33'].interval, 180);
  assert.equal(mixFor('ambience-shore-bowl').bells['bell-37'].interval, 300);
  assert.deepEqual([...audibleLayers(mixFor('ambience-white-drift'))], ['white']);
});

test('the current-to-embers session crossfades without level jumps and holds its final balance', () => {
  const mix = mixFor('session-current-embers');
  for (const [time, stream, fire] of [[0, 30, 10], [120, 30, 10], [420, 15, 25], [600, 15, 25], [900, 0, 35], [1200, 0, 35]]) {
    assert.equal(studioValue(mix, 'stream:level', mix.sounds.stream.level, time), stream);
    assert.equal(studioValue(mix, 'campfire:level', mix.sounds.campfire.level, time), fire);
  }
  for (const target of ['stream:level', 'campfire:level']) for (const time of [120, 420, 600, 900]) {
    const base = mix.sounds[target.split(':')[0]].level;
    assert(Math.abs(studioValue(mix, target, base, time - .001) - studioValue(mix, target, base, time + .001)) < .001);
  }
});
