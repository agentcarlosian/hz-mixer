import test from 'node:test';
import assert from 'node:assert/strict';
import { pulseValue, noiseData, crossfadeData } from '../src/audio-graph.mjs';
import { defaultMix, audibleLayers } from '../src/mix-state.mjs';
import { wavHeader, pcm16, wavError, exportSeconds, renderWav, waitForExport } from '../src/wav-export.mjs';
import { getEventListeners } from 'node:events';
import { AudioEngine } from '../src/audio-engine.js';

test('engine settings are isolated snapshots and idle playback clocks stay frozen', () => {
  const mix = defaultMix(), engine = new AudioEngine();
  engine.update(mix); mix.beat = 7.83; mix.noise.white.enabled = true;
  assert.equal(engine.mix.beat, 8); assert.equal(engine.mix.noise.white.enabled, false);
  engine.position = 5.25; assert.equal(engine.elapsed(), 5.25);
  engine.resetPosition(); assert.equal(engine.elapsed(), 0);
});

test('pulse width, softness and depth affect the envelope without hard edges', () => {
  const pulse = { width: 50, softness: 50, depth: 100 };
  assert.equal(pulseValue(0, pulse), 0); assert.equal(pulseValue(.25, pulse), 1); assert.equal(pulseValue(.8, pulse), 0);
  assert(pulseValue(.05, pulse) > 0 && pulseValue(.05, pulse) < 1);
  assert.equal(pulseValue(.8, { ...pulse, depth: 40 }), .6);
  assert.equal(pulseValue(.8, { ...pulse, depth: 0 }), 1);
  assert.equal(pulseValue(.25, { ...pulse, width: 10 }), 0);
});

test('deterministic noise is centered, bounded and increasingly low-frequency', () => {
  const roughness = [];
  for (const kind of ['white', 'pink', 'brown']) {
    const data = noiseData(kind, 8000, 2);
    assert.deepEqual(data, noiseData(kind, 8000, 2));
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const rms = Math.sqrt(data.reduce((a, b) => a + b * b, 0) / data.length);
    assert(Math.abs(mean) < .03); assert(Math.abs(rms - .16) < .005);
    assert(data.every((value) => Math.abs(value) <= .9));
    roughness.push(data.slice(1).reduce((sum, value, i) => sum + (value - data[i]) ** 2, 0) / data.length);
  }
  assert(roughness[0] > roughness[1] * 2); assert(roughness[1] > roughness[2] * 2);
});

test('loop crossfade is continuous and does not mutate original recording data', () => {
  const original = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i * .002));
  const copy = original.slice(), loop = crossfadeData([original], 100, 1)[0];
  assert.deepEqual(original, copy); assert.equal(loop.length, 900);
  assert(Math.abs(loop[0] - loop.at(-1)) < .003);
  assert(loop.every((value) => Math.abs(value) <= .950001));
});

test('noise follows the same mute and solo precedence as environmental layers', () => {
  const mix = defaultMix(); mix.noise.pink.enabled = true; mix.noise.pink.solo = true;
  assert.deepEqual([...audibleLayers(mix)], ['pink']);
  mix.noise.pink.muted = true; assert.equal(audibleLayers(mix).size, 0);
});

test('WAV headers and PCM use stereo signed 16-bit little-endian framing', () => {
  const view = new DataView(wavHeader(3, 48000));
  assert.equal(view.getUint32(4, true), 48); assert.equal(view.getUint32(40, true), 12);
  assert.equal(view.getUint16(22, true), 2); assert.equal(view.getUint32(24, true), 48000);
  const pcm = new DataView(pcm16(new Float32Array([-2, 0, 2]), new Float32Array([1, .5, -1])));
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => pcm.getInt16(i * 2, true)), [-32768, 32767, 0, 16384, 32767, -32768]);
});

test('WAV rejects silence and unbounded duration and derives program lengths', () => {
  const mix = defaultMix(); assert.equal(wavError(mix, 30, 44100), '');
  for (const seconds of [0, NaN, 7201]) assert(wavError(mix, seconds, 44100));
  mix.masterMuted = true; assert(wavError(mix, 30, 44100));
  mix.automation.kind = 'sequence'; assert.equal(exportSeconds(mix), 1500);
  mix.automation.kind = 'sweep'; assert.equal(exportSeconds(mix), 480);
});

test('cancelled export detaches from held audio without breaking a shared consumer', async () => {
  let release;
  const shared = new Promise((resolve) => { release = resolve; }), abort = new AbortController();
  const waiting = renderWav(defaultMix(), 1, 44100, () => shared, () => {}, abort.signal);
  abort.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
  assert.equal(getEventListeners(abort.signal, 'abort').length, 0);
  const consumer = shared.then((value) => value); release('available'); assert.equal(await consumer, 'available');
});

test('abort-aware waits clean listeners and handle late shared failures', async () => {
  const abort = new AbortController(); assert.equal(await waitForExport(Promise.resolve(42), abort.signal), 42);
  assert.equal(getEventListeners(abort.signal, 'abort').length, 0);
  await assert.rejects(waitForExport(Promise.reject(new Error('load failed')), abort.signal), /load failed/);
  let fail; const held = new Promise((resolve, reject) => { fail = reject; });
  const detached = waitForExport(held, abort.signal); abort.abort();
  await assert.rejects(detached, { name: 'AbortError' }); fail(new Error('late failure')); await Promise.resolve();
  assert.equal(getEventListeners(abort.signal, 'abort').length, 0);
});
