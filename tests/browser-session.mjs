import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setStageDuration, openStageChanges } from './browser-mixer-helpers.mjs';

export async function sessionEditorRegressions(browser, url, output) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 1000 }, acceptDownloads: true });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.current.v1')).mix);
  const commit = async (selector, value) => { await page.locator(selector).fill(String(value)); await page.locator(selector).press('Tab'); };
  try {
    await page.goto(url);
    await commit('#beat-value', 7.83);
    await page.locator('input[name="program"][value="sweep"]').check();
    assert(await page.locator('#fixed-rate-control').isHidden() && await page.locator('#beat-value').isDisabled());
    assert(await page.locator('#carrier-value').isVisible() && await page.locator('#sweep-start').isVisible());
    await page.locator('#beat-value').evaluate((input) => { input.value = '30'; for (const type of ['input', 'change', 'blur']) input.dispatchEvent(new Event(type, { bubbles: true })); });
    assert.equal((await stored()).automation.kind, 'sweep'); assert.equal((await stored()).beat, 7.83);
    await commit('#carrier-value', 260); assert.equal((await stored()).automation.kind, 'sweep');
    await page.locator('input[name="program"][value="fixed"]').check();
    assert.equal(await page.locator('#beat-value').inputValue(), '7.83');
    await page.locator('input[name="program"][value="sequence"]').check();
    assert(await page.locator('#beat-value').isHidden() && await page.locator('#beat-rate').isDisabled());
    assert(await page.locator('#session-builder').evaluate((editor) => Boolean(editor.closest('.generator-stack')) && Boolean(editor.compareDocumentPosition(document.querySelector('.frequency-controls')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    const first = page.locator('[data-stage="0"]');
    assert.equal(await first.locator('[data-stage-rate-label]').textContent(), 'Rate Hz');
    assert(await first.locator('[data-stage-key="end"]').isHidden());
    assert(await first.locator('[data-stage-key="curve"]').isHidden());
    assert.equal(await first.locator('[data-stage-duration="minutes"]').inputValue(), '2');
    assert.equal(await first.locator('[data-stage-duration="seconds"]').inputValue(), '00');
    await commit('[data-stage="0"] [data-stage-key="start"]', .1);
    assert.equal(await first.locator('[data-stage-key="start"]').inputValue(), '0.10');
    await commit('[data-stage="0"] [data-stage-key="start"]', 10);
    await setStageDuration(page, 0, 5);
    assert.equal((await stored()).automation.stages[0].seconds, 5, 'minutes-to-seconds entry can pass through an intermediate zero');
    await commit('[data-stage="0"] [data-stage-duration="seconds"]', 1);
    assert.equal((await stored()).automation.stages[0].seconds, 5);
    assert.equal(await first.locator('[data-stage-duration="seconds"]').inputValue(), '05');
    assert((await page.locator('#stage-error').textContent()).includes('5 seconds'));
    await setStageDuration(page, 0, 125);
    assert.equal((await stored()).automation.stages[0].seconds, 125);
    await first.locator('[data-stage-key="type"]').selectOption('sweep');
    assert.equal(await first.locator('[data-stage-rate-label]').textContent(), 'Start Hz');
    assert(await first.locator('[data-stage-key="end"]').isVisible());
    await first.locator('[data-stage-key="start"]').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.stageKey), 'end');
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.dataset.stageDuration), 'minutes');
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.dataset.stageDuration), 'seconds');
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.dataset.stageKey), 'curve');
    await first.locator('[data-stage-key="type"]').selectOption('hold');
    await first.locator('[data-stage-key="start"]').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.stageDuration), 'minutes');
    await page.locator('button[data-interface-mode="advanced"]').click();
    assert.equal(await first.locator('.stage-changes').evaluate((details) => details.open), false);
    await openStageChanges(page, 0); await page.locator('[data-add-change="0"]').click();
    await commit('[data-stage="0"] [data-change-key="end"]', 50);
    await first.locator('.stage-changes summary').click();
    const beforeCollapse = await stored();
    await page.locator('[data-tone-source="voice-2"]').click();
    assert(await page.locator('#session-builder').evaluate((editor) => editor.parentElement.id === 'tone-editor-voice-2'));
    assert(await page.locator('[data-voice-id="voice-2"][data-voice-key="beat"]').isHidden());
    await page.locator('[data-voice-id="voice-2"][data-voice-key="program"]').selectOption('sweep');
    assert(await page.locator('[data-voice-id="voice-2"][data-voice-key="beat"]').isHidden());
    await page.locator('[data-tone-source="tone"]').click();
    assert.deepEqual((await stored()).automation, beforeCollapse.automation);
    assert.equal(await first.locator('.stage-changes').evaluate((details) => details.open), false, 'collapse state survives source navigation');
    await first.locator('[data-stage-action="down"]').click();
    assert.equal((await stored()).automation.stages[1].seconds, 125);
    assert.equal((await stored()).automation.stages[1].lanes[0].end, 50);
    await page.locator('[data-stage="1"] [data-stage-action="up"]').click();
    await page.locator('#open-export').click(); await page.locator('[data-export-tab="mix"]').click();
    const pending = page.waitForEvent('download'); await page.locator('#download-export').click();
    const exported = JSON.parse(await readFile(await (await pending).path(), 'utf8'));
    assert.equal(exported.mix.automation.stages[0].seconds, 125);
    assert.equal(exported.mix.automation.stages[0].lanes[0].end, 50);
    await page.locator('#cancel-export').click(); await page.reload();
    assert.equal(await page.locator('[data-stage="0"] [data-stage-duration="minutes"]').inputValue(), '2');
    assert.equal(await page.locator('[data-stage="0"] [data-stage-duration="seconds"]').inputValue(), '05');
    await setStageDuration(page, 0, 3600);
    await page.locator('[data-stage="2"] [data-stage-action="remove"]').click();
    await setStageDuration(page, 1, 3600);
    assert.equal(await page.locator('#session-total').textContent(), '120:00');
    assert(await page.locator('#add-stage').isDisabled());
    await commit('[data-stage="0"] [data-stage-duration="seconds"]', 1);
    assert.equal((await stored()).automation.stages[0].seconds, 3600);
    await page.locator('#reset-mix').click(); await page.locator('input[name="program"][value="sequence"]').check();
    assert.equal(await page.locator('#stage-error').textContent(), '', 'Reset clears old validation messages');
    for (let i = 3; i < 16; i++) await page.locator('#add-stage').click();
    assert.equal(await page.locator('.stage-row').count(), 16); assert(await page.locator('#add-stage').isDisabled());
    await page.locator('[data-stage="15"] [data-stage-action="remove"]').click(); assert(await page.locator('#add-stage').isEnabled());
    await page.locator('#reset-mix').click(); await page.locator('input[name="program"][value="sequence"]').check();
    for (const theme of ['light', 'dark', 'green', 'cyberpunk', 'matrix']) {
      await page.locator('#theme-mode').selectOption(theme);
      for (const width of [320, 390, 568, 768, 1101, 1365]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const mode of ['simple', 'advanced']) {
          await page.locator('button[data-interface-mode="' + mode + '"]').click();
          if (mode === 'advanced') { await openStageChanges(page, 0); if (!(await page.locator('[data-stage="0"] .stage-change-row').count())) await page.locator('[data-add-change="0"]').click(); }
          const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, clipped: [...document.querySelectorAll('#session-builder input, #session-builder select, #session-builder button, #session-builder .stage-number')].filter((element) => element.getClientRects().length && (element.getBoundingClientRect().left < -1 || element.getBoundingClientRect().right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 2)).map((element) => ({ html: element.outerHTML, width: element.clientWidth, scroll: element.scrollWidth })) }));
          assert.deepEqual(layout, { overflow: false, clipped: [] }, theme + '/' + mode + '/' + width);
          if (theme === 'dark' && [320, 390, 1365].includes(width)) await page.locator('#session-builder').screenshot({ path: fileURLToPath(new URL('session-' + mode + '-' + width + '.png', output)) });
        }
      }
    }
    assert.deepEqual(errors, []);
    console.log('Session editor: fixed-only beat input, inline stages, Hold/Sweep fields, m:ss validation, focus, collapse/reorder, JSON, limits and responsive themes passed');
  } finally { await page.close(); }
}
