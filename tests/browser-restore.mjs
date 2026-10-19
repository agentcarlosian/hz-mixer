import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function restoreRegressions(browser, url, output) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 1000 } });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const current = () => page.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.current.v1')));
  const storedLibrary = () => page.evaluate(() => localStorage.getItem('beat-mixer.library.v1'));
  const save = async (name) => { await page.locator('#save-mix').click(); await page.locator('#mix-name').fill(name); await page.locator('#save-form button[type="submit"]').click(); };
  const commit = async (id, value) => { await page.locator(id).fill(String(value)); await page.locator(id).press('Tab'); };
  let portable;
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto(url, { waitUntil: 'networkidle' });
    assert(await page.locator('#restore-mix').isVisible()); assert(await page.locator('#restore-mix').isDisabled());
    assert.equal(await page.locator('#randomize-mix').evaluate((button) => button.nextElementSibling.id), 'restore-mix');
    assert.equal(await page.locator('#restore-mix').getAttribute('data-tooltip'), 'Restore previous mix');
    await page.locator('#mix-select').selectOption('preset:session-current-embers');
    await page.locator('#favorite-mix').click(); const before = await current();
    const favorites = await page.evaluate(() => localStorage.getItem('beat-mixer.favorites.v1'));
    await page.locator('#reset-mix').click(); assert(await page.locator('#restore-mix').isEnabled());
    await page.locator('#theme-mode').selectOption('dark'); await page.locator('[data-view="spectrum"]').click();
    await page.locator('#preset-search').fill('gamma');
    await page.locator('#restore-mix').click(); const restored = await current();
    assert.deepEqual(restored.mix, before.mix); assert.equal(restored.selection, before.selection); assert.equal(restored.name, before.name);
    assert.equal(restored.view, 'spectrum'); assert.equal(await page.locator('#mix-select').inputValue(), before.selection);
    assert(await page.locator('#restore-mix').isDisabled()); assert.equal(await page.locator('#status').textContent(), 'Ready');
    assert.equal(await page.locator('#mix-action-status').textContent(), 'Previous mix restored');
    await page.locator('#preset-search').fill('');
    await page.locator('#randomize-mix').click(); const firstRoll = await current();
    await page.locator('#randomize-mix').click(); assert.notDeepEqual((await current()).mix, firstRoll.mix);
    await page.locator('#restore-mix').focus(); await page.keyboard.press('Space');
    assert.deepEqual((await current()).mix, firstRoll.mix); assert(await page.locator('#restore-mix').isDisabled());
    const oneStep = await current(); await page.locator('#restore-mix').evaluate((button) => button.click());
    assert.deepEqual(await current(), oneStep, 'Restore cannot reach an older action or create redo');
    await page.locator('#randomize-mix').click(); await commit('#master-level-number', 23);
    assert(await page.locator('#restore-mix').isDisabled(), 'manual edits clear restoration');
    await page.locator('#randomize-mix').click(); await page.locator('#mix-select').selectOption('preset:theta-783');
    assert(await page.locator('#restore-mix').isDisabled(), 'loading a preset clears restoration');
    await page.locator('#randomize-mix').click(); const persisted = await current(); await page.reload();
    assert.deepEqual((await current()).mix, persisted.mix); assert(await page.locator('#restore-mix').isDisabled(), 'restore point is not persisted');

    await page.locator('#mix-select').selectOption('preset:theta-three-carriers'); await save('Before Restore');
    const saved = await current(), libraryBefore = await storedLibrary();
    await page.locator('#reset-mix').click(); await page.locator('#restore-mix').click();
    assert.deepEqual((await current()).mix, saved.mix); assert.equal((await current()).selection, saved.selection);
    assert.equal(await storedLibrary(), libraryBefore);
    await page.locator('#reset-mix').click(); await save('Before Restore');
    const overwrittenLibrary = await storedLibrary();
    await page.locator('#restore-mix').click();
    assert.deepEqual((await current()).mix, saved.mix); assert.equal((await current()).selection, 'custom', 'an overwritten entry is not falsely reselected');
    assert.equal(await storedLibrary(), overwrittenLibrary, 'Restore does not undo deliberate library changes');
    assert.equal(await page.evaluate(() => localStorage.getItem('beat-mixer.favorites.v1')), favorites);

    await page.locator('#mix-select').selectOption('preset:theta-783');
    await commit('#fade-in', 0); await commit('#fade-out', 0);
    const playingMix = (await current()).mix;
    await page.locator('#play-button').click(); await page.waitForFunction(() => document.getElementById('status').textContent === 'Playing');
    await page.locator('#randomize-mix').click(); await page.locator('#restore-mix').click();
    assert.deepEqual((await current()).mix, playingMix); assert.equal(await page.locator('#status').textContent(), 'Playing');
    await page.locator('#play-button').click(); await page.waitForFunction(() => document.getElementById('status').textContent === 'Paused');
    const pausedMix = (await current()).mix;
    await page.locator('#reset-mix').click(); await page.locator('#restore-mix').click();
    assert.deepEqual((await current()).mix, pausedMix); assert.equal(await page.locator('#status').textContent(), 'Paused');
    await page.locator('#stop-button').click(); await page.waitForFunction(() => document.getElementById('status').textContent === 'Stopped');
    await page.locator('#randomize-mix').click();
    for (const theme of ['light', 'dark', 'green', 'cyberpunk', 'matrix']) {
      await page.locator('#theme-mode').selectOption(theme);
      for (const width of [320, 390, 480, 568, 650, 651, 720, 760, 761, 768, 830, 1101, 1365]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.locator('#status').evaluate((element) => { element.textContent = 'Session complete'; });
        const layout = await page.evaluate(() => {
          const ids = ['#play-button', '#stop-button', '.transport-status', '#reset-mix', '#randomize-mix', '#restore-mix', '#remaining', '#duration', '#master-level', '#master-level-number'];
          const boxes = ids.map((id) => ({ id, box: document.querySelector(id).getBoundingClientRect() }));
          const outside = boxes.filter(({ box }) => box.left < -1 || box.right > innerWidth + 1).map(({ id }) => id);
          const overlaps = boxes.flatMap((a, index) => boxes.slice(index + 1).filter((b) => Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left) > 1 && Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top) > 1).map((b) => [a.id, b.id]));
          const button = document.getElementById('restore-mix').getBoundingClientRect(), icon = document.querySelector('#restore-mix img').getBoundingClientRect();
          return { overflow: document.documentElement.scrollWidth > innerWidth, outside, overlaps, button: [button.width, button.height], icon: [icon.width, icon.height] };
        });
        assert.deepEqual(layout, { overflow: false, outside: [], overlaps: [], button: [52, 48], icon: [24, 24] }, theme + '/' + width);
        if (['dark', 'matrix'].includes(theme) && [320, 390, 1365].includes(width)) await page.locator('.transport-bar').screenshot({ path: fileURLToPath(new URL('restore-' + theme + '-' + width + '.png', output)) });
      }
    }
    portable = await browser.newPage({ viewport: { width: 390, height: 900 } });
    const portableUrl = url + 'restore-portable-check.html', blocked = [], html = await readFile(new URL('../Hz Mixer.html', import.meta.url));
    portable.on('pageerror', (error) => errors.push(error.message));
    await portable.route('**/*', (route) => {
      if (route.request().url() === portableUrl) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
      blocked.push(route.request().url()); return route.abort();
    });
    await portable.goto(portableUrl, { waitUntil: 'networkidle' });
    assert(await portable.locator('#restore-mix').isDisabled());
    await portable.locator('#mix-select').selectOption('preset:sweep-rain-783-45');
    const portableBefore = await portable.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.current.v1')));
    await portable.locator('#randomize-mix').click(); await portable.locator('#restore-mix').click();
    const portableAfter = await portable.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.current.v1')));
    assert.deepEqual(portableAfter.mix, portableBefore.mix); assert.equal(portableAfter.selection, portableBefore.selection);
    assert(await portable.locator('#restore-mix').isDisabled()); assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
    await writeFile(new URL('restore-evidence.json', output), JSON.stringify({ oneStep: true, selection: restored.selection, savedSelection: saved.selection, playing: true, paused: true, blocked, errors }, null, 2));
    console.log('Restore: one-step Reset/Dice snapshots, keyboard, selection/library integrity, edit/load/reload clearing, playing/paused state, responsive themes and portable offline passed');
  } finally { await portable?.close(); await page.close(); }
}
