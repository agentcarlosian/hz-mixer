import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, defaultMix } from '../src/mix-state.mjs';
import { mixSummary, matchesMixSearch } from '../src/mix-display.mjs';

const preset = (id) => PRESETS.find((entry) => entry.id === id);

test('mix summaries name methods, active tone layers and actual frequency programs', () => {
  assert.equal(mixSummary(defaultMix()), 'Binaural / 8.00 Hz / 200 Hz carrier');
  assert.equal(mixSummary(preset('sweep-rain-783-45').mix), '2 tones / Binaural + Isochronic / Sweep 7.83 to 4.50 Hz');
  assert.equal(mixSummary(preset('session-current-embers').mix), 'Monaural / Session 18.00 to 6.00 Hz / 300 Hz carrier');
  assert.equal(mixSummary(preset('theta-three-carriers').mix), '3 tones / Binaural / 7.83 Hz');
  assert.equal(mixSummary(preset('ambience-campfire').mix), 'Environment only');
});

test('extra-tone-only and independent-rate summaries do not mislabel their actual configuration', () => {
  const mix = defaultMix(); mix.mode = 'off'; Object.assign(mix.studio.voices[0], { enabled: true, program: 'fixed', mode: 'isochronic', beat: 12, carrier: 300 });
  assert.equal(mixSummary(mix), 'Isochronic / 12.00 Hz / 300 Hz carrier');
  assert.equal(mixSummary(preset('beta-two-rhythms').mix), '2 tones / Monaural + Binaural / 18.00 Hz | 9.00 Hz');
});

test('preset search matches bands, every enabled method, programs and active sound layers', () => {
  for (const query of ['', ' ', 'GAMMA']) {
    const found = PRESETS.filter((entry) => matchesMixSearch(entry, query));
    assert.equal(found.length, query.trim() ? 8 : 61);
  }
  assert(matchesMixSearch(preset('gamma-pink-am-40'), 'gamma monaural'));
  assert(matchesMixSearch(preset('sweep-rain-783-45'), 'theta isochronic sweep'));
  assert(matchesMixSearch(preset('session-shore-12-45'), 'alpha session'));
  assert(matchesMixSearch(preset('ambience-stream-bowl'), 'environment singing bowl'));
  assert(!matchesMixSearch(preset('theta-783'), 'waterfall'));
  assert(!matchesMixSearch(preset('ambience-campfire'), 'binaural'));
  assert(!matchesMixSearch(preset('sweep-rain-783-45'), 'gamma sweep'));
});

test('saved entries without a preset band retain searchable method and program metadata', () => {
  const entry = { name: 'My custom mix', mix: preset('session-current-embers').mix };
  assert(matchesMixSearch(entry, 'beta monaural session campfire'));
  assert(!matchesMixSearch(entry, 'isochronic'));
});
