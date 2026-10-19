import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

export async function resetRegressions(browser, url, output) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 1000 } });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url);
    assert.equal(await page.locator('.library-bar #reset-mix').count(), 0);
    assert.equal(await page.locator('.transport #reset-mix').count(), 1);
    assert.equal(await page.locator('#reset-mix').getAttribute('data-tooltip'), 'Reset mixer');
    for (const field of await page.locator('[data-enable]').all()) assert.equal(await field.isChecked(), false, 'fresh environment/noise/bells are off');
    assert(await page.locator('.transport-status').evaluate((status) => Boolean(status.compareDocumentPosition(document.getElementById('reset-mix')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    for (const theme of ['light', 'dark', 'green', 'cyberpunk', 'matrix']) {
      await page.locator('#theme-mode').selectOption(theme);
      for (const width of [320, 390, 480, 568, 640, 650, 651, 768, 830, 1101, 1365]) {
        await page.setViewportSize({ width, height: 1000 });
        const layout = await page.evaluate(() => {
          const ids = ['#play-button', '#stop-button', '#reset-mix', '#randomize-mix', '#restore-mix', '.transport-status', '#remaining', '#duration', '#master-mute', '#master-level'];
          const rects = ids.map((id) => ({ id, rect: document.querySelector(id).getBoundingClientRect() }));
          const bar = document.querySelector('.transport-bar').getBoundingClientRect();
          const outside = rects.filter(({ rect }) => rect.left < bar.left - 1 || rect.right > bar.right + 1 || rect.top < bar.top - 1 || rect.bottom > bar.bottom + 1).map(({ id }) => id);
          const overlap = rects.flatMap((a, i) => rects.slice(i + 1).filter((b) => Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 1 && Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > 1).map((b) => [a.id, b.id]));
          const reset = document.getElementById('reset-mix').getBoundingClientRect(), icon = document.querySelector('#reset-mix img').getBoundingClientRect();
          return { overflow: document.documentElement.scrollWidth > innerWidth, outside, overlap, button: [reset.width, reset.height], icon: [icon.width, icon.height] };
        });
        assert.deepEqual(layout, { overflow: false, outside: [], overlap: [], button: [52, 48], icon: [24, 24] }, theme + ' at ' + width);
        if (['dark', 'matrix'].includes(theme) && [320, 390, 830, 1365].includes(width)) await page.locator('.transport-bar').screenshot({ path: fileURLToPath(new URL('reset-' + theme + '-' + width + '.png', output)) });
      }
    }
    await page.locator('#theme-mode').selectOption('dark');
    for (const [id, value] of [['#beat-value', '5.88'], ['#carrier-value', '8']]) { await page.locator(id).fill(value); await page.locator(id).press('Tab'); }
    await page.locator('button[data-interface-mode="advanced"]').click();
    await page.locator('[data-tone-source="voice-2"]').click();
    await page.locator('[data-voice-id="voice-2"][data-voice-key="enabled"]').check();
    await page.locator('[data-voice-id="voice-2"][data-voice-key="mode"]').selectOption('isochronic');
    await page.locator('#save-mix').click(); await page.locator('#mix-name').fill('Reset control check'); await page.locator('#save-form button[type="submit"]').click();
    const saved = await page.evaluate(() => localStorage.getItem('beat-mixer.library.v1'));
    await page.locator('[data-enable="stream"]').check();
    await page.locator('#reset-mix').click();
    assert.equal(await page.locator('#beat-value').inputValue(), '8.00');
    assert.equal(await page.locator('#carrier-value').inputValue(), '200');
    assert.equal(await page.locator('[data-voice-id="voice-2"][data-voice-key="enabled"]').isChecked(), false);
    assert.equal(await page.locator('#active-count').textContent(), '0 layers');
    assert.equal(await page.locator('#status').textContent(), 'Ready');
    for (const field of await page.locator('[data-enable]').all()) assert.equal(await field.isChecked(), false, 'Reset leaves all environmental sources off');
    await page.reload();
    for (const field of await page.locator('[data-enable]').all()) assert.equal(await field.isChecked(), false, 'reset off state survives reload');
    assert.equal(await page.evaluate(() => localStorage.getItem('beat-mixer.library.v1')), saved);
    assert.equal(await page.locator('#theme-mode').inputValue(), 'dark');
    await page.locator('#play-button').click(); await page.waitForFunction(() => document.getElementById('status').textContent === 'Playing');
    await page.locator('#beat-value').fill('12'); await page.locator('#beat-value').press('Tab');
    await page.locator('#reset-mix').click();
    assert.equal(await page.locator('#beat-value').inputValue(), '8.00');
    assert.equal(await page.locator('#status').textContent(), 'Playing');
    await page.locator('#play-button').click(); await page.waitForFunction(() => document.getElementById('status').textContent === 'Paused');
    await page.locator('#reset-mix').click(); assert.equal(await page.locator('#status').textContent(), 'Paused');
    assert.equal(await page.evaluate(() => localStorage.getItem('beat-mixer.library.v1')), saved);
    assert.deepEqual(errors, []);
    console.log('Reset: larger playback control, all-theme responsive geometry, defaults and saved-library/playback preservation passed');
  } finally { await page.close(); }
}
