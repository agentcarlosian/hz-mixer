import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMix } from '../src/mix-state.mjs';
import { makeBackup, makeMixFile, parseBackup, mergeImports } from '../src/library.mjs';

test('mix and library JSON round-trip programs, noise and valid favorites', () => {
  const mix = defaultMix(); mix.automation.kind = 'sequence'; mix.noise.brown.enabled = true;
  const entry = { id: 'one', name: 'Stages', mix };
  const parsed = parseBackup(JSON.stringify(makeBackup([entry], mix, 'Current', ['preset:theta-783', 'invalid'])));
  assert.deepEqual(parsed.entries, [entry]); assert.deepEqual(parsed.current.mix, mix); assert.deepEqual(parsed.favorites, ['preset:theta-783']);
  assert.deepEqual(parseBackup(JSON.stringify(makeMixFile(mix, 'Single'))).entries[0].mix, mix);
});

test('import rejects malformed, oversized, unknown-version and duplicate backups', () => {
  for (const text of ['broken', '{}', 'x'.repeat(1000001), JSON.stringify({ format: 'hz-mixer-mix', version: 99 })]) assert.throws(() => parseBackup(text));
  const mix = defaultMix(), entry = { id: 'same', name: 'Name', mix };
  assert.throws(() => parseBackup(JSON.stringify({ format: 'hz-mixer-library', version: 2, entries: [entry, entry] })), /duplicate/);
  mix.automation.stages[0].seconds = 9999;
  assert.throws(() => parseBackup(JSON.stringify({ format: 'hz-mixer-mix', version: 2, mix })), /stages/);
});

test('merge avoids exact duplicates and repairs conflicting names and IDs', () => {
  const first = { id: 'a', name: 'One', mix: defaultMix() }, next = structuredClone(first); next.mix.beat = 7.83;
  const merged = mergeImports([first], [first, next], false, () => 'b');
  assert.equal(merged.length, 2); assert.equal(merged[1].id, 'b'); assert.equal(merged[1].name, 'One (import 1)');
  assert.deepEqual(mergeImports([first], [next], true, () => 'b'), [next]);
});

test('library capacity failure is atomic, including the 31st current mix', () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: 'Mix ' + i, mix: defaultMix() }));
  const extra = { id: 'extra', name: 'Current', mix: defaultMix() };
  assert.throws(() => mergeImports(entries, [extra], false, () => 'new'), /30-mix/);
  assert.throws(() => mergeImports([], [...entries, extra], true, () => 'new'), /30-mix/);
  assert.equal(entries.length, 30);
});

test('expanded JSON preserves all frequencies and version-gates older clamping builds', () => {
  const ordinary = defaultMix();
  assert.equal(makeMixFile(ordinary).version, 2);
  assert.equal(makeBackup([], ordinary, '', []).version, 2);
  for (const [beat, carrier] of [[.1, 1], [120, 5000], [7.83, 5000]]) {
    const mix = defaultMix(); mix.beat = beat; mix.carrier = carrier;
    const file = makeMixFile(mix, 'Wide'); assert.equal(file.version, 3);
    assert.deepEqual(parseBackup(JSON.stringify(file)).entries[0].mix, mix);
    const entry = { id: 'wide', name: 'Wide', mix };
    const backup = makeBackup([entry], ordinary, 'Ordinary', []); assert.equal(backup.version, 3);
    assert.deepEqual(parseBackup(JSON.stringify(backup)).entries, [entry]);
    assert.equal(makeBackup([], mix, 'Wide', []).version, 3);
  }
  for (const field of ['sweep', 'stage']) {
    const mix = defaultMix();
    if (field === 'sweep') mix.automation.sweep.end = 120;
    else mix.automation.stages[1].start = .1;
    assert.equal(makeMixFile(mix).version, 3, 'Inactive extended program values must not be lost in older builds');
    assert.deepEqual(parseBackup(JSON.stringify(makeMixFile(mix))).entries[0].mix, mix);
  }
});
