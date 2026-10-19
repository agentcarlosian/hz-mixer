import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SOUNDS, BELLS, RECORDINGS, recordingPath, defaultMix, normalizeMix, audibleLayers } from '../src/mix-state.mjs';
import { bellEvents, bellLayer, outputGraph } from '../src/audio-graph.mjs';
import { makeMixFile, makeBackup, parseBackup } from '../src/library.mjs';
import { wavError } from '../src/wav-export.mjs';

test('campfire and both full-length bells are local, off by default and source-manifested', async () => {
  const expected = { campfire: '160e2315cf0509b77cd757cce5e4441932e1a5477265de24b02c536f838e5fc4', 'bell-33': 'ef33b133713348ec9c2e385facc6bdf7adba06fe800dd41828b30083b4727da4', 'bell-37': 'ba3ff1ee80bd3e4eff2ae643a94df2ee6de7501b654bae47c3565cda7f5a4743' };
  const manifest = await readFile(new URL('../assets/audio/SOURCES.md', import.meta.url), 'utf8');
  assert.equal(SOUNDS.length, 6); assert.equal(BELLS.length, 2); assert.equal(RECORDINGS.length, 8);
  assert.deepEqual(BELLS.map(({ id, name, file }) => ({ id, name, file })), [
    { id: 'bell-33', name: 'Singing Bowl I', file: 'bell-33.wav' },
    { id: 'bell-37', name: 'Singing Bowl II', file: 'bell-37.wav' },
  ], 'display names retain compatible saved-mix IDs and original recording files');
  const mix = defaultMix(); assert.equal(mix.sounds.campfire.enabled, false);
  for (const { id } of BELLS) { assert.equal(mix.bells[id].enabled, false); assert.equal(mix.bells[id].interval, 60); }
  for (const [id, hash] of Object.entries(expected)) {
    const bytes = await readFile(new URL('../' + recordingPath(id), import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash); assert(manifest.includes(hash));
  }
  assert.throws(() => recordingPath('../remote'), /Unknown/);
});

test('bell settings normalize safely and use common mute/solo and export validation', () => {
  const mix = defaultMix(); mix.mode = 'off'; mix.sounds.stream.enabled = false;
  mix.bells['bell-33'] = { enabled: true, level: 45, pan: -20, muted: false, solo: true, interval: 300 };
  assert.deepEqual(normalizeMix(mix), mix);
  assert.deepEqual([...audibleLayers(mix)], ['bell-33']); assert.equal(wavError(mix, 30, 44100), '');
  mix.bells['bell-33'].muted = true; assert.equal(audibleLayers(mix).size, 0); assert(wavError(mix, 30, 44100));
  const normalized = normalizeMix({ bells: { 'bell-33': { enabled: false, solo: true, level: 150, pan: -200, interval: 0 }, 'bell-37': { interval: Infinity } } });
  assert.deepEqual(normalized.bells['bell-33'], { enabled: false, solo: false, muted: false, level: 100, pan: -100, interval: 15 });
  assert.equal(normalized.bells['bell-37'].interval, 60);
});

test('new-layer JSON is version-gated, including inactive custom settings and saved entries', () => {
  const ordinary = defaultMix(); assert.equal(makeMixFile(ordinary).version, 2);
  for (const change of [
    (mix) => { mix.sounds.campfire.enabled = true; },
    (mix) => { mix.sounds.campfire.level = 20; },
    (mix) => { mix.bells['bell-33'].enabled = true; },
    (mix) => { mix.bells['bell-37'].interval = 300; },
  ]) {
    const mix = defaultMix(); change(mix);
    const exported = makeMixFile(mix); assert.equal(exported.version, 4);
    assert.deepEqual(parseBackup(JSON.stringify(exported)).entries[0].mix, mix);
    assert.equal(makeBackup([{ id: 'new', name: 'New', mix }], ordinary, '', []).version, 4);
  }
  for (const version of [2, 3]) {
    const legacy = defaultMix(); delete legacy.bells; delete legacy.sounds.campfire;
    const restored = parseBackup(JSON.stringify({ format: 'hz-mixer-mix', version, mix: legacy })).entries[0].mix;
    assert.equal(restored.bells['bell-33'].enabled, false); assert.equal(restored.sounds.campfire.enabled, false);
  }
});

test('bell schedules use exact interval multiples, preserve tails and exclude end-boundary strikes', () => {
  assert.deepEqual([...bellEvents(0, 301, 60, 11)].map((event) => event.time), [0, 60, 120, 180, 240, 300]);
  assert.deepEqual([...bellEvents(0, 601, 300, 5)].map((event) => event.time), [0, 300, 600]);
  assert.deepEqual([...bellEvents(65, 121, 60, 11)], [{ time: 60, offset: 5 }, { time: 120, offset: 0 }]);
  assert.deepEqual([...bellEvents(71, 120, 60, 11)], []);
  assert.deepEqual([...bellEvents(0, 181, 60, 11, 120)].map((event) => event.time), [0, 60]);
  assert.throws(() => [...bellEvents(0, 10, 0, 1)], /Invalid/);
});

test('output keeps the compressor active during gaps with an exactly zero-valued source', () => {
  const parameter = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} });
  const context = { currentTime: 0,
    createGain() { return { gain: parameter(), connect() { return this; } }; },
    createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() { return this; } }; },
    createConstantSource() { return { offset: parameter(), connect(target) { this.target = target; }, start(when) { this.when = when; } }; },
  };
  const output = outputGraph(context, defaultMix(), {});
  assert.equal(output.silentInput.offset.value, 0); assert.equal(output.silentInput.target, output.compressor); assert.equal(output.silentInput.when, 0);
});

test('audio-clock bell sources resume decay, extend without duplicates and skip missed background strikes', () => {
  const nodes = [], parameter = () => ({ value: 0 });
  const context = { currentTime: 20,
    createGain() { return { gain: parameter(), connect() { return this; }, disconnect() {} }; },
    createStereoPanner() { return { pan: parameter(), connect() { return this; }, disconnect() {} }; },
    createBufferSource() { const node = { connect() {}, disconnect() {}, start(...args) { this.started = args; }, stop(time) { this.stopped = time; } }; nodes.push(node); return node; },
  };
  const layer = bellLayer(context, { duration: 11 }, {}, 60, 65, 180, 20);
  assert.deepEqual(nodes.map((node) => node.started), [[20, 5], [75, 0]]);
  layer.extend(240); assert.deepEqual(nodes.map((node) => node.started), [[20, 5], [75, 0], [135, 0]]);
  layer.extend(240); assert.equal(nodes.length, 3);
  context.currentTime = 560;
  layer.extend(700); assert.deepEqual(nodes.slice(3).map((node) => node.started), [[560, 5], [615, 0]]);
  layer.stop(); assert(nodes.every((node) => node.stopped === 560));
  nodes.length = 0; context.currentTime = 20;
  const fresh = bellLayer(context, { duration: 11 }, {}, 60, .2, 121, 20, Infinity, true);
  assert.equal(nodes.length, 3); assert.deepEqual(nodes[0].started, [20, 0]);
  assert(Math.abs(nodes[2].started[0] - nodes[1].started[0] - 60) < .00001);
  fresh.stop();
});
