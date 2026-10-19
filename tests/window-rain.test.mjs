import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SOUNDS, RECORDINGS, PRESETS, recordingPath, defaultMix, normalizeMix, audibleLayers } from '../src/mix-state.mjs';
import { makeMixFile, makeBackup, parseBackup } from '../src/library.mjs';
import { wavError } from '../src/wav-export.mjs';

test('Window rain has a local credited asset, unique artwork and unchanged original preset defaults', async () => {
  const recording = SOUNDS.find(({ id }) => id === 'window-rain');
  assert.equal(recording.name, 'Window rain'); assert.equal(recording.channels, 'Stereo');
  assert.equal(recording.icon, 'window-rain'); assert.equal(RECORDINGS.length, 8);
  const bytes = await readFile(new URL('../' + recordingPath(recording.id), import.meta.url));
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash, '04a97826e2d94eb544f81ecb481a40accf9c527b03f2b9687552a934870aa605');
  const manifest = await readFile(new URL('../assets/audio/SOURCES.md', import.meta.url), 'utf8');
  assert(manifest.includes(hash)); assert(manifest.includes('https://opengameart.org/content/rain-on-window-loop'));
  assert(PRESETS.slice(0, 37).every(({ mix }) => !mix.sounds['window-rain'].enabled));
  assert(PRESETS.slice(37).some(({ mix }) => mix.sounds['window-rain'].enabled));
  assert.equal(defaultMix().sounds['window-rain'].enabled, false);
});

test('Window rain settings normalize, solo, mute and validate for environment-only export', () => {
  const mix = defaultMix(); mix.mode = 'off'; mix.sounds.stream.enabled = false;
  mix.sounds['window-rain'] = { enabled: true, level: 62, pan: -40, muted: false, solo: true };
  assert.deepEqual(normalizeMix(mix), mix);
  assert.deepEqual([...audibleLayers(mix)], ['window-rain']); assert.equal(wavError(mix, 23, 44100), '');
  mix.sounds['window-rain'].muted = true; assert.equal(audibleLayers(mix).size, 0); assert(wavError(mix, 23, 44100));
  const bounded = normalizeMix({ sounds: { 'window-rain': { enabled: false, level: 200, pan: -300, solo: true } } });
  assert.deepEqual(bounded.sounds['window-rain'], { enabled: false, level: 100, pan: -100, muted: false, solo: false });
});

test('Window rain exports version 5 without silently dropping active or inactive custom settings', () => {
  const ordinary = defaultMix(); assert.equal(makeMixFile(ordinary).version, 2);
  for (const change of [(mix) => { mix.sounds['window-rain'].enabled = true; }, (mix) => { mix.sounds['window-rain'].pan = 40; }]) {
    const mix = defaultMix(); change(mix);
    const file = makeMixFile(mix); assert.equal(file.version, 5);
    assert.deepEqual(parseBackup(JSON.stringify(file)).entries[0].mix, mix);
    const backup = makeBackup([{ id: 'rain', name: 'Window rain', mix }], ordinary, '', []);
    assert.equal(backup.version, 5); assert.deepEqual(parseBackup(JSON.stringify(backup)).entries[0].mix, mix);
  }
  for (const version of [2, 3, 4]) {
    const legacy = defaultMix(); delete legacy.sounds['window-rain'];
    const restored = parseBackup(JSON.stringify({ format: 'hz-mixer-mix', version, mix: legacy })).entries[0].mix;
    assert.deepEqual(restored.sounds['window-rain'], ordinary.sounds['window-rain']);
  }
});
