import test from 'node:test';
import assert from 'node:assert/strict';
import { MatrixRain, createRainStreams, createRainGlyphs } from '../src/matrix-rain.mjs';

test('rain trails mix kanji, katakana and readable mixer vocabulary without changing length', () => {
  const trails = [];
  for (let column = 0; column < 96; column++) for (let cycle = 0; cycle < 3; cycle++) {
    const glyphs = createRainGlyphs(column, cycle, 12 + column * 7 % 15);
    assert.deepEqual(glyphs, createRainGlyphs(column, cycle, glyphs.length));
    assert.equal(glyphs.length, 12 + column * 7 % 15);
    assert(glyphs.every((glyph) => Array.from(glyph).length === 1));
    trails.push(glyphs.join(''));
  }
  const all = trails.join('');
  assert(new Set(all.match(/[\u4E00-\u9FFF]/g)).size >= 30, 'A broad set of kanji is used.');
  assert(new Set(all.match(/[\uFF66-\uFF9D]/g)).size >= 30, 'Katakana remain part of the rain.');
  for (const word of ['BINAURAL', 'BEAT', 'MIXER', 'MONAURAL', 'ISOCHRONIC', 'DELTA', 'THETA', 'ALPHA', 'BETA', 'GAMMA']) assert(trails.some((trail) => trail.includes(word)), word);
  assert.notDeepEqual(createRainGlyphs(0, 0, 20), createRainGlyphs(0, 1, 20));
});

test('rain streams have deterministic, bounded density and gentle fall speeds', () => {
  for (const width of [320, 390, 1365, 3840, 7680]) {
    const streams = createRainStreams(width, 900);
    assert.deepEqual(streams, createRainStreams(width, 900));
    assert(streams.length > 0 && streams.length <= 96);
    assert(streams.every((stream) => stream.x > 0 && stream.x < width && stream.length >= 12 && stream.length <= 26 && stream.speed >= 24 && stream.speed <= 56));
  }
});

test('Matrix rain pauses, respects reduced motion/visibility and never duplicates frame loops', () => {
  const saved = Object.fromEntries(['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames = new Map(), events = {}, media = { matches: false, addEventListener: (name, fn) => { events.media = fn; } };
  let frameId = 0, paints = 0;
  const drawn = [];
  const context = { clearRect() {}, setTransform() {}, fillText(text, x, y) { paints++; drawn.push({ text, x, y }); } };
  const canvas = { hidden: true, width: 0, height: 0, getContext: () => context };
  const states = [];
  try {
    globalThis.window = { innerWidth: 800, innerHeight: 600, devicePixelRatio: 3, matchMedia: () => media, addEventListener: (name, fn) => { events[name] = fn; } };
    globalThis.document = { hidden: false, addEventListener: (name, fn) => { events[name] = fn; } };
    globalThis.requestAnimationFrame = (fn) => { frames.set(++frameId, fn); return frameId; };
    globalThis.cancelAnimationFrame = (id) => frames.delete(id);
    const rain = new MatrixRain(canvas, (state) => states.push(state));
    assert.equal(frames.size, 0);
    rain.setActive(true); rain.setActive(true);
    assert.equal(frames.size, 1); assert.equal(canvas.hidden, false); assert.equal(canvas.width, 1200);
    assert.equal(context.textAlign, 'center'); assert(context.font.includes('Yu Gothic'));
    const firstTrail = rain.streams[0].glyphs;
    const tick = (time) => { const [id, fn] = frames.entries().next().value; frames.delete(id); fn(time); };
    tick(0); tick(50); assert(paints > 0); assert.equal(frames.size, 1);
    assert.equal(rain.streams[0].glyphs, firstTrail, 'Glyphs stay stable between animation frames.');
    const savedElapsed = rain.elapsed;
    rain.elapsed = 10; drawn.length = 0; rain.draw();
    const firstColumn = drawn.filter((item) => item.x === rain.streams[0].x).sort((a, b) => a.y - b.y).map((item) => item.text).join('');
    assert(firstColumn.includes('BINAURAL'), 'Words read top to bottom on the canvas.');
    rain.elapsed = savedElapsed;
    const elapsed = rain.elapsed;
    rain.setPaused(true); assert.equal(frames.size, 0); assert.equal(canvas.hidden, false); assert.equal(rain.elapsed, elapsed);
    rain.setPaused(false); assert.equal(frames.size, 1);
    tick(5000); assert.equal(rain.elapsed, elapsed, 'resume does not jump forward');
    document.hidden = true; events.visibilitychange(); assert.equal(frames.size, 0);
    document.hidden = false; events.visibilitychange(); assert.equal(frames.size, 1);
    media.matches = true; events.media(); assert.equal(frames.size, 0); assert.equal(canvas.hidden, true);
    assert.equal(states.at(-1).reduced, true);
    media.matches = false; events.media(); assert.equal(frames.size, 1); assert.equal(canvas.hidden, false);
    window.innerWidth = 390; events.resize(); assert.equal(canvas.width, 585); assert.equal(frames.size, 1);
    rain.setActive(false); assert.equal(frames.size, 0); assert.equal(canvas.hidden, true);
    rain.setActive(true); assert.equal(frames.size, 1);
    rain.setPaused(true); rain.setActive(false); const beforeReturn = paints;
    rain.setActive(true); assert.equal(frames.size, 0); assert(paints > beforeReturn, 'returning to a paused Matrix theme restores a static frame');
    rain.setActive(false);
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
