import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMix, normalizeMix } from '../src/mix-state.mjs';
import { programAt, beatCycles, rateSegments, sessionSeconds, envelopeAt, scheduleEnvelope, scheduleRate, signalError } from '../src/program.mjs';

test('fixed, once and ping-pong programs retain exact endpoint rates', () => {
  const mix = defaultMix();
  assert.equal(programAt(mix, 50).rate, 8);
  mix.automation.kind = 'sweep';
  mix.automation.sweep = { start: 7.83, end: 4.5, seconds: 20, curve: 'smooth', repeat: 'once' };
  assert.equal(programAt(mix, 0).rate, 7.83);
  assert.equal(programAt(mix, 10).rate, 6.165);
  assert.equal(programAt(mix, 60).rate, 4.5);
  mix.automation.sweep.repeat = 'pingpong';
  assert.equal(programAt(mix, 20).rate, 4.5);
  assert.equal(programAt(mix, 40).rate, 7.83);
  assert.equal(programAt(mix, 30).rate, 6.165);
});

test('sequence uses stage durations and holds its last endpoint', () => {
  const mix = defaultMix(); mix.automation.kind = 'sequence';
  assert.equal(sessionSeconds(mix), 1500);
  assert.equal(programAt(mix, 119).stage, 0);
  assert.equal(programAt(mix, 120).stage, 1);
  assert.equal(programAt(mix, 360).rate, 8);
  assert.equal(programAt(mix, 600).stage, 2);
  assert.equal(programAt(mix, 2000).rate, 6);
  assert.deepEqual(rateSegments(mix, 119, 121).map((s) => [s.from, s.until]), [[119, 120], [120, 121]]);
});

test('rate scheduling and phase integration agree across partial smooth renders', () => {
  const mix = defaultMix(); mix.automation.kind = 'sweep';
  mix.automation.sweep = { start: 7.83, end: 13, seconds: 25, curve: 'smooth', repeat: 'pingpong' };
  for (const [from, until] of [[0, 20], [19, 40], [39, 50], [51.2, 54.4]]) {
    const events = [];
    const param = { setValueAtTime(value, time) { events.push({ value, time, type: 'set' }); }, linearRampToValueAtTime(value, time) { events.push({ value, time, type: 'ramp' }); } };
    scheduleRate(param, mix, from, until, 0);
    let integral = 0, previous = events[0];
    for (const event of events.slice(1)) { integral += (event.time - previous.time) * (event.type === 'ramp' ? (event.value + previous.value) / 2 : previous.value); previous = event; }
    integral += (until - from - previous.time) * previous.value;
    assert(Math.abs(integral - (beatCycles(mix, until) - beatCycles(mix, from))) < 1e-8);
  }
  assert(Math.abs(beatCycles(mix, 50) - 50 * (7.83 + 13) / 2) < 1e-8);
});

test('short-session fades never overlap and timer end is silent', () => {
  const mix = defaultMix(); mix.fades = { in: 30, out: 30 };
  assert.equal(envelopeAt(mix, 0, 10), 0);
  assert.equal(envelopeAt(mix, 5, 10), 1);
  assert.equal(envelopeAt(mix, 8, 10), .4);
  assert.equal(envelopeAt(mix, 10, 10), 0);
  const events = [];
  scheduleEnvelope({ setValueAtTime: (v, t) => events.push([v, t]), linearRampToValueAtTime: (v, t) => events.push([v, t]) }, mix, 4, 10, 0, 10);
  assert.deepEqual(events, [[.8, 0], [1, 1], [0, 6]]);
  assert.equal(envelopeAt(mix, 100, 0), 1);
});

test('legacy snapshots get new defaults; malformed stages and fields are bounded', () => {
  const mix = normalizeMix({ mode: 'binaural', beat: 7.83, carrier: 20 });
  assert.equal(mix.automation.kind, 'fixed'); assert.equal(mix.fades.in, 3); assert.equal(mix.noise.pink.enabled, false);
  const many = normalizeMix({ automation: { kind: 'sequence', stages: Array.from({ length: 30 }, () => ({ start: 80, end: -4, seconds: 5000, type: 'sweep' })) } });
  assert.equal(sessionSeconds(many), 7200); assert.equal(many.automation.stages.length, 2);
  assert(many.automation.stages.every((stage) => stage.start === 40 && stage.end === .5));
});

test('two-tone carrier validation includes all planned rates', () => {
  const mix = defaultMix(); mix.carrier = 20; mix.beat = 40;
  assert(signalError(mix)); mix.mode = 'isochronic'; assert.equal(signalError(mix), '');
  mix.mode = 'binaural'; mix.beat = 7.83; assert.equal(signalError(mix), '');
  mix.automation.kind = 'sequence'; mix.automation.stages[1].end = 40; assert(signalError(mix));
});
