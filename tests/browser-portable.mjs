import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function portableRegressions(browser, url, output) {
  const html = await readFile(new URL('../Hz Mixer.html', import.meta.url));
  const page = await browser.newPage({ viewport: { width: 1365, height: 1000 }, acceptDownloads: true });
  const portableUrl = url + 'portable-check.html', blocked = [], errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    if (route.request().url() === portableUrl) await route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
    else { blocked.push(route.request().url()); await route.abort(); }
  });
  const commit = async (selector, value) => { await page.locator(selector).fill(String(value)); await page.locator(selector).press('Tab'); };
  try {
    await page.goto(portableUrl, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#status').textContent(), 'Ready');
    for (const [id, name] of [['bell-33', 'Singing Bowl I'], ['bell-37', 'Singing Bowl II']]) {
      assert.equal(await page.locator('[data-sound="' + id + '"] h3').textContent(), name);
      assert.equal(await page.locator('[data-enable="' + id + '"]').getAttribute('aria-label'), 'Enable ' + name);
    }
    for (const field of await page.locator('[data-enable]').all()) assert.equal(await field.isChecked(), false);
    const repeat = page.locator('[data-repeat="bell-37"]');
    await repeat.press('ArrowDown'); assert.equal(await repeat.inputValue(), '0.75');
    await page.locator('[data-repeat-adjust="bell-37"][data-step="-1"]').click();
    assert.equal(await repeat.inputValue(), '0.5');
    await commit('[data-repeat="bell-37"]', .3333);
    assert(await repeat.evaluate((input) => input.checkValidity()));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.current.v1')).mix.bells['bell-37'].interval), 20);
    await page.locator('button[data-interface-mode="advanced"]').click();
    await page.locator('[data-tone-source="voice-2"]').click();
    await page.locator('[data-voice-id="voice-2"][data-voice-key="enabled"]').check();
    await page.locator('[data-voice-id="voice-2"][data-voice-key="mode"]').selectOption('isochronic');
    await page.locator('[data-tone-source="tone"]').click();
    await page.locator('input[name="program"][value="sweep"]').check();
    await commit('#sweep-start', 12); await commit('#sweep-end', 4); await commit('#sweep-seconds', 5);
    await page.locator('#open-export').click(); await page.locator('[data-export-tab="mix"]').click();
    let pending = page.waitForEvent('download'); await page.locator('#download-export').click();
    const mix = JSON.parse(await readFile(await (await pending).path(), 'utf8'));
    assert.equal(mix.version, 6); assert.equal(mix.mix.studio.voices[0].mode, 'isochronic');
    await page.locator('[data-export-tab="audio"]').click(); await commit('#export-seconds', 1);
    const sizes = {};
    for (const format of ['wav', 'mp3']) {
      await page.locator('#export-format').selectOption(format);
      pending = page.waitForEvent('download'); await page.locator('#download-export').click();
      const bytes = await readFile(await (await pending).path()); sizes[format] = bytes.length;
      assert(format === 'wav' ? bytes.length === 44 + 44100 * 4 && bytes.toString('ascii', 0, 4) === 'RIFF' : bytes.length > 1000);
    }
    await page.locator('#cancel-export').click();
    await page.locator('[data-enable="window-rain"]').check(); await page.locator('[data-enable="bell-37"]').check();
    await page.locator('#play-button').click();
    await page.waitForFunction(() => document.getElementById('status').textContent === 'Playing' && ['window-rain', 'bell-37'].every((id) => document.querySelector('[data-track-state="' + id + '"]').textContent === ''));
    await page.locator('#reset-mix').click();
    assert.equal(await page.locator('#status').textContent(), 'Playing');
    assert.equal(await page.locator('#active-count').textContent(), '0 layers');
    for (const field of await page.locator('[data-enable]').all()) assert.equal(await field.isChecked(), false);
    await page.locator('#info-open').click(); await page.locator('#guide-link').click();
    await page.waitForFunction(() => !document.getElementById('guide-page').hidden);
    assert(await page.locator('#guide-listening-safety').isVisible());
    await page.locator('.guide-header .button').click();
    await page.waitForFunction(() => document.getElementById('guide-page').hidden);
    assert.equal(await page.locator('#status').textContent(), 'Playing');
    assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
    await page.screenshot({ path: fileURLToPath(new URL('portable-runtime.png', output)) });
    await writeFile(new URL('portable-runtime.json', output), JSON.stringify({ sizes, version: mix.version, blocked, errors }, null, 2));
    console.log('Portable bytes: inline runtime, sub-minute bell arrows, mixed sweep, embedded recordings/bell/encoder, WAV/MP3, Reset and guide passed with additional requests blocked');
  } finally { await page.close(); }
}
