import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PRESETS } from '../src/mix-state.mjs';

export async function presetRegressions(browser, url, output) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 1000 }, acceptDownloads: true });
  const errors = [], requests = [], responses = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  page.on('response', (response) => { if (response.status() >= 400) responses.push(response.url()); });
  const current = () => page.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.current.v1')));
  let portable;
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#mix-select optgroup option').count(), 61);
    for (const preset of PRESETS) {
      await page.locator('#mix-select').selectOption('preset:' + preset.id);
      const saved = await current();
      assert.equal(saved.selection, 'preset:' + preset.id);
      assert.deepEqual(saved.mix, preset.mix, preset.id + ' loads every setting');
      assert.equal(await page.locator('#status').textContent(), 'Ready', preset.id + ' does not autoplay');
      assert.equal(await page.locator('.app-shell').getAttribute('data-interface-mode'), 'simple');
      assert.equal(await page.locator('#signal-error').textContent(), '');
    }
    assert(!requests.some((request) => /\.(mp3|wav)$/.test(request)), 'selecting presets while stopped keeps recordings lazy');
    await page.locator('#preset-search').fill('dual sweep');
    assert.equal(await page.locator('#mix-select optgroup option').count(), 2);
    await page.locator('#mix-select').selectOption('preset:sweep-rain-783-45');
    await page.locator('#favorite-mix').click(); await page.locator('#favorites-only').check();
    assert.equal(await page.locator('#mix-select optgroup option').count(), 1);
    assert.equal(await page.locator('#mix-select optgroup option').getAttribute('value'), 'preset:sweep-rain-783-45');
    await page.locator('#favorites-only').uncheck(); await page.locator('#preset-search').fill('');
    await page.locator('#save-mix').click(); await page.locator('#mix-name').fill('Rain dual sweep');
    await page.locator('#save-form button[type="submit"]').click();
    const entry = await page.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.library.v1'))[0]);
    await page.locator('#reset-mix').click(); await page.locator('#mix-select').selectOption('saved:' + entry.id);
    assert.deepEqual((await current()).mix, PRESETS.find(({ id }) => id === 'sweep-rain-783-45').mix);
    await page.locator('#mix-select').selectOption('preset:sweep-rain-783-45'); await page.reload();
    assert.equal(await page.locator('#mix-select').inputValue(), 'preset:sweep-rain-783-45');
    assert.equal(await page.locator('#favorite-mix').getAttribute('aria-pressed'), 'true');
    assert(await page.locator('#advanced-status').isVisible());
    await page.locator('#open-export').click(); await page.locator('[data-export-tab="mix"]').click();
    const downloading = page.waitForEvent('download'); await page.locator('#download-export').click();
    const exported = JSON.parse(await readFile(await (await downloading).path(), 'utf8'));
    assert.equal(exported.version, 6); assert.deepEqual(exported.mix, entry.mix);
    await page.locator('#cancel-export').click();

    const rendered = await page.evaluate(async () => {
      const { PRESETS } = await import('./src/mix-state.mjs');
      const { AudioEngine } = await import('./src/audio-engine.js');
      const { renderPcm } = await import('./src/wav-export.mjs');
      const engine = new AudioEngine(), rows = [];
      engine.update(PRESETS[37].mix);
      try {
        for (const { id, mix } of PRESETS.slice(37)) {
          let peak = 0, energy = 0, frames = 0, finite = true;
          for await (const { left, right } of renderPcm(mix, 1, 44100, (sound) => engine.buffer(sound), () => {})) {
            frames += left.length;
            for (const channel of [left, right]) for (const sample of channel) {
              finite = finite && Number.isFinite(sample); peak = Math.max(peak, Math.abs(sample)); energy += sample * sample;
            }
          }
          rows.push({ id, frames, finite, peak, rms: Math.sqrt(energy / (frames * 2)) });
        }
        return rows;
      } finally { await engine.context?.close(); }
    });
    assert.equal(rendered.length, 24);
    for (const row of rendered) {
      assert.equal(row.frames, 44100, row.id); assert(row.finite, row.id);
      assert(row.peak > .00001 && row.peak < 1 && row.rms > .000001, JSON.stringify(row));
    }
    await page.locator('#mix-select').selectOption('preset:session-current-embers');
    assert(await page.locator('input[name="program"][value="sequence"]').isChecked());
    assert.equal(await page.locator('#stage-list [data-stage]').count(), 5);
    assert(await page.locator('#advanced-status').isVisible());
    await page.locator('button[data-interface-mode="advanced"]').click();
    await page.locator('#theme-mode').selectOption('dark');
    await page.screenshot({ path: fileURLToPath(new URL('preset-session-desktop.png', output)), fullPage: true });
    for (const width of [320, 390, 768, 1365]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'session at ' + width);
    }

    portable = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const portableUrl = url + 'presets-portable-check.html', blocked = [];
    const html = await readFile(new URL('../Hz Mixer.html', import.meta.url));
    portable.on('pageerror', (error) => errors.push(error.message));
    await portable.route('**/*', (route) => {
      if (route.request().url() === portableUrl) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
      blocked.push(route.request().url()); return route.abort();
    });
    await portable.goto(portableUrl, { waitUntil: 'networkidle' });
    assert.equal(await portable.locator('#mix-select optgroup option').count(), 61);
    for (const preset of PRESETS.slice(37)) {
      await portable.locator('#mix-select').selectOption('preset:' + preset.id);
      const mix = await portable.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.current.v1')).mix);
      assert.deepEqual(mix, preset.mix, 'portable ' + preset.id);
      assert.equal(await portable.locator('#status').textContent(), 'Ready');
      assert(await portable.evaluate(() => document.documentElement.scrollWidth <= innerWidth), preset.id);
    }
    await portable.locator('#mix-select').selectOption('preset:sweep-rain-783-45');
    await portable.locator('#theme-mode').selectOption('dark');
    await portable.screenshot({ path: fileURLToPath(new URL('preset-sweep-mobile.png', output)), fullPage: true });
    assert.deepEqual(blocked, []); assert.deepEqual(errors, []); assert.deepEqual(responses, []);
    await writeFile(new URL('preset-evidence.json', output), JSON.stringify({ count: PRESETS.length, rendered, version: exported.version, blocked, errors, responses }, null, 2));
    console.log('Presets: all 61 selections, 24 native PCM renders, dual sweeps/session settings, favorites, saved mixes, v6 export and portable network-blocked selections passed');
  } finally { await portable?.close(); await page.close(); }
}
