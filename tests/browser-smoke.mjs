import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firefox } from 'playwright';
import { spawn } from 'node:child_process';
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 1000 }, acceptDownloads: true });
page.setDefaultTimeout(20000);
const errors = [], badResponses = [], requests = [], evidence = {};
page.on('request', (request) => requests.push(request.url()));
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => { if (r.status() >= 400) badResponses.push([r.url(), r.status()]); });
const root = new URL('../output/browser/', import.meta.url);
let previewProcess;
async function startPreview() {
  await mkdir(root, { recursive: true });
  previewProcess = spawn(process.execPath, [fileURLToPath(new URL('../serve.mjs', import.meta.url)), '0', '--site', '--prefix'], { cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => { previewProcess.kill(); reject(new Error('Preview server did not start.')); }, 15000);
    previewProcess.once('error', (error) => { clearTimeout(timer); reject(error); });
    previewProcess.once('exit', (code) => { clearTimeout(timer); reject(new Error('Preview exited: ' + code)); });
    previewProcess.stdout.on('data', (chunk) => { output += chunk; const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/hz-mixer\//); if (match) { clearTimeout(timer); resolve(match[0]); } });
    previewProcess.stderr.on('data', (chunk) => process.stderr.write(chunk));
  });
}
const setRange = async (selector, value) => page.locator(selector).evaluate((input, n) => { input.value = n; input.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
const commit = async (selector, value) => { await page.locator(selector).fill(String(value)); await page.locator(selector).press('Tab'); };
try {
  const previewUrl = await startPreview();
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createAnalyser;
    AudioContext.prototype.createAnalyser = function () { const node = original.call(this); if (!window.__qa) window.__qa = { context: this, analyser: node, counter: 0, controls: [] }; return node; };
    const constant = AudioContext.prototype.createConstantSource;
    AudioContext.prototype.createConstantSource = function () { const node = constant.call(this); window.__qa?.controls.push(node); return node; };
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(previewUrl, { waitUntil: 'networkidle' });
  assert(!requests.some((url) => url.endsWith('.mp3') || url.includes('lamejs.iife')), 'audio and encoder load lazily');
  assert(await page.locator('meta[name="application-version"]').getAttribute('content') !== 'development');
  await page.locator('#recording-credits').click();
  assert(await page.locator('#credits-dialog').isVisible());
  assert((await page.locator('#credits-dialog').textContent()).includes('LGPL-3.0'));
  await page.locator('#credits-dialog button').click();
  await page.locator('#privacy-open').click(); assert(await page.locator('#privacy-dialog').isVisible()); await page.locator('#privacy-dialog button').click();
  const legacyPage = await browser.newPage();
  await legacyPage.addInitScript(() => localStorage.setItem('beat-mixer.theme.v1', '"dark"'));
  await legacyPage.goto(previewUrl);
  assert.equal(await legacyPage.locator('html').getAttribute('data-theme'), 'green');
  assert.equal(await legacyPage.locator('#theme-mode').inputValue(), 'green');
  await legacyPage.locator('#theme-mode').selectOption('dark'); await legacyPage.reload();
  assert.equal(await legacyPage.locator('html').getAttribute('data-theme'), 'dark', 'new preference wins over legacy Dark');
  assert.equal(await legacyPage.locator('#status').textContent(), 'Ready', 'theme reload does not autoplay');
  await legacyPage.close();
  await page.locator('input[name="program"][value="sweep"]').check();
  const audioBeforeThemes = await page.evaluate(() => localStorage.getItem('beat-mixer.current.v1'));
  const themeColors = { light: 'rgb(245, 247, 246)', green: 'rgb(23, 27, 26)', dark: 'rgb(8, 8, 11)', cyberpunk: 'rgb(9, 10, 14)', matrix: 'rgb(3, 7, 5)' };
  assert.equal(await page.locator('#theme-mode option[value="cyberpunk"]').textContent(), 'Blue');
  for (const [theme, background] of Object.entries(themeColors)) {
    await page.locator('#theme-mode').selectOption(theme);
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
    const colors = await page.locator('html').evaluate((element) => {
      const style = getComputedStyle(element), channel = document.querySelector('[data-sound="stream"]'), input = document.querySelector('#carrier-value');
      return { background: style.backgroundColor, text: style.color, muted: style.getPropertyValue('--muted').trim(), surface: getComputedStyle(channel).backgroundColor, input: getComputedStyle(input).color, wave: style.getPropertyValue('--canvas-wave').trim() };
    });
    assert.equal(colors.background, background);
    if (theme === 'green') { assert.equal(colors.surface, 'rgb(37, 46, 40)'); assert.equal(colors.input, 'rgb(224, 235, 227)'); }
    const contrast = (a, b) => {
      const luminance = (color) => {
        const rgb = color.startsWith('#') ? color.slice(1).match(/../g).map((x) => parseInt(x, 16)) : color.match(/[\d.]+/g).slice(0, 3).map(Number);
        return rgb.reduce((sum, value, i) => { const n = value / 255; return sum + (n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i]; }, 0);
      };
      const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
    };
    assert(contrast(colors.text, colors.background) >= 4.5, theme + ' body contrast');
    if (theme !== 'light') assert(contrast(colors.muted, colors.surface) >= 4.5, theme + ' muted text contrast');
    evidence['theme-' + theme] = colors;
    await page.waitForFunction(() => {
      const canvas = document.querySelector('#scope-canvas'); if (!canvas.width) return false;
      const hex = getComputedStyle(document.documentElement).getPropertyValue('--canvas-wave').trim();
      const color = hex.slice(1).match(/../g).map((part) => parseInt(part, 16)), context = canvas.getContext('2d');
      if (context.strokeStyle !== hex) return false;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      // The 1.5px waveform blends with the grid beneath its antialiased edges.
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 150 && color.every((n, c) => Math.abs(n - pixels[i + c]) < 36)) return true;
      return false;
    });
    for (const width of [320, 390, 768, 1101, 1365]) {
      await page.setViewportSize({ width, height: 1000 });
      const layout = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, bad: [...document.querySelectorAll('input, select, button, .sound-title h3')].filter((element) => element.getClientRects().length && (element.getBoundingClientRect().left < -1 || element.getBoundingClientRect().right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 2)).map((element) => element.id || element.textContent) }));
      assert(layout.scroll <= layout.width, theme + ' at ' + width + ': ' + JSON.stringify(layout)); assert.deepEqual(layout.bad, [], theme + ' at ' + width);
      for (const id of ['pink', 'brown']) {
        const icon = page.locator('[data-sound="' + id + '"] .sound-icon img'); assert(await icon.isVisible());
        assert.equal(await icon.evaluate((element) => getComputedStyle(element).filter), 'none');
      }
      if (width === 390 || width === 1365) {
        await page.locator('.topbar').scrollIntoViewIfNeeded();
        await page.screenshot({ path: fileURLToPath(new URL('theme-' + theme + '-' + width + '.png', root)), fullPage: width === 1365 });
      }
    }
    await page.locator('#open-export').click(); await page.locator('#export-format').selectOption('mp3');
    assert(await page.locator('#export-dialog').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth));
    await page.locator('#cancel-export').click();
    await page.reload(); assert.equal(await page.locator('#theme-mode').inputValue(), theme);
    assert.equal(await page.locator('#status').textContent(), 'Ready');
  }
  const rainFrame = () => {
    const canvas = document.querySelector('#matrix-rain');
    if (canvas.hidden || !canvas.width || !canvas.height) return { hash: 0, pixels: 0 };
    const data = canvas.getContext('2d').getImageData(0, 0, Math.min(canvas.width, 480), Math.min(canvas.height, 600)).data;
    let hash = 2166136261, pixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]) pixels++;
      if (i % 64 === 0) hash = Math.imul(hash ^ data[i] ^ data[i + 1] << 8 ^ data[i + 2] << 16 ^ data[i + 3] << 24, 16777619) >>> 0;
    }
    return { hash, pixels };
  };
  assert.equal(await page.locator('#matrix-rain').getAttribute('aria-hidden'), 'true');
  assert.equal(await page.locator('#matrix-rain').evaluate((canvas) => getComputedStyle(canvas).pointerEvents), 'none');
  const rainStart = await page.evaluate(rainFrame); assert(rainStart.pixels > 100, 'Matrix rain is nonblank');
  await page.waitForFunction(({ previous }) => {
    const canvas = document.querySelector('#matrix-rain'), data = canvas.getContext('2d').getImageData(0, 0, Math.min(canvas.width, 480), Math.min(canvas.height, 600)).data;
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 64) hash = Math.imul(hash ^ data[i] ^ data[i + 1] << 8 ^ data[i + 2] << 16 ^ data[i + 3] << 24, 16777619) >>> 0;
    return hash !== previous;
  }, { previous: rainStart.hash });
  await page.getByRole('button', { name: 'Pause matrix rain', exact: true }).click();
  const frozen = await page.evaluate(rainFrame);
  await page.evaluate(() => new Promise((resolve) => { let frames = 0; const tick = () => ++frames === 8 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); }));
  assert.deepEqual(await page.evaluate(rainFrame), frozen, 'pause freezes the rain');
  await page.reload();
  assert(await page.getByRole('button', { name: 'Resume matrix rain', exact: true }).isVisible(), 'rain pause persists');
  await page.locator('#theme-mode').selectOption('cyberpunk'); await page.locator('#theme-mode').selectOption('matrix');
  assert((await page.evaluate(rainFrame)).pixels > 100, 'returning to paused Matrix restores a static rain frame');
  await page.getByRole('button', { name: 'Resume matrix rain', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('#matrix-rain').hidden);
  assert(await page.locator('#matrix-motion').isDisabled());
  await page.locator('#theme-mode').selectOption('cyberpunk');
  assert(await page.locator('#matrix-rain').isHidden()); assert(await page.locator('#matrix-motion').isHidden());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#theme-mode').selectOption('matrix');
  await page.waitForFunction(() => !document.querySelector('#matrix-rain').hidden);
  evidence.matrixRain = { initialPixels: rainStart.pixels, animated: true, pausePersists: true, reducedMotionDisables: true, offThemeHidden: true };
  await page.locator('.topbar').scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL('matrix-rain-desktop.png', root)), fullPage: false });
  assert.equal(await page.evaluate(() => localStorage.getItem('beat-mixer.current.v1')), audioBeforeThemes, 'themes must not change audio settings');
  await page.locator('#theme-mode').selectOption('system');
  await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.emulateMedia({ colorScheme: 'light' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.locator('#theme-mode').selectOption('green'); await page.emulateMedia({ colorScheme: 'dark' });
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'green');
  await page.emulateMedia({ colorScheme: null });
  await page.locator('#reset-mix').click(); await page.locator('#theme-mode').selectOption('light');
  console.log('Theme migration, persistence, system changes, canvas pixels and responsive palettes passed');
  assert.equal(await page.title(), 'Hz Mixer');
  assert.equal(await page.locator('h1').textContent(), 'Hz Mixer');
  assert.equal(await page.locator('.brand').innerText(), 'Hz Mixer');
  assert.equal(await page.locator('#generator-heading').textContent(), 'Generator');
  assert.equal(await page.locator('#monitor-heading').textContent(), 'Monitor');
  assert((await page.locator('.brand-mark img').getAttribute('src')).endsWith('/mixer-waves.svg'));
  assert((await page.locator('link[rel="icon"]').getAttribute('href')).endsWith('/mixer-waves.svg'));
  assert(await page.locator('.brand-mark').evaluate((mark) => {
    const image = mark.querySelector('img').getBoundingClientRect(), tile = mark.getBoundingClientRect();
    return Math.abs(image.width - tile.width) < .1 && Math.abs(image.height - tile.height) < .1;
  }), 'wave artwork fills the brand tile');
  assert.equal(await page.locator('.generator-panel').getAttribute('aria-labelledby'), 'generator-heading');
  assert(await page.locator('.output-panel').evaluate((monitor) => Boolean(monitor.compareDocumentPosition(document.querySelector('.generator-panel')) & Node.DOCUMENT_POSITION_FOLLOWING)));
  for (const [id, icon] of [['cascade', 'waterfall'], ['stream', 'stream-flow'], ['storm', 'thunderstorm'], ['waves', 'sea-waves']]) {
    assert((await page.locator('[data-sound="' + id + '"] .sound-icon img').getAttribute('src')).endsWith('/' + icon + '.svg'));
  }
  assert.equal(await page.locator('#mix-select option').count(), 38);
  await page.locator('#mix-select').selectOption('preset:theta-783');
  await page.locator('#favorite-mix').click();
  await page.locator('#favorites-only').check();
  assert.equal(await page.locator('#mix-select option').count(), 2);
  await page.locator('#favorites-only').uncheck();
  await page.locator('#band-filter').selectOption('gamma');
  assert.equal(await page.locator('#mix-select optgroup[label="Gamma"] option').count(), 5);
  await page.locator('#band-filter').selectOption('all');
  await page.locator('#reset-mix').click();
  await page.locator('[data-enable="stream"]').uncheck();
  await commit('#fade-in', 0); await commit('#fade-out', 0);
  await page.locator('#play-button').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Playing');
  await page.evaluate(() => {
    const test = window.__qa, processor = test.context.createScriptProcessor(4096, 2, 2);
    processor.onaudioprocess = (event) => {
      const l = event.inputBuffer.getChannelData(0), r = event.inputBuffer.getChannelData(1);
      let ll = 0, rr = 0, dd = 0;
      for (let i = 0; i < l.length; i++) { ll += l[i] ** 2; rr += r[i] ** 2; dd += (l[i] - r[i]) ** 2; }
      test.latest = { left: Math.sqrt(ll / l.length), right: Math.sqrt(rr / l.length), difference: Math.sqrt(dd / l.length) }; test.counter++;
    };
    test.analyser.connect(processor); processor.connect(test.context.destination); test.processor = processor;
  });
  const samples = async () => { const count = await page.evaluate(() => window.__qa.counter); await page.waitForFunction((n) => window.__qa.counter > n + 5, count); return page.evaluate(() => window.__qa.latest); };
  for (const mode of ['binaural', 'monaural', 'isochronic']) {
    await page.locator('input[name="mode"][value="' + mode + '"]').check();
    const data = await samples(); evidence[mode] = data;
    assert(data.left > .001 && data.right > .001);
    assert(mode === 'binaural' ? data.difference > .001 : data.difference < 1e-6);
  }
  console.log('Stereo modes passed');
  await page.locator('#master-mute').click(); const muted = await samples(); assert(muted.left < 1e-5); await page.locator('#master-mute').click();
  for (const id of ['white', 'pink', 'brown', 'cascade', 'stream', 'storm', 'waves']) {
    await page.locator('[data-solo="' + id + '"]').click();
    await setRange('[data-pan="' + id + '"]', -100);
    await page.waitForFunction((id) => document.querySelector('[data-track-state="' + id + '"]').textContent === 'Solo', id);
    const data = await samples(); evidence[id] = data;
    assert(data.left > .0001 && data.right < 1e-5, id + ' solo left');
    await setRange('[data-pan="' + id + '"]', 100); const right = await samples(); assert(right.right > .0001 && right.left < 1e-5, id + ' solo right');
    await page.locator('[data-enable="' + id + '"]').uncheck();
  }
  console.log('Noise, recordings and pan passed');
  await page.locator('input[name="program"][value="sweep"]').check();
  await commit('#sweep-start', 12); await commit('#sweep-end', 6); await commit('#sweep-seconds', 5); await page.locator('#sweep-curve').selectOption('linear');
  assert.equal(await page.locator('#sweep-start').inputValue(), '12'); assert.equal(await page.locator('#sweep-seconds').inputValue(), '5');
  await page.waitForFunction(() => parseFloat(document.querySelector('#live-rate').value) < 11);
  const controls = await page.evaluate(() => window.__qa.controls.length);
  await setRange('#master-level', 40);
  assert.equal(await page.evaluate(() => window.__qa.controls.length), controls, 'level edits must not restart sweep');
  await page.locator('#play-button').click(); await page.waitForTimeout(300); const paused = await page.locator('#live-rate').textContent();
  await page.waitForTimeout(600); assert.equal(await page.locator('#live-rate').textContent(), paused);
  await page.locator('#play-button').click(); await page.waitForTimeout(500);
  assert(parseFloat(await page.locator('#live-rate').textContent()) <= parseFloat(paused));
  await commit('#beat-value', 7.83); assert(await page.locator('input[name="program"][value="fixed"]').isChecked());
  await page.locator('#stop-button').click(); await page.waitForFunction(() => document.querySelector('#status').textContent === 'Stopped');
  console.log('Sweep clock and pause passed');
  await page.locator('input[name="program"][value="sequence"]').check();
  assert.equal(await page.locator('.stage-row').count(), 3);
  assert.equal(await page.locator('#session-total').textContent(), '25:00');
  await commit('.stage-row:nth-child(1) [data-stage-key="seconds"]', 5);
  await commit('.stage-row:nth-child(2) [data-stage-key="seconds"]', 5);
  await commit('.stage-row:nth-child(3) [data-stage-key="seconds"]', 5);
  await page.locator('#add-stage').click(); assert.equal(await page.locator('.stage-row').count(), 4);
  await page.locator('.stage-row:last-child [data-stage-action="up"]').click();
  await page.locator('.stage-row:last-child [data-stage-action="remove"]').click();
  assert.equal(await page.locator('.stage-row').count(), 3);
  assert.equal(await page.locator('#session-total').textContent(), '01:10');
  await page.locator('#save-mix').click(); await page.locator('#mix-name').fill('Roadmap QA'); await page.locator('#save-form button[type="submit"]').click();
  await page.reload(); assert.equal(await page.locator('#status').textContent(), 'Ready'); assert(await page.locator('input[name="program"][value="sequence"]').isChecked());
  assert.equal(await page.locator('.stage-row').count(), 3);
  await page.locator('#open-export').click(); await page.locator('[data-export-tab="library"]').click();
  const backupEvent = page.waitForEvent('download'); await page.locator('#download-export').click(); const backup = await backupEvent; const backupText = await readFile(await backup.path(), 'utf8');
  assert.equal(JSON.parse(backupText).entries.length, 1);
  await page.locator('#cancel-export').click(); await page.locator('#open-import').click();
  await page.locator('#import-file').setInputFiles({ name: 'library.json', mimeType: 'application/json', buffer: Buffer.from(backupText) });
  await page.waitForFunction(() => !document.querySelector('#confirm-import').disabled);
  await page.locator('#import-current').uncheck(); await page.locator('#confirm-import').click();
  assert.equal(await page.locator('#mix-select optgroup[label="My mixes"] option').count(), 1, 'merge skips identical duplicate');
  console.log('Stages, persistence and JSON round trip passed');
  await page.locator('#reset-mix').click(); await page.locator('[data-enable="stream"]').uncheck();
  await page.locator('#open-export').click(); await page.locator('[data-export-tab="audio"]').click(); await commit('#export-seconds', 2);
  const wavEvent = page.waitForEvent('download'); await page.locator('#download-export').click(); const wav = await wavEvent; const bytes = await readFile(await wav.path());
  assert.equal(bytes.length, 44 + 2 * 44100 * 4); assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  await page.locator('#cancel-export').click();
  await page.locator('#open-export').click(); await commit('#export-seconds', 7200); await page.locator('#download-export').click(); await page.locator('#cancel-export').click();
  await page.waitForFunction(() => document.querySelector('#export-error').textContent.includes('cancelled')); await page.locator('#cancel-export').click();
  console.log('UI WAV export and cancel passed');
  await commit('#fade-in', 0); await commit('#fade-out', 0);
  await page.locator('#open-export').click(); await page.locator('#export-format').selectOption('mp3'); await commit('#export-seconds', 4);
  assert(await page.locator('#export-bitrate').isVisible());
  assert.equal(await page.locator('#export-bitrate').inputValue(), '256');
  const mp3Event = page.waitForEvent('download'); await page.locator('#download-export').click(); const mp3 = await mp3Event;
  assert(mp3.suggestedFilename().endsWith('.mp3'));
  const mp3Bytes = await readFile(await mp3.path()); await writeFile(new URL('export-stereo.mp3', root), mp3Bytes);
  evidence.mp3Download = await page.evaluate(async (base64) => {
    const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const context = new AudioContext({ sampleRate: 44100 });
    const decoded = await context.decodeAudioData(data.buffer);
    const amplitude = (channel, frequency) => {
      const samples = decoded.getChannelData(channel); let re = 0, im = 0;
      for (let i = 0; i < 44100; i++) { const phase = 2 * Math.PI * frequency * i / 44100; re += samples[i + 22050] * Math.cos(phase); im += samples[i + 22050] * Math.sin(phase); }
      return Math.hypot(re, im) / 22050;
    };
    const result = { channels: decoded.numberOfChannels, duration: decoded.duration, left196: amplitude(0,196), left204: amplitude(0,204), right196: amplitude(1,196), right204: amplitude(1,204) };
    await context.close(); return result;
  }, mp3Bytes.toString('base64'));
  assert.equal(evidence.mp3Download.channels, 2); assert(evidence.mp3Download.duration >= 4 && evidence.mp3Download.duration < 4.15);
  assert(evidence.mp3Download.left196 > .01 && evidence.mp3Download.left196 > evidence.mp3Download.left204 * 100);
  assert(evidence.mp3Download.right204 > .01 && evidence.mp3Download.right204 > evidence.mp3Download.right196 * 100);
  await page.locator('#export-rate').selectOption('48000'); await page.locator('#export-bitrate').selectOption('128'); await commit('#export-seconds', 2);
  const altEvent = page.waitForEvent('download'); await page.locator('#download-export').click(); const alt = await altEvent;
  const altBytes = await readFile(await alt.path()); assert.equal([44100,48000,32000][(altBytes[2] >> 2) & 3], 48000);
  await commit('#export-seconds', 7200); await page.locator('#download-export').click(); await page.locator('#cancel-export').click();
  await page.waitForFunction(() => document.querySelector('#export-error').textContent.includes('cancelled'));
  await page.locator('#cancel-export').click();
  console.log('UI MP3 export, decoded stereo frequencies and cancel passed', evidence.mp3Download);
  evidence.offline = await page.evaluate(async () => {
    const { defaultMix } = await import(new URL('src/mix-state.mjs', location.href)); const { renderWav } = await import(new URL('src/wav-export.mjs', location.href));
    const { AudioEngine } = await import(new URL('src/audio-engine.js', location.href));
    const engine = new AudioEngine(); engine.update(defaultMix());
    const results = [];
    for (const mode of ['binaural', 'monaural', 'isochronic']) {
      const mix = defaultMix(); mix.mode = mode; mix.carrier = 203; mix.beat = 7.83; mix.sounds.stream.enabled = false;
      mix.automation.kind = 'sweep'; mix.automation.sweep = { start: 7.83, end: 12.21, seconds: 15, curve: 'smooth', repeat: 'pingpong' }; mix.fades = { in: .1, out: .2 };
      const full = new DataView(await (await renderWav(mix, 21, 44100, (id) => engine.buffer(id), () => {}, null, 30)).arrayBuffer());
      const split = new DataView(await (await renderWav(mix, 21, 44100, (id) => engine.buffer(id), () => {}, null, 10)).arrayBuffer());
      let diff = 0, energy = 0, peakDiff = 0;
      for (let i = 44; i < full.byteLength; i += 2) { const a = full.getInt16(i, true) / 32768, b = split.getInt16(i, true) / 32768; diff += (a - b) ** 2; energy += a ** 2; peakDiff = Math.max(peakDiff, Math.abs(a - b)); }
      results.push({ mode, diff: Math.sqrt(diff / ((full.byteLength - 44) / 2)), rms: Math.sqrt(energy / ((full.byteLength - 44) / 2)), peakDiff });
    }
    const mix = defaultMix(); mix.mode = 'off'; mix.noise.pink.enabled = true;
    const natural = await renderWav(mix, 2, 48000, (id) => engine.buffer(id), () => {});
    results.push({ mode: 'nature + noise at 48k', bytes: natural.size });
    let streamedBytes = 0, writes = 0;
    const streamed = await renderWav(mix, 2, 48000, (id) => engine.buffer(id), () => {}, null, 1, { async write(bytes) { streamedBytes += bytes.byteLength; writes++; } });
    if (streamed !== null || streamedBytes !== natural.size || writes !== 3) throw new Error('Streaming WAV sink failed');
    results.push({ mode: 'streaming sink', streamedBytes, writes });
    const { renderMp3 } = await import(new URL('src/mp3-export.mjs', location.href));
    const programmed = defaultMix(); programmed.mode = 'isochronic'; programmed.noise.pink.enabled = true;
    programmed.automation.kind = 'sequence'; programmed.automation.stages = [
      { type: 'hold', start: 7.83, end: 7.83, seconds: 2, curve: 'linear' },
      { type: 'sweep', start: 7.83, end: 12, seconds: 4, curve: 'smooth' },
    ];
    programmed.fades = { in: .2, out: .3 };
    const progress = [];
    const encoded = await renderMp3(programmed, 6, 48000, 192, (id) => engine.buffer(id), (value) => progress.push(value), null, 1);
    const encodedBytes = new Uint8Array(await encoded.arrayBuffer()), streamedParts = [];
    const mp3Sink = await renderMp3(programmed, 6, 48000, 192, (id) => engine.buffer(id), () => {}, null, 1, { async write(bytes) { streamedParts.push(...Uint8Array.from(bytes)); } });
    if (mp3Sink !== null || streamedParts.length !== encodedBytes.length || streamedParts.some((value, i) => value !== encodedBytes[i])) throw new Error('MP3 stream/Blob mismatch');
    const decoded = await engine.context.decodeAudioData(encodedBytes.buffer);
    if (decoded.numberOfChannels !== 2 || decoded.duration < 6 || decoded.duration > 6.15) throw new Error('MP3 block continuity/padding failed');
    if (progress.some((value, i) => i > 0 && value < progress[i - 1]) || progress.at(-1) !== 1) throw new Error('MP3 progress is not monotonic');
    const abort = new AbortController(); let cancelled = false;
    try { await renderMp3(programmed, 6, 48000, 192, (id) => engine.buffer(id), (value) => { if (value > 0) abort.abort(); }, abort.signal, 1); }
    catch (error) { if (error.name !== 'AbortError') throw error; cancelled = true; }
    if (!cancelled) throw new Error('MP3 cancellation during encoding failed');
    let failedWrite = false;
    try { await renderMp3(programmed, 1, 48000, 192, (id) => engine.buffer(id), () => {}, null, 1, { async write() { throw new Error('Synthetic disk full'); } }); }
    catch (error) { if (error.message !== 'Synthetic disk full') throw error; failedWrite = true; }
    if (!failedWrite) throw new Error('MP3 sink errors must propagate');
    results.push({ mode: 'MP3 stages + recordings + noise, chunked streaming and mid-encode cancel', bytes: encoded.size, duration: decoded.duration, channels: decoded.numberOfChannels, progressEvents: progress.length });
    await engine.context.close(); return results;
  });
  console.log('Offline comparison', evidence.offline);
  for (const result of evidence.offline.filter((x) => x.diff !== undefined)) { assert(result.rms > .001); assert(result.diff < .001, result.mode + ' chunk mismatch'); assert(result.peakDiff < .01, result.mode + ' chunk seam'); }
  await page.locator('#reset-mix').click(); await page.locator('[data-enable="stream"]').uncheck();
  await page.locator('input[name="program"][value="sequence"]').check();
  await page.locator('.stage-row:nth-child(3) [data-stage-action="remove"]').click(); await page.locator('.stage-row:nth-child(2) [data-stage-action="remove"]').click();
  await commit('.stage-row:nth-child(1) [data-stage-key="seconds"]', 5); await commit('#fade-in', 1); await commit('#fade-out', 1);
  await page.locator('#play-button').click(); await page.waitForFunction(() => document.querySelector('#status').textContent === 'Session complete');
  assert.equal(await page.locator('#remaining').textContent(), '00:05');
  await page.locator('input[name="program"][value="fixed"]').check(); await commit('#fade-in', 0); await commit('#fade-out', 2);
  await page.locator('#play-button').click(); await page.locator('#stop-button').click(); assert.equal(await page.locator('#status').textContent(), 'Fading out...');
  await page.locator('#stop-button').click(); await page.waitForFunction(() => document.querySelector('#status').textContent === 'Stopped');
  await page.locator('#play-button').click(); await page.waitForTimeout(2300); assert.equal(await page.locator('#status').textContent(), 'Playing', 'old stop completion must not overwrite new playback');
  await commit('#fade-out', 0); await page.locator('#stop-button').click();
  console.log('Stage completion and stop/restart race passed');
  await page.locator('#reset-mix').click(); await page.locator('#mix-select').selectOption('preset:theta-783'); await page.locator('input[name="program"][value="sweep"]').check();
  await commit('#sweep-start', 12); await commit('#sweep-end', 7.83);
  await page.locator('#theme-mode').selectOption('dark');
  await page.screenshot({ path: fileURLToPath(new URL('roadmap-preview.png', root)), fullPage: false });
  await page.locator('input[name="program"][value="sequence"]').check();
  await page.screenshot({ path: fileURLToPath(new URL('roadmap-desktop-dark.png', root)), fullPage: true });
  for (const width of [320, 390, 768, 1365]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, overflowing: [...document.querySelectorAll('input, select, button')].filter((e) => e.getClientRects().length && (e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 || e.getBoundingClientRect().left < -1)).map((e) => e.id || e.className) }));
    assert(layout.scroll <= layout.width, JSON.stringify(layout)); assert.equal(layout.overflowing.length, 0, JSON.stringify(layout));
    assert(await page.locator('#monitor-heading').isVisible());
    const monitor = await page.locator('.output-panel').boundingBox(), generator = await page.locator('.generator-panel').boundingBox();
    assert(monitor.y + monitor.height <= generator.y, 'monitor precedes generator at ' + width + 'px');
    assert(await page.locator('img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), 'all icons loaded');
    evidence['layout' + width] = layout;
    if (width === 390) await page.screenshot({ path: fileURLToPath(new URL('roadmap-mobile-dark.png', root)), fullPage: true });
    await page.locator('#open-export').click(); await page.locator('[data-export-tab="audio"]').click(); await page.locator('#export-format').selectOption('mp3');
    assert(await page.locator('#export-bitrate').isVisible());
    assert(await page.locator('#export-dialog').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth));
    if (width === 390 || width === 1365) await page.screenshot({ path: fileURLToPath(new URL('mp3-export-' + width + '.png', root)) });
    await page.locator('#cancel-export').click();
  }
  await page.locator('#theme-mode').selectOption('light'); await page.setViewportSize({ width: 1365, height: 1000 }); await page.screenshot({ path: fileURLToPath(new URL('roadmap-desktop-light.png', root)), fullPage: true });
  for (const theme of ['light', 'dark']) {
    await page.locator('#theme-mode').selectOption(theme);
    for (const id of ['pink', 'brown']) {
      const icon = page.locator('[data-sound="' + id + '"] .sound-icon img');
      assert((await icon.getAttribute('src')).endsWith('/noise-' + id + '.svg'));
      assert(await icon.isVisible(), id + ' artwork is visible on desktop');
      const appearance = await icon.evaluate((img) => ({ filter: getComputedStyle(img).filter, opacity: getComputedStyle(img).opacity, background: getComputedStyle(img.parentElement).backgroundColor }));
      assert.equal(appearance.filter, 'none'); assert.equal(appearance.opacity, '1');
      evidence[theme + '-' + id + '-icon'] = appearance;
    }
    await page.locator('#noise-list').screenshot({ path: fileURLToPath(new URL('noise-icons-' + theme + '.png', root)) });
  }
  assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
  assert(requests.filter((url) => /^https?:/.test(url)).every((url) => url.startsWith(previewUrl)), 'all app requests stay inside the project prefix');
  const artwork = [
    ['mixer-waves', 'Hz Mixer', '#79d3b7', false],
    ['waterfall', 'Waterfall', '#283f50', true],
    ['stream-flow', 'Stream', '#284839', true],
    ['thunderstorm', 'Thunderstorm', '#3e344f', true],
    ['sea-waves', 'Sea waves', '#513d32', true],
  ];
  const review = await browser.newPage({ viewport: { width: 1060, height: 250 } });
  const artMarkup = [];
  for (const [name, label, color, inverted] of artwork) {
    const bytes = await readFile(new URL('../assets/icons/' + name + '.svg', import.meta.url));
    artMarkup.push('<section><div style="background:' + color + '"><img style="filter:' + (inverted ? 'invert(1)' : 'none') + (inverted ? '' : ';width:148px;height:148px') + '" src="data:image/svg+xml;base64,' + bytes.toString('base64') + '" alt="' + label + ' artwork" /></div><h2>' + label + '</h2></section>');
  }
  await review.setContent('<!doctype html><html><head><style>body{margin:0;padding:24px;background:#171b1a;color:#e3ece6;font:14px Segoe UI,Arial,sans-serif}main{display:grid;grid-template-columns:repeat(5,1fr);gap:24px}section{text-align:center}section div{width:148px;height:148px;margin:auto;display:grid;place-items:center;border-radius:7px}img{width:124px;height:124px}h2{font-size:14px;font-weight:600;margin:14px 0 0}</style></head><body><main>' + artMarkup.join('') + '</main></body></html>');
  assert(await review.locator('img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)));
  await review.screenshot({ path: fileURLToPath(new URL('icon-artwork.png', root)) });
  await review.close();
  await writeFile(new URL('roadmap-evidence.json', root), JSON.stringify(evidence, null, 2));
  console.log('All browser roadmap checks passed');
} finally {
  await browser.close();
  if (previewProcess && previewProcess.exitCode === null) {
    const closed = new Promise((resolve) => previewProcess.once('close', resolve));
    previewProcess.kill();
    await closed;
  }
}
