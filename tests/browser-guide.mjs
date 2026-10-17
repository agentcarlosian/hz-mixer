import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

export async function guideRegressions(browser, url, output) {
  const context = await browser.newContext({ viewport: { width: 1365, height: 1000 } });
  const page = await context.newPage();
  const errors = [], badResponses = [];
  const observe = (tab) => {
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('response', (response) => { if (response.status() >= 400) badResponses.push(response.url()); });
  };
  observe(page);
  let guide, embedded;
  try {
    await page.goto(url);
    assert.equal(await page.locator('#status').textContent(), 'Ready');
    const notice = page.locator('.app-shell .listening-notice');
    assert((await notice.textContent()).includes('driving, operating machinery'));
    assert((await notice.boundingBox()).y < (await page.locator('#play-button').boundingBox()).y);
    for (const theme of ['light', 'green', 'dark', 'cyberpunk', 'matrix']) {
      await page.locator('#theme-mode').selectOption(theme);
      for (const width of [320, 390, 768, 1365]) {
        await page.setViewportSize({ width, height: 900 });
        const layout = await page.evaluate(() => {
          const brand = document.querySelector('.topbar .brand').getBoundingClientRect(), actions = document.querySelector('.topbar-actions').getBoundingClientRect();
          return { overflow: document.documentElement.scrollWidth > innerWidth, overlap: brand.right > actions.left + 1 };
        });
        assert.deepEqual(layout, { overflow: false, overlap: false }, theme + ' at ' + width);
        await page.locator('#info-open').click();
        assert(await page.getByRole('dialog', { name: 'About Hz Mixer', exact: true }).isVisible());
        assert(await page.locator('#info-dialog').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth));
        assert((await page.locator('#info-dialog').textContent()).includes('Stereo headphones are required'));
        if (['light', 'dark', 'matrix'].includes(theme) && [390, 1365].includes(width)) await page.screenshot({ path: fileURLToPath(new URL('info-' + theme + '-' + width + '.png', output)) });
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'info-open');
      }
    }
    await page.locator('#theme-mode').selectOption('dark');
    await page.locator('#info-open').click();
    await page.locator('#guide-link').click();
    await page.waitForFunction(() => !document.getElementById('guide-page').hidden);
    assert(await page.locator('.app-shell').isHidden());
    await page.locator('.guide-header .button').click();
    await page.waitForFunction(() => document.getElementById('guide-page').hidden);
    guide = await page.context().newPage(); observe(guide);
    await guide.goto(url + 'guide.html', { waitUntil: 'networkidle' });
    assert(guide.url().startsWith(url + 'guide.html'));
    assert.equal(await guide.title(), 'Hz Mixer Guide');
    assert.equal(await guide.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await guide.locator('.guide-toc a').count(), 16);
    assert(await guide.locator('.guide-toc a').evaluateAll((links) => links.every((link) => document.getElementById(link.hash.slice(1)))));
    for (const width of [320, 390, 768, 1365]) {
      await guide.setViewportSize({ width, height: 1000 });
      assert(await guide.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Guide overflow at ' + width);
      await guide.screenshot({ path: fileURLToPath(new URL('guide-' + width + '.png', output)) });
    }
    await guide.locator('.guide-toc a[href="#guide-isochronic-pulse-shape"]').click();
    assert(guide.url().endsWith('#guide-isochronic-pulse-shape'));
    const position = await guide.evaluate(() => ({ heading: document.getElementById('guide-isochronic-pulse-shape').getBoundingClientRect().top, header: document.querySelector('.guide-header').getBoundingClientRect().bottom }));
    assert(position.heading >= position.header - 1, 'Guide anchor stays below the sticky header.');
    await guide.screenshot({ path: fileURLToPath(new URL('guide-pulse-shape.png', output)) });
    await guide.locator('.guide-header .button').click(); await guide.waitForLoadState('networkidle');
    assert.equal(await guide.title(), 'Hz Mixer');
    await guide.close(); guide = null;

    // The actual web app shares the embedded view with the portable build.
    embedded = await browser.newPage({ viewport: { width: 390, height: 900 } }); observe(embedded);
    await embedded.addInitScript(() => {
      const original = AudioContext.prototype.createAnalyser;
      AudioContext.prototype.createAnalyser = function () { window.__guideContext = this; window.__guideContextCount = (window.__guideContextCount || 0) + 1; return original.call(this); };
    });
    const embeddedUrl = url;
    await embedded.goto(embeddedUrl);
    await embedded.locator('#theme-mode').selectOption('matrix');
    await embedded.locator('#play-button').click();
    await embedded.waitForFunction(() => window.__guideContext?.state === 'running');
    const state = await embedded.evaluate(() => ({ mix: localStorage.getItem('beat-mixer.current.v1'), theme: localStorage.getItem('hz-mixer.theme.v2'), motion: localStorage.getItem('hz-mixer.matrix-motion.v1'), time: window.__guideContext.currentTime }));
    await embedded.locator('#info-open').click(); await embedded.locator('#guide-link').click();
    await embedded.waitForFunction(() => !document.getElementById('guide-page').hidden);
    assert(await embedded.locator('.app-shell').isHidden());
    assert(await embedded.locator('#matrix-rain').isHidden());
    assert.equal(await embedded.title(), 'Hz Mixer Guide');
    assert.equal(await embedded.locator('#info-dialog').isVisible(), false);
    await embedded.locator('.guide-toc a[href="#guide-audio-export"]').click();
    assert.equal(await embedded.evaluate(() => document.activeElement.id), 'guide-audio-export');
    await embedded.locator('.guide-header .button').click();
    await embedded.waitForFunction(() => document.getElementById('guide-page').hidden);
    assert(await embedded.locator('.app-shell').isVisible());
    assert.equal(await embedded.locator('#status').textContent(), 'Playing');
    assert.equal(await embedded.title(), 'Hz Mixer');
    const after = await embedded.evaluate(() => ({ mix: localStorage.getItem('beat-mixer.current.v1'), theme: localStorage.getItem('hz-mixer.theme.v2'), motion: localStorage.getItem('hz-mixer.matrix-motion.v1'), time: window.__guideContext.currentTime, count: window.__guideContextCount, focus: document.activeElement.id }));
    assert.equal(after.mix, state.mix); assert.equal(after.theme, state.theme); assert.equal(after.motion, state.motion);
    assert(after.time > state.time); assert.equal(after.count, 1); assert.equal(after.focus, 'info-open');
    await embedded.goBack(); await embedded.waitForFunction(() => !document.getElementById('guide-page').hidden);
    await embedded.goForward(); await embedded.waitForFunction(() => document.getElementById('guide-page').hidden);
    await embedded.locator('#play-button').click();
    await embedded.goto(embeddedUrl + '#guide-isochronic-pulse-shape');
    await embedded.reload();
    assert(await embedded.locator('.app-shell').isHidden());
    assert.equal(await embedded.locator('#status').textContent(), 'Ready', 'Deep-linked guide reload never autoplays.');
    assert(await embedded.locator('#matrix-rain').isHidden());
    assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
  } finally { await guide?.close(); await embedded?.close(); await context.close(); }
  console.log('Guide regressions: info accessibility/themes, warning, responsive docs, embedded navigation/history and uninterrupted playback passed');
}
