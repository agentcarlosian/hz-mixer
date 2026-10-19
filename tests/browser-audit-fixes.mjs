import assert from 'node:assert/strict';
import { revealMixerControl } from './browser-mixer-helpers.mjs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function auditFixRegressions(browser, url, output) {
  const evidence = { startup: [], finalization: [] };
  for (const change of ['preset', 'fields', 'invalid-tone', 'invalid-rate']) {
    const page = await browser.newPage(); page.setDefaultTimeout(20000);
    try {
      await page.addInitScript((limited) => {
        if (limited) { const Native = AudioContext; window.AudioContext = class extends Native { constructor(options) { super({ ...options, sampleRate: 32000 }); } }; }
        const prototype = AudioContext.prototype, resume = prototype.resume, oscillator = prototype.createOscillator, constant = prototype.createConstantSource;
        window.__startedOscillators = []; window.__startedControls = [];
        prototype.resume = async function () { await new Promise((resolve) => { window.__finishResume = resolve; }); return resume.call(this); };
        prototype.createOscillator = function () { const node = oscillator.call(this); window.__startedOscillators.push(node); return node; };
        prototype.createConstantSource = function () { const node = constant.call(this); window.__startedControls.push(node); return node; };
      }, change === 'invalid-rate');
      await page.goto(url); await revealMixerControl(page, '[data-enable="stream"]'); await page.locator('[data-enable="stream"]').uncheck(); await page.locator('#play-button').click();
      await page.waitForFunction(() => Boolean(window.__finishResume));
      if (change === 'preset') await page.locator('#mix-select').selectOption('preset:rain-6');
      else {
        await revealMixerControl(page, '#carrier-value');
        if (change === 'invalid-rate') await page.locator('input[name="mode"][value="isochronic"]').check();
        for (const [id, value] of change === 'fields' ? [['#beat-value', '20'], ['#carrier-value', '500']] : change === 'invalid-rate' ? [['#beat-value', '120'], ['#carrier-value', '5000']] : [['#carrier-value', '1']]) {
          await page.locator(id).fill(value); await page.locator(id).press('Tab');
        }
      }
      await page.evaluate(() => window.__finishResume());
      await page.waitForFunction(() => ['Playing', 'Audio unavailable'].includes(document.getElementById('status').textContent));
      const result = await page.evaluate(() => ({ status: document.getElementById('status').textContent, carrier: document.getElementById('carrier-value').value, beat: document.getElementById('beat-value').value, error: document.getElementById('signal-error').textContent, carriers: window.__startedOscillators.map((node) => node.frequency.value), rates: window.__startedControls.map((node) => node.offset.value) }));
      if (change.startsWith('invalid-')) {
        assert.equal(result.status, 'Audio unavailable'); assert.equal(result.carriers.length, 0);
        assert(result.error.includes(change === 'invalid-rate' ? 'sample rate' : 'positive frequency'));
      } else {
        const carrier = change === 'preset' ? 180 : 500, beat = change === 'preset' ? 6 : 20;
        assert.equal(result.status, 'Playing'); assert.deepEqual(result.carriers, [carrier, carrier]); assert.deepEqual(result.rates, [0, beat]);
        assert.equal(Number(result.carrier), carrier); assert.equal(Number(result.beat), beat);
      }
      evidence.startup.push({ change, ...result });
    } finally { await page.close(); }
  }

  for (const format of ['wav', 'mp3']) for (const outcome of ['success', 'failure', 'cancel-before-close']) {
    const page = await browser.newPage({ viewport: { width: format === 'wav' ? 1365 : 390, height: 950 } }); page.setDefaultTimeout(20000);
    try {
      await page.addInitScript((mode) => {
        window.__writer = { mode, bytes: 0, closeEntered: false, writeHeld: false, committed: false, aborted: false };
        window.showSaveFilePicker = async () => ({ createWritable: async () => ({
          write: async (chunk) => { window.__writer.bytes += chunk.byteLength; if (window.__writer.mode === 'cancel-before-close' && window.__writer.bytes > 44) { window.__writer.writeHeld = true; await new Promise((resolve) => { window.__finishWrite = resolve; }); } },
          close: async () => { window.__writer.closeEntered = true; await new Promise((resolve) => { window.__finishClose = resolve; }); if (window.__writer.mode === 'failure') throw new Error('Synthetic close failure'); window.__writer.committed = true; },
          abort: async () => { window.__writer.aborted = true; },
        }) });
      }, outcome);
      await page.goto(url); await revealMixerControl(page, '[data-enable="stream"]'); await page.locator('[data-enable="stream"]').uncheck();
      await page.locator('#open-export').click(); await page.locator('#export-format').selectOption(format);
      await page.locator('#export-seconds').fill('1'); await page.locator('#export-seconds').press('Tab');
      await page.locator('#download-export').click();
      if (outcome === 'cancel-before-close') {
        await page.waitForFunction(() => window.__writer.writeHeld);
        await page.locator('#cancel-export').click(); await page.evaluate(() => window.__finishWrite());
        await page.waitForFunction(() => document.getElementById('export-error').textContent.includes('cancelled'));
        const state = await page.evaluate(() => window.__writer); assert.equal(state.closeEntered, false); assert.equal(state.committed, false); assert.equal(state.aborted, true);
      } else {
        await page.waitForFunction(() => window.__writer.closeEntered);
        assert(await page.locator('#cancel-export').isDisabled()); assert.equal(await page.locator('#cancel-export').textContent(), 'Finalizing...');
        assert((await page.locator('#export-summary').textContent()).includes('Finalizing'));
        assert(await page.locator('#export-dialog').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth));
        await page.keyboard.press('Escape'); assert(await page.locator('#export-dialog').isVisible());
        assert.equal(await page.evaluate(() => window.__writer.aborted), false);
        if (outcome === 'success') await page.screenshot({ path: fileURLToPath(new URL('finalizing-' + format + '.png', output)) });
        await page.evaluate(() => window.__finishClose());
        await page.waitForFunction(() => document.getElementById('cancel-export').textContent === 'Close');
        const state = await page.evaluate(() => window.__writer);
        if (outcome === 'failure') { assert.equal(state.committed, false); assert.equal(state.aborted, true); assert.equal(await page.locator('#export-error').textContent(), 'Synthetic close failure'); }
        else { assert.equal(state.committed, true); assert.equal(state.aborted, false); assert.equal(await page.locator('#export-error').textContent(), ''); }
      }
      assert(await page.locator('#download-export').isEnabled()); assert(await page.locator('#cancel-export').isEnabled());
      const state = await page.evaluate(() => window.__writer);
      if (outcome === 'failure') {
        await page.evaluate(() => Object.assign(window.__writer, { mode: 'success', bytes: 0, closeEntered: false, aborted: false, committed: false }));
        await page.locator('#download-export').click(); await page.waitForFunction(() => window.__writer.closeEntered);
        assert(await page.locator('#cancel-export').isDisabled()); await page.evaluate(() => window.__finishClose());
        await page.waitForFunction(() => document.getElementById('cancel-export').textContent === 'Close');
        assert.equal(await page.locator('#export-error').textContent(), '');
        const retry = await page.evaluate(() => window.__writer); assert.equal(retry.committed, true); assert.equal(retry.aborted, false);
        evidence.finalization.push({ format, outcome, state, retry });
      } else evidence.finalization.push({ format, outcome, state });
    } finally { await page.close(); }
  }

  const page = await browser.newPage();
  try {
    await page.goto(url);
    evidence.joins = await page.evaluate(async () => {
      const { defaultMix } = await import(new URL('src/mix-state.mjs', location.href));
      const { renderWav } = await import(new URL('src/wav-export.mjs', location.href));
      const { renderMp3 } = await import(new URL('src/mp3-export.mjs', location.href));
      const results = [];
      for (const sampleRate of [44100, 48000]) for (const mode of ['binaural', 'monaural', 'isochronic']) {
        const mix = defaultMix(); Object.assign(mix, { mode, carrier: 1, beat: .11, master: 55, toneLevel: 50, fades: { in: 0, out: 0 } }); mix.sounds.stream.enabled = false;
        const load = () => { throw new Error('No recording expected'); };
        const bytes = await (await renderWav(mix, 41, sampleRate, load, () => {})).arrayBuffer(), data = new DataView(bytes);
        if (bytes.byteLength !== 44 + 41 * sampleRate * 4) throw new Error('Overlap changed export duration');
        for (const second of [20, 40]) for (const channel of [0, 1]) {
          const frame = second * sampleRate, sample = (i) => data.getInt16(44 + i * 4 + channel * 2, true) / 32768;
          const boundaryStep = Math.abs(sample(frame) - sample(frame - 1)); let maxStep = 0;
          for (let i = frame - 200; i < frame + Math.ceil(sampleRate * .01) + 200; i++) maxStep = Math.max(maxStep, Math.abs(sample(i) - sample(i - 1)));
          if (boundaryStep > 2 / 32768 || maxStep > 4 / 32768) throw new Error(JSON.stringify({ mode, sampleRate, second, channel, boundaryStep, maxStep }));
          results.push({ mode, sampleRate, second, channel, boundaryStep, maxStep });
        }
        if (mode === 'isochronic') {
          const blob = await renderMp3(mix, 41, sampleRate, 256, load, () => {}), context = new AudioContext({ sampleRate });
          try {
            const decoded = await context.decodeAudioData(await blob.arrayBuffer());
            if (decoded.numberOfChannels !== 2 || decoded.duration < 41 || decoded.duration > 41.15) throw new Error('MP3 duration/channels changed');
            for (const second of [20, 40]) for (const channel of [0, 1]) {
              const samples = decoded.getChannelData(channel); let maxStep = 0;
              for (let i = Math.round((second - .1) * sampleRate); i < Math.round((second + .15) * sampleRate); i++) maxStep = Math.max(maxStep, Math.abs(samples[i] - samples[i - 1]));
              if (maxStep > .001) throw new Error(JSON.stringify({ check: 'decoded MP3', sampleRate, second, channel, maxStep }));
              results.push({ check: 'decoded MP3', sampleRate, second, channel, maxStep });
            }
          } finally { await context.close(); }
        }
      }
      return results;
    });
  } finally { await page.close(); }
  await writeFile(new URL('audit-fixes-evidence.json', output), JSON.stringify(evidence, null, 2) + '\n');
  console.log('Audit fixes: latest startup state, revalidation, honest file finalization and production WAV/decoded MP3 joins passed');
}
