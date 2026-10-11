import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firefox } from 'playwright';
import { spawn } from 'node:child_process';
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 1000 }, acceptDownloads: true });
page.setDefaultTimeout(20000);
const errors = [], badResponses = [], evidence = {};
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => { if (r.status() >= 400) badResponses.push([r.url(), r.status()]); });
const root = new URL('../output/browser/', import.meta.url);
let previewProcess;
async function startPreview() {
  await mkdir(root, { recursive: true });
  previewProcess = spawn(process.execPath, [fileURLToPath(new URL('../serve.mjs', import.meta.url)), '0'], { cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => { previewProcess.kill(); reject(new Error('Preview server did not start.')); }, 15000);
    previewProcess.once('error', (error) => { clearTimeout(timer); reject(error); });
    previewProcess.once('exit', (code) => { clearTimeout(timer); reject(new Error('Preview exited: ' + code)); });
    previewProcess.stdout.on('data', (chunk) => { output += chunk; const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//); if (match) { clearTimeout(timer); resolve(match[0]); } });
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
  await page.goto(previewUrl, { waitUntil: 'networkidle' });
  assert.equal(await page.title(), 'Hz Mixer');
  assert.equal(await page.locator('h1').textContent(), 'Hz Mixer');
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
  evidence.offline = await page.evaluate(async () => {
    const { defaultMix } = await import('/src/mix-state.mjs'); const { renderWav } = await import('/src/wav-export.mjs');
    const { AudioEngine } = await import('/src/audio-engine.js');
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
    evidence['layout' + width] = layout;
    if (width === 390) await page.screenshot({ path: fileURLToPath(new URL('roadmap-mobile-dark.png', root)), fullPage: true });
  }
  await page.locator('#theme-mode').selectOption('light'); await page.setViewportSize({ width: 1365, height: 1000 }); await page.screenshot({ path: fileURLToPath(new URL('roadmap-desktop-light.png', root)), fullPage: true });
  assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
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
