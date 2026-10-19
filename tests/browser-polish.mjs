import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PRESETS } from '../src/mix-state.mjs';
import { matchesMixSearch } from '../src/mix-display.mjs';

export async function polishRegressions(browser, url, output) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 1000 } });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.current.v1')).mix);
  const enter = async (selector, value, key = 'Tab') => { await page.locator(selector).fill(String(value)); await page.locator(selector).press(key); };
  let portable;
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-percent-source]').count(), 15);
    await enter('#master-level-number', 47, 'Enter'); assert.equal((await state()).master, 47);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'master-level-number');
    await enter('#tone-level-number', 26); assert.equal((await state()).toneLevel, 26);
    const ids = ['cascade', 'stream', 'storm', 'waves', 'campfire', 'window-rain', 'white', 'pink', 'brown', 'bell-33', 'bell-37'];
    for (const [index, id] of ids.entries()) {
      await enter('#level-' + id + '-number', 24 - index);
      const mix = await state(), config = mix.sounds[id] || mix.noise[id] || mix.bells[id];
      assert.equal(config.level, 24 - index); assert.equal(config.enabled, false);
      assert.equal(await page.locator('[data-volume="' + id + '"]').inputValue(), String(24 - index));
    }
    for (const value of [0, 100]) { await enter('#master-level-number', value); assert.equal((await state()).master, value); }
    for (const value of ['', '-1', '101']) { await enter('#master-level-number', value); assert.equal((await state()).master, 100); assert.equal(await page.locator('#master-level-number').inputValue(), '100'); }
    await page.locator('#master-level-number').fill('25'); await page.locator('#master-level-number').press('Escape');
    assert.equal((await state()).master, 100); assert.equal(await page.locator('#master-level-number').inputValue(), '100');
    await enter('#tone-level-number', 37.6, 'Enter'); assert.equal((await state()).toneLevel, 38);
    assert.equal(await page.locator('#tone-level-number').inputValue(), '38');
    await page.locator('#tone-level').focus();
    await page.locator('#tone-level').evaluate((range) => { range.value = '31'; range.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.locator('#tone-level-number').inputValue(), '31');
    await page.locator('button[data-interface-mode="advanced"]').click(); await page.locator('[data-tone-source="voice-2"]').click();
    await enter('#level-voice-2-number', 41.25, 'Enter'); assert.equal((await state()).studio.voices[0].level, 41.25);
    assert.equal(await page.locator('#level-voice-2-number').inputValue(), '41.25');
    assert.equal((await state()).studio.voices[0].enabled, false);
    await page.locator('[data-tone-source="voice-3"]').click(); await enter('#level-voice-3-number', 19);
    assert.equal((await state()).studio.voices[1].level, 19);
    await page.reload(); assert.equal(await page.locator('#level-voice-2-number').inputValue(), '41.25');
    for (const query of ['Gamma', 'theta isochronic sweep', 'session', 'environment singing bowl']) {
      await page.locator('#preset-search').fill(query);
      const actual = await page.locator('#mix-select optgroup option').evaluateAll((options) => options.map((option) => option.value.replace('preset:', '')));
      assert.deepEqual(actual.sort(), PRESETS.filter((preset) => matchesMixSearch(preset, query)).map(({ id }) => id).sort());
    }
    await page.locator('#preset-search').fill('');
    await page.locator('#mix-select').selectOption('preset:sweep-rain-783-45');
    assert.equal(await page.locator('#preset-summary').textContent(), '2 tones / Binaural + Isochronic / Sweep 7.83 to 4.50 Hz');
    await page.locator('#mix-select').selectOption('preset:session-current-embers');
    assert((await page.locator('#preset-summary').textContent()).includes('Session 18.00 to 6.00 Hz'));

    await page.locator('#reset-mix').hover(); await page.waitForFunction(() => !document.getElementById('control-tooltip').hidden);
    assert.equal(await page.locator('#control-tooltip').textContent(), 'Reset mixer');
    assert.equal(await page.locator('#reset-mix').getAttribute('title'), null, 'native tooltip is replaced');
    assert((await page.locator('#reset-mix').getAttribute('aria-describedby')).includes('control-tooltip'));
    await page.keyboard.press('Escape'); assert(await page.locator('#control-tooltip').isHidden());
    await page.locator('#reset-mix').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'randomize-mix');
    assert.equal(await page.locator('#control-tooltip').textContent(), 'Randomize mix');
    await page.keyboard.press('Escape');
    await page.locator('[data-tone-source="tone"]').click(); await page.locator('[data-open-effects="tone"]').click();
    await page.locator('#close-source-effects').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('#control-tooltip').evaluate((tip) => tip.closest('dialog')?.id), 'source-effects');
    await page.keyboard.press('Escape'); assert(await page.locator('#source-effects').isHidden());
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const [id, end] of [['reset-mix', 'rotate(-360deg)'], ['randomize-mix', 'rotate(360deg)']]) {
      await page.locator('#' + id).click();
      const motion = await page.locator('#' + id + ' img').evaluate((icon) => icon.getAnimations().find((animation) => animation.playState === 'running')?.effect.getKeyframes().at(-1).transform);
      assert(motion?.endsWith(end), id + ': ' + motion);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const id of ['reset-mix', 'randomize-mix']) {
      await page.locator('#' + id).click(); assert.equal(await page.locator('#' + id + ' img').evaluate((icon) => icon.getAnimations().length), 0);
    }
    await page.locator('#mix-select').selectOption('preset:ambience-campfire');
    assert((await page.locator('[data-sound="campfire"] img').first().getAttribute('src')).endsWith('/campfire.svg'));
    await page.locator('#theme-mode').selectOption('dark');
    await page.locator('[data-sound="campfire"]').screenshot({ path: fileURLToPath(new URL('campfire-control.png', output)) });
    for (const theme of ['light', 'dark', 'green', 'cyberpunk', 'matrix']) {
      await page.locator('#theme-mode').selectOption(theme);
      for (const width of [320, 390, 568, 650, 651, 768, 1101, 1365]) {
        await page.setViewportSize({ width, height: 1000 });
        const clips = await page.evaluate(() => [...document.querySelectorAll('.app-shell input, .app-shell button, .app-shell select')].filter((element) => element.getClientRects().length && (element.getBoundingClientRect().left < -1 || element.getBoundingClientRect().right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 2)).map((element) => element.id || element.outerHTML));
        assert.deepEqual(clips, [], theme + '/' + width);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.mouse.move(0, 0); await page.locator('#randomize-mix').hover();
        try { await page.waitForFunction(() => !document.getElementById('control-tooltip').hidden, null, { timeout: 3000 }); }
        catch (error) {
          const details = await page.locator('#randomize-mix').evaluate((button) => ({ button: button.outerHTML, hovered: button.matches(':hover'), focused: document.activeElement?.id, tip: document.getElementById('control-tooltip').outerHTML, rect: button.getBoundingClientRect().toJSON(), scrollY, innerHeight }));
          await writeFile(new URL('tooltip-failure.json', output), JSON.stringify({ theme, width, details, errors }, null, 2));
          await page.screenshot({ path: fileURLToPath(new URL('tooltip-failure.png', output)) }); throw error;
        }
        assert(await page.locator('#control-tooltip').evaluate((tip) => { const box = tip.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight; }));
        await page.keyboard.press('Escape');
        if (theme === 'dark' && [390, 1365].includes(width)) await page.screenshot({ path: fileURLToPath(new URL('polish-' + width + '.png', output)), fullPage: true });
      }
    }
    portable = await browser.newPage({ viewport: { width: 390, height: 900 } });
    const portableUrl = url + 'polish-portable-check.html', blocked = [], html = await readFile(new URL('../Hz Mixer.html', import.meta.url));
    portable.on('pageerror', (error) => errors.push(error.message));
    await portable.route('**/*', (route) => {
      if (route.request().url() === portableUrl) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
      blocked.push(route.request().url()); return route.abort();
    });
    await portable.goto(portableUrl, { waitUntil: 'networkidle' });
    await portable.locator('#master-level-number').fill('43'); await portable.locator('#master-level-number').press('Enter');
    assert.equal(await portable.locator('#master-level').inputValue(), '43');
    await portable.locator('#preset-search').fill('Gamma'); assert.equal(await portable.locator('#mix-select optgroup option').count(), 8);
    await portable.locator('#preset-search').fill(''); await portable.locator('#mix-select').selectOption('preset:sweep-rain-783-45');
    assert((await portable.locator('#preset-summary').textContent()).includes('2 tones / Binaural + Isochronic'));
    assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
    await writeFile(new URL('polish-evidence.json', output), JSON.stringify({ levelFields: 15, search: true, tooltips: true, animations: true, blocked, errors }, null, 2));
    console.log('Polish: precise levels, validation/focus, fractional extra tones, metadata search, summaries, keyboard/dialog tooltips, motion/reduced motion, campfire, responsive themes and portable offline passed');
  } finally { await portable?.close(); await page.close(); }
}
