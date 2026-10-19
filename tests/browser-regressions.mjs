import assert from 'node:assert/strict';
import { revealMixerControl } from './browser-mixer-helpers.mjs';
import { fileURLToPath } from 'node:url';
import { defaultMix } from '../src/mix-state.mjs';
import { makeBackup } from '../src/library.mjs';

export async function releaseRegressions(browser, url, output) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 1000 }, acceptDownloads: true });
  page.setDefaultTimeout(15000);
  try {
    await page.goto(url);
    for (const [opener, name] of [['#info-open', 'About Hz Mixer'], ['#save-mix', 'Save your mix'], ['#open-export', 'Export'], ['#open-import', 'Import mixes'], ['#privacy-open', 'Privacy'], ['#recording-credits', 'Credits and licences']]) {
      await page.locator(opener).click();
      assert(await page.getByRole('dialog', { name, exact: true }).isVisible()); await page.keyboard.press('Escape');
    }
    await page.locator('#duration').selectOption('300');
    await revealMixerControl(page, 'input[name="program"][value="sequence"]'); await page.locator('input[name="program"][value="sequence"]').check();
    const first = page.locator('[data-stage="0"]');
    await first.locator('[data-stage-key="type"]').selectOption('sweep');
    await first.locator('[data-stage-key="start"]').fill('11'); await first.locator('[data-stage-key="start"]').press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.stageKey), 'end');
    await first.locator('[data-stage-key="type"]').selectOption('hold');
    await first.locator('[data-stage-key="start"]').fill('10'); await first.locator('[data-stage-key="start"]').press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.stageDuration), 'minutes');
    await revealMixerControl(page, 'input[name="program"][value="fixed"]'); await page.locator('input[name="program"][value="fixed"]').check();
    assert.equal(await page.locator('#duration option[value="stages"]').count(), 0);
    assert.equal(await page.locator('#duration').inputValue(), '300');
    await page.locator('#duration').evaluate((select) => { select.append(new Option('Invalid stage option', 'stages')); select.value = 'stages'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    assert.equal(await page.locator('#duration').inputValue(), '300');
    await page.locator('#save-mix').click(); await page.locator('#mix-name').fill('Original 8 Hz'); await page.locator('#save-form button[type="submit"]').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.library.v1'))[0]);
    const replacement = { ...saved, name: 'Replacement 12 Hz', mix: { ...saved.mix, beat: 12 } };
    await page.locator('#open-import').click();
    await page.locator('#import-file').setInputFiles({ name: 'replacement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'hz-mixer-library', version: 2, entries: [replacement], favorites: [] })) });
    await page.locator('#import-action').selectOption('replace'); await page.locator('#confirm-import').click();
    assert.equal(await page.locator('#mix-select').inputValue(), 'custom'); assert.equal(await page.locator('#beat-value').inputValue(), '8.00');
    await page.locator('#mix-select').selectOption('saved:' + saved.id); assert.equal(await page.locator('#beat-value').inputValue(), '12.00');
    const entries = Array.from({ length: 30 }, (_, i) => ({ id: 'mix-' + i, name: 'Mix ' + i, mix: defaultMix() }));
    await page.locator('#open-import').click();
    await page.locator('#import-file').setInputFiles({ name: 'full-library.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeBackup(entries, defaultMix(), 'Current', []))) });
    await page.locator('#import-action').selectOption('replace');
    assert.equal(await page.locator('#import-current').isChecked(), false);
    assert((await page.locator('#import-capacity').textContent()).includes('30 / 30'));
    assert(await page.locator('#confirm-import').isEnabled());
    await page.locator('#import-current').check(); assert(await page.locator('#confirm-import').isDisabled());
    assert((await page.locator('#import-error').textContent()).includes('30-mix'));
    await page.locator('#import-current').uncheck();
    await page.screenshot({ path: fileURLToPath(new URL('import-capacity.png', output)) });
    await page.locator('#confirm-import').click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.library.v1')).length), 30);
  } finally { await page.close(); }

  for (const resource of ['assets/audio/stream.mp3', 'vendor/lamejs/lamejs.iife.js']) {
    const held = await browser.newPage({ acceptDownloads: true });
    held.setDefaultTimeout(15000);
    let release, requested;
    const gate = new Promise((resolve) => { release = resolve; }), hit = new Promise((resolve) => { requested = resolve; });
    const downloads = [];
    held.on('download', (download) => downloads.push(download));
    await held.addInitScript(() => {
      window.__bufferStarts = 0;
      const original = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) { window.__bufferStarts++; return original.apply(this, args); };
    });
    await held.route('**/' + resource, async (route) => { requested(); await gate; try { await route.continue(); } catch { /* Page cleanup may finish a held request. */ } });
    try {
      await held.goto(url);
      if (resource.endsWith('.mp3')) { await revealMixerControl(held, '[data-enable="stream"]'); await held.locator('[data-enable="stream"]').check(); await held.locator('#play-button').click(); await hit; }
      else { await revealMixerControl(held, '[data-enable="stream"]'); await held.locator('[data-enable="stream"]').uncheck(); }
      await held.locator('#open-export').click();
      await held.locator('#export-format').selectOption(resource.endsWith('.mp3') ? 'wav' : 'mp3');
      await held.locator('#export-seconds').fill('1'); await held.locator('#download-export').click(); await hit;
      await held.locator('#cancel-export').click();
      await held.waitForFunction(() => document.querySelector('#export-error').textContent.includes('cancelled'), null, { timeout: 2000 });
      assert(await held.locator('#cancel-export').isEnabled()); assert(await held.locator('#download-export').isEnabled());
      await held.keyboard.press('Escape'); assert(await held.locator('#export-dialog').isHidden());
      const response = held.waitForResponse((value) => value.url().endsWith(resource)); release(); await (await response).finished();
      if (resource.endsWith('.mp3')) {
        await held.waitForFunction(() => window.__bufferStarts > 0);
        assert.equal(await held.locator('#status').textContent(), 'Playing', 'shared recording load still reaches live playback');
      } else await held.waitForFunction(() => Boolean(window.lamejs?.Mp3Encoder));
      assert.equal(downloads.length, 0, 'cancelled export never produces a late download');
    } finally { release(); await held.close(); }
  }
  console.log('Release regressions: named dialogs, stage focus, timer, import capacity/selection and held-load cancellation passed');
}
