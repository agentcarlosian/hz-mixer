import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defaultStudio } from '../src/studio-state.mjs';

export async function randomizeRegressions(browser, url, output) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 1000 }, acceptDownloads: true });
  const errors = [], requests = [];
  page.on('pageerror', (error) => errors.push(error.message)); page.on('request', (request) => requests.push(request.url()));
  await page.addInitScript(() => {
    let state = 100;
    Math.random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  });
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.current.v1')));
  let portable;
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#reset-mix').evaluate((button) => button.nextElementSibling.id), 'randomize-mix');
    assert.equal(await page.locator('#randomize-mix').getAttribute('data-tooltip'), 'Randomize mix');
    assert.equal(await page.locator('#randomize-mix').getAttribute('aria-label'), 'Randomize mix');
    await page.locator('#mix-select').selectOption('preset:theta-783'); await page.locator('#favorite-mix').click();
    await page.locator('#save-mix').click(); await page.locator('#mix-name').fill('Before random'); await page.locator('#save-form button[type="submit"]').click();
    const library = await page.evaluate(() => localStorage.getItem('beat-mixer.library.v1'));
    const favorites = await page.evaluate(() => localStorage.getItem('beat-mixer.favorites.v1'));
    for (const preset of ['stream-8', 'sweep-rain-783-45', 'session-current-embers']) {
      await page.locator('#mix-select').selectOption('preset:' + preset);
      await page.locator('#master-level').evaluate((input) => { input.value = '17'; input.dispatchEvent(new Event('input', { bubbles: true })); });
      if (await page.locator('#master-mute').getAttribute('aria-pressed') !== 'true') await page.locator('#master-mute').click();
      let before = await stored();
      for (let i = 0; i < 6; i++) {
        await page.locator('#randomize-mix').click(); const after = await stored();
        assert.equal(after.selection, 'custom'); assert.notDeepEqual(after.mix, before.mix);
        assert.equal(after.mix.master, 17); assert.equal(after.mix.masterMuted, true);
        assert.deepEqual(after.mix.fades, before.mix.fades); assert.equal(after.mix.duration, before.mix.duration);
        assert.equal(after.mix.automation.kind, before.mix.automation.kind);
        assert.equal(after.mix.automation.sweep.seconds, before.mix.automation.sweep.seconds);
        assert.equal(after.mix.automation.sweep.repeat, before.mix.automation.sweep.repeat);
        assert.deepEqual(after.mix.automation.stages.map(({ type, seconds, curve }) => ({ type, seconds, curve })), before.mix.automation.stages.map(({ type, seconds, curve }) => ({ type, seconds, curve })));
        assert.deepEqual(after.mix.studio, defaultStudio()); assert(after.mix.automation.stages.every((stage) => !stage.lanes));
        assert.equal(await page.locator('#status').textContent(), 'Ready');
        assert.equal(await page.locator('#advanced-status').isVisible(), false);
        before = after;
      }
    }
    assert(!requests.some((request) => /\.(?:mp3|wav)$/.test(request)), 'idle dice does not start playback or load recordings');
    await page.locator('button[data-interface-mode="advanced"]').click();
    let tones = false, effects = false;
    for (let i = 0; i < 20; i++) {
      await page.locator('#randomize-mix').click(); const { mix } = await stored();
      tones ||= mix.studio.voices.some((voice) => voice.enabled); effects ||= Object.keys(mix.studio.effects).length > 0;
    }
    assert(tones && effects, 'Advanced rolls explore additional tones and effects');
    const last = (await stored()).mix;
    await page.reload(); assert.deepEqual((await stored()).mix, last);
    await page.locator('#open-export').click(); await page.locator('[data-export-tab="mix"]').click();
    const pending = page.waitForEvent('download'); await page.locator('#download-export').click();
    const exported = JSON.parse(await readFile(await (await pending).path(), 'utf8'));
    assert.deepEqual(exported.mix, last); await page.locator('#cancel-export').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('beat-mixer.library.v1')), library);
    assert.equal(await page.evaluate(() => localStorage.getItem('beat-mixer.favorites.v1')), favorites);

    await page.locator('button[data-interface-mode="simple"]').click(); await page.locator('#mix-select').selectOption('preset:theta-783');
    for (const id of ['#fade-in', '#fade-out']) { await page.locator(id).fill('0'); await page.locator(id).press('Tab'); }
    await page.locator('#play-button').click(); await page.waitForFunction(() => document.getElementById('status').textContent === 'Playing');
    await page.locator('#randomize-mix').click(); assert.equal(await page.locator('#status').textContent(), 'Playing');
    assert.equal(await page.locator('#signal-error').textContent(), '');
    await page.locator('#play-button').click(); await page.waitForFunction(() => document.getElementById('status').textContent === 'Paused');
    await page.locator('#randomize-mix').focus(); await page.keyboard.press('Space');
    assert.equal(await page.locator('#status').textContent(), 'Paused');
    await page.locator('#stop-button').click(); await page.waitForFunction(() => document.getElementById('status').textContent === 'Stopped');
    await page.locator('#reset-mix').click(); assert.equal(await page.locator('#active-count').textContent(), '0 layers');

    for (const theme of ['light', 'dark', 'green', 'cyberpunk', 'matrix']) {
      await page.locator('#theme-mode').selectOption(theme);
      for (const width of [320, 390, 480, 650, 651, 768, 830, 1101, 1365]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.locator('#status').evaluate((span) => { span.textContent = 'Session complete'; });
        const bounds = await page.evaluate(() => {
          const selectors = ['#play-button', '#stop-button', '#reset-mix', '#randomize-mix', '#restore-mix', '.transport-status', '#remaining', '#duration', '#master-level'];
          const boxes = selectors.map((id) => ({ id, box: document.querySelector(id).getBoundingClientRect() }));
          const outside = boxes.filter(({ box }) => box.left < -1 || box.right > innerWidth + 1).map(({ id }) => id);
          const overlaps = boxes.flatMap((a, index) => boxes.slice(index + 1).filter((b) => Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left) > 1 && Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top) > 1).map((b) => [a.id, b.id]));
          const button = document.getElementById('randomize-mix').getBoundingClientRect(), icon = document.querySelector('#randomize-mix img').getBoundingClientRect();
          return { overflow: document.documentElement.scrollWidth > innerWidth, outside, overlaps, button: [button.width, button.height], icon: [icon.width, icon.height] };
        });
        assert.deepEqual(bounds, { overflow: false, outside: [], overlaps: [], button: [52, 48], icon: [24, 24] }, theme + '/' + width);
        if (['dark', 'matrix'].includes(theme) && [320, 830, 1365].includes(width)) await page.locator('.transport-bar').screenshot({ path: fileURLToPath(new URL('dice-' + theme + '-' + width + '.png', output)) });
      }
    }
    const rendered = await page.evaluate(async () => {
      const { randomMix } = await import('./src/random-mix.mjs');
      const { defaultMix } = await import('./src/mix-state.mjs');
      const { AudioEngine } = await import('./src/audio-engine.js');
      const { renderPcm } = await import('./src/wav-export.mjs');
      const engine = new AudioEngine(), rows = []; engine.update(defaultMix());
      try {
        for (let i = 0; i < 12; i++) {
          const mix = randomMix(defaultMix(), { advanced: true }); let peak = 0, energy = 0, finite = true, frames = 0;
          for await (const { left, right } of renderPcm(mix, 1, 44100, (id) => engine.buffer(id), () => {})) {
            frames += left.length;
            for (const data of [left, right]) for (const sample of data) { finite &&= Number.isFinite(sample); peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
          }
          rows.push({ mode: mix.mode, frames, finite, peak, rms: Math.sqrt(energy / (frames * 2)) });
        }
        return rows;
      } finally { await engine.context?.close(); }
    });
    assert(rendered.every((row) => row.frames === 44100 && row.finite && row.peak < 1 && row.rms > .000001), JSON.stringify(rendered));

    portable = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const portableUrl = url + 'random-portable-check.html', blocked = [], html = await readFile(new URL('../Hz Mixer.html', import.meta.url));
    portable.on('pageerror', (error) => errors.push(error.message));
    await portable.route('**/*', (route) => {
      if (route.request().url() === portableUrl) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
      blocked.push(route.request().url()); return route.abort();
    });
    await portable.goto(portableUrl, { waitUntil: 'networkidle' });
    for (let i = 0; i < 5; i++) await portable.locator('#randomize-mix').click();
    const rolled = await portable.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.current.v1')));
    assert.equal(rolled.selection, 'custom'); assert.deepEqual(rolled.mix.studio, defaultStudio());
    assert.equal(await portable.locator('#status').textContent(), 'Ready');
    assert(await portable.locator('#randomize-mix img').evaluate((image) => image.complete && image.naturalWidth > 0));
    assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
    await writeFile(new URL('randomize-evidence.json', output), JSON.stringify({ rendered, version: exported.version, blocked, errors }, null, 2));
    console.log('Randomize: real rolls, Simple/Advanced, timing/master/mute preservation, library/favorites, keyboard, live/pause, PCM renders, responsive themes and portable offline passed');
  } finally { await portable?.close(); await page.close(); }
}
