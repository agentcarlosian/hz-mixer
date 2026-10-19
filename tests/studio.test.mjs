import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMix, normalizeMix, audibleLayers, STUDIO_TARGETS } from '../src/mix-state.mjs';
import { defaultEffects, effectsFor, modulationCoefficients, amLevelFactor, timbreCoefficients, generatorSpecs } from '../src/studio-state.mjs';
import { studioValue, studioIntegral, studioPoints, sourceProgram } from '../src/studio-program.mjs';
import { programAt, signalError } from '../src/program.mjs';
import { makeMixFile, parseBackup, makeBackup, MAX_JSON_BYTES } from '../src/library.mjs';
import { wavError } from '../src/wav-export.mjs';
import { AudioEngine } from '../src/audio-engine.js';

test('Studio defaults are inert and preserve older file versions and restored mixes', () => {
  const mix = defaultMix(); assert.deepEqual(mix.studio.effects, {}); assert(mix.studio.voices.every((voice) => !voice.enabled));
  assert.equal(makeMixFile(mix).version, 2);
  for (const version of [2, 3, 4, 5]) {
    const old = structuredClone(mix); delete old.studio;
    assert.deepEqual(parseBackup(JSON.stringify({ format: 'hz-mixer-mix', version, mix: old })).entries[0].mix.studio, mix.studio);
  }
  assert.deepEqual(normalizeMix(mix), mix);
});

test('Studio normalization bounds controls, rejects unknown sources and clears disabled solos', () => {
  const mix = normalizeMix({ studio: { pan: -500, timbre: { shape: 'bad', partials: [300, -40, NaN] }, effects: { tone: { am: { enabled: true, rate: 999, depth: -10 }, pitch: { mode: 'pm', depth: 500 }, filter: { type: 'notch', q: 99 } }, remote: { url: 'https://example.com' } }, voices: [{ id: 'voice-2', enabled: false, solo: true, carrier: 99999 }] } });
  assert.equal(mix.studio.pan, -100); assert.equal(mix.studio.timbre.shape, 'sine'); assert.deepEqual(mix.studio.timbre.partials, [100, 0, 6]);
  const effects = effectsFor(mix, 'tone'); assert.equal(effects.am.rate, 120); assert.equal(effects.am.depth, 0); assert.equal(effects.pitch.depth, 180); assert.equal(effects.filter.q, 30);
  assert(!Object.hasOwn(mix.studio.effects, 'remote')); assert.equal(mix.studio.voices[0].carrier, 5000); assert.equal(mix.studio.voices[0].solo, false);
  const noise = normalizeMix({ studio: { effects: { white: { pitch: { mode: 'fm', depth: 200 } } } } }); assert.equal(effectsFor(noise, 'white').pitch.mode, 'off');
});

test('AM envelopes are nonnegative and bounded, with correct sine RMS matching', () => {
  for (const shape of ['sine', 'triangle', 'square', 'pulse']) for (const width of [10, 50, 90]) {
    const am = { ...defaultEffects().am, shape, width }, wave = modulationCoefficients(am);
    for (let i = 0; i < 2048; i++) {
      const angle = i / 2048 * Math.PI * 2;
      let value = wave.mean;
      for (let n = 1; n < wave.real.length; n++) value += wave.real[n] * Math.cos(n * angle) + wave.imaginary[n] * Math.sin(n * angle);
      assert(value >= -.00003 && value <= 1.00003, shape + ' envelope ' + value);
    }
  }
  assert.equal(amLevelFactor({ ...defaultEffects().am, depth: 0 }), 1);
  assert(Math.abs(amLevelFactor({ ...defaultEffects().am, depth: 100 }) - Math.sqrt(3 / 8)) < 1e-8);
});

test('extra voices have independent fixed/sweep programs, shared solo and silent-mix validation', () => {
  const mix = defaultMix(); mix.mode = 'off'; mix.sounds.stream.enabled = false;
  const voice = mix.studio.voices[0]; voice.enabled = true; voice.solo = true; voice.program = 'fixed'; voice.beat = 14;
  assert.deepEqual([...audibleLayers(mix)], ['voice-2']); assert.equal(programAt(sourceProgram(mix, 'voice-2'), 10).rate, 14); assert.equal(wavError(mix, 10, 44100), '');
  voice.program = 'sweep'; voice.sweep = { start: 8, end: 4, seconds: 10, curve: 'linear', repeat: 'pingpong' };
  assert.equal(programAt(sourceProgram(mix, 'voice-2'), 5).rate, 6); assert.equal(programAt(sourceProgram(mix, 'voice-2'), 15).rate, 6);
  voice.muted = true; assert.equal(audibleLayers(mix).size, 0); assert(wavError(mix, 10, 44100));
});

test('stage lanes preserve global curves, parameter integrals and layer crossfades', () => {
  const mix = defaultMix(); mix.automation.kind = 'sequence';
  mix.automation.stages = [{ type: 'hold', start: 8, end: 8, seconds: 10, curve: 'linear', lanes: [{ target: 'tone:carrier', start: 200, end: 300, curve: 'linear' }, { target: 'tone:level', start: 0, end: 50, curve: 'smooth' }] }];
  assert.equal(studioValue(mix, 'tone:carrier', 200, 5), 250); assert.equal(studioIntegral(mix, 'tone:carrier', 200, 10), 2500);
  const points = studioPoints(mix, 'tone:level', 35, 3.125, 8.5); assert.equal(points[0].value, studioValue(mix, 'tone:level', 35, 3.125)); assert.equal(points.at(-1).value, studioValue(mix, 'tone:level', 35, 8.5));
  const normalized = normalizeMix(mix); assert.deepEqual(normalized.automation.stages[0].lanes, mix.automation.stages[0].lanes);
  mix.toneLevel = 0; mix.sounds.stream.enabled = false; assert.equal(wavError(mix, 10, 44100), '');
  assert(STUDIO_TARGETS.some((target) => target.key === 'window-rain:amDepth'));
});

test('Studio spectral budgets include harmonics, FM/PM and every active voice', () => {
  const mix = defaultMix(); mix.carrier = 5000; mix.studio.timbre.shape = 'triangle'; assert(signalError(mix, 44100).includes('sample rate'));
  mix.studio.timbre.shape = 'sine'; assert.equal(signalError(mix, 44100), '');
  mix.studio.effects.tone = defaultEffects(); mix.studio.effects.tone.pitch = { mode: 'fm', depth: 300, rate: 2 }; mix.carrier = 200;
  assert(signalError(mix, 44100).includes('positive frequency'));
  mix.mode = 'off'; mix.studio.voices[0].enabled = true; mix.studio.voices[0].carrier = 1;
  assert(signalError(mix, 44100).startsWith('Tone 2:'));
  const weights = timbreCoefficients({ shape: 'harmonic', partials: [50, 25, 0] }); assert(Math.abs(weights[2] / weights[1] - .5) < .000001);
});

test('version 6 JSON preserves every Studio setting and rejects malformed lanes', () => {
  const mix = defaultMix(); mix.studio.effects.white = defaultEffects(); mix.studio.effects.white.am.enabled = true;
  mix.studio.voices[1].enabled = true; mix.studio.voices[1].program = 'sweep';
  mix.automation.stages[0].lanes = [{ target: 'white:level', start: 0, end: 60, curve: 'linear' }];
  const normalized = normalizeMix(mix), file = makeMixFile(mix); assert.equal(file.version, 6); assert.deepEqual(parseBackup(JSON.stringify(file)).entries[0].mix, normalized);
  assert.equal(makeBackup([{ id: 'studio', name: 'Studio', mix }], defaultMix(), '', []).version, 6);
  file.mix.automation.stages[0].lanes.push({ target: '__proto__:level', start: 0, end: 50 }); assert.throws(() => parseBackup(JSON.stringify(file)), /automation/);
  assert.throws(() => parseBackup(' '.repeat(MAX_JSON_BYTES + 1)), /4 MB/);
  assert.equal(generatorSpecs(defaultMix()).length, 3);
});

test('live linked AM follows beat edits while FX resets preserve recording playheads', () => {
  const mix = defaultMix(); mix.sounds.stream.enabled = true; mix.studio.effects.white = defaultEffects(); mix.studio.effects.white.am.enabled = true; mix.noise.white.enabled = true;
  const engine = new AudioEngine(), starts = []; engine.mix = structuredClone(mix);
  engine.context = { currentTime: 10, sampleRate: 44100 }; engine.playing = true;
  engine.rebuildTone = () => {}; engine.rescheduleEnvelope = () => {}; engine.levels = () => {};
  const layer = () => ({ gain: { gain: { setTargetAtTime() {} } }, sourcePosition: () => 123, stop() {} });
  const stream = layer(); engine.layers.set('stream', stream); engine.layers.set('white', layer());
  engine.startLayer = (id, initial, cursor) => { starts.push({ id, cursor }); engine.layers.set(id, layer()); };
  mix.beat = 12; engine.update(mix);
  assert.equal(starts.length, 1); assert.equal(starts[0].id, 'white'); assert.equal(starts[0].cursor.position, 123); assert.equal(engine.layers.get('stream'), stream);
  engine.resetPosition(); assert.equal(starts.length, 2); assert.equal(starts[1].cursor.position, 123); assert.equal(engine.layers.get('stream'), stream);
});
