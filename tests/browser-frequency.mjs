import assert from 'node:assert/strict';
import { revealMixerControl } from './browser-mixer-helpers.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseBackup } from '../src/library.mjs';

export async function frequencyRegressions(browser, url, output) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
  page.setDefaultTimeout(20000);
  const errors = [], evidence = {};
  page.on('pageerror', (error) => errors.push(error.message));
  const commit = async (selector, value) => { await revealMixerControl(page, selector); await page.locator(selector).fill(String(value)); await page.locator(selector).press('Tab'); };
  const download = async () => {
    const pending = page.waitForEvent('download'); await page.locator('#download-export').click();
    return readFile(await (await pending).path());
  };
  try {
    await page.goto(url);
    for (const id of ['beat-value', 'beat-rate', 'sweep-start', 'sweep-end']) {
      assert.equal(await page.locator('#' + id).getAttribute('min'), '0.1');
      assert.equal(await page.locator('#' + id).getAttribute('max'), '120');
      assert.equal(await page.locator('#' + id).getAttribute('step'), '0.01');
    }
    for (const id of ['carrier-value', 'carrier']) {
      assert.equal(await page.locator('#' + id).getAttribute('min'), '1');
      assert.equal(await page.locator('#' + id).getAttribute('max'), '5000');
    }
    await page.locator('#theme-mode').selectOption('dark');
    await revealMixerControl(page, 'input[name="mode"][value="isochronic"]'); await page.locator('input[name="mode"][value="isochronic"]').check();
    await revealMixerControl(page, '[data-enable="stream"]'); await page.locator('[data-enable="stream"]').uncheck();
    await commit('#fade-in', 0); await commit('#fade-out', 0);
    await commit('#carrier-value', 1); await commit('#beat-value', .1);
    await page.locator('#save-mix').click(); await page.locator('#mix-name').fill('Low boundary'); await page.locator('#save-form button[type="submit"]').click();
    await page.reload();
    assert.equal(await page.locator('#beat-value').inputValue(), '0.10'); assert.equal(await page.locator('#carrier-value').inputValue(), '1');
    assert.equal(await page.locator('#status').textContent(), 'Ready');
    await commit('#carrier-value', 5000); await commit('#beat-value', 120);
    await page.locator('#save-mix').click(); await page.locator('#mix-name').fill('High boundary'); await page.locator('#save-form button[type="submit"]').click();
    await revealMixerControl(page, 'input[name="program"][value="sweep"]'); await page.locator('input[name="program"][value="sweep"]').check();
    await commit('#sweep-start', .1); await commit('#sweep-end', 120);
    await revealMixerControl(page, 'input[name="program"][value="sequence"]'); await page.locator('input[name="program"][value="sequence"]').check();
    await page.locator('[data-stage="0"] [data-stage-key="type"]').selectOption('sweep');
    await commit('[data-stage="0"] [data-stage-key="start"]', .1); await commit('[data-stage="0"] [data-stage-key="end"]', 120);
    assert.equal(await page.locator('[data-stage="0"] [data-stage-key="start"]').inputValue(), '0.10');
    assert.equal(await page.locator('[data-stage="0"] [data-stage-key="end"]').inputValue(), '120.00');
    await page.locator('#open-export').click(); await page.locator('[data-export-tab="library"]').click();
    const backup = await download(), parsed = parseBackup(backup.toString('utf8'));
    assert.equal(JSON.parse(backup).version, 3); assert.equal(parsed.entries.length, 2);
    assert.equal(parsed.entries[0].mix.carrier, 1); assert.equal(parsed.entries[0].mix.beat, .1);
    assert.equal(parsed.entries[1].mix.carrier, 5000); assert.equal(parsed.entries[1].mix.beat, 120);
    assert.equal(parsed.current.mix.automation.sweep.end, 120); assert.equal(parsed.current.mix.automation.stages[0].start, .1);
    await page.locator('[data-export-tab="mix"]').click();
    const mixFile = await download(); assert.equal(JSON.parse(mixFile).version, 3);
    assert.deepEqual(parseBackup(mixFile.toString('utf8')).entries[0].mix, parsed.current.mix);
    await page.locator('#cancel-export').click();
    await page.locator('#reset-mix').click();
    await page.locator('#open-import').click();
    await page.locator('#import-file').setInputFiles({ name: 'expanded-library.json', mimeType: 'application/json', buffer: backup });
    await page.locator('#import-action').selectOption('replace'); await page.locator('#import-current').uncheck();
    await page.locator('#confirm-import').click();
    await page.locator('#mix-select').selectOption({ label: 'Low boundary' });
    assert.equal(await page.locator('#beat-value').inputValue(), '0.10'); assert.equal(await page.locator('#carrier-value').inputValue(), '1');
    assert.equal(await page.locator('#status').textContent(), 'Ready');
    await page.locator('#mix-select').selectOption({ label: 'High boundary' });
    await revealMixerControl(page, 'input[name="mode"][value="binaural"]'); await page.locator('input[name="mode"][value="binaural"]').check(); await commit('#carrier-value', 60);
    assert((await page.locator('#signal-error').textContent()).includes('positive frequency'));
    await commit('#carrier-value', 61); assert.equal(await page.locator('#signal-error').textContent(), '');
    await commit('#carrier-value', 5000); await revealMixerControl(page, 'input[name="mode"][value="isochronic"]'); await page.locator('input[name="mode"][value="isochronic"]').check();
    await page.locator('#play-button').click(); await page.waitForFunction(() => document.querySelector('#status').textContent === 'Playing');
    await page.waitForFunction(() => parseFloat(document.querySelector('#signal-level').textContent) > -50);
    await page.locator('[data-view="spectrum"]').click();
    await page.screenshot({ path: fileURLToPath(new URL('frequency-range-desktop.png', output)), fullPage: true });
    await page.locator('#stop-button').click();
    await page.locator('#open-export').click(); await page.locator('[data-export-tab="audio"]').click();
    await commit('#export-seconds', 1); await page.locator('#export-format').selectOption('wav');
    const wav = await download(); assert.equal(wav.length, 44 + 44100 * 4);
    await page.locator('#export-format').selectOption('mp3');
    const mp3 = await download();
    evidence.mp3 = await page.evaluate(async (base64) => {
      const context = new AudioContext({ sampleRate: 44100 });
      try {
        const buffer = await context.decodeAudioData(Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)).buffer);
        const data = buffer.getChannelData(0), count = 11025, from = 8820;
        let real = 0, imaginary = 0;
        for (let i = 0; i < count; i++) { const phase = 2 * Math.PI * 5000 * i / buffer.sampleRate; real += data[from + i] * Math.cos(phase); imaginary += data[from + i] * Math.sin(phase); }
        return { channels: buffer.numberOfChannels, duration: buffer.duration, carrier5000: Math.hypot(real, imaginary) * 2 / count };
      } finally { await context.close(); }
    }, mp3.toString('base64'));
    assert.equal(evidence.mp3.channels, 2); assert(evidence.mp3.duration >= 1 && evidence.mp3.duration < 1.15); assert(evidence.mp3.carrier5000 > .001);
    await page.locator('#cancel-export').click();

    for (const width of [320, 390, 768, 1365]) {
      await page.setViewportSize({ width, height: 1000 });
      const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, clipped: [...document.querySelectorAll('input, select, button')].filter((element) => element.getClientRects().length && (element.getBoundingClientRect().left < -1 || element.getBoundingClientRect().right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 2)).map((element) => element.id || element.textContent) }));
      assert(layout.scroll <= layout.width, JSON.stringify(layout)); assert.deepEqual(layout.clipped, []);
      if (width === 390) {
        await page.screenshot({ path: fileURLToPath(new URL('frequency-range-mobile.png', output)), fullPage: true });
        await page.locator('.generator-panel').screenshot({ path: fileURLToPath(new URL('frequency-generator-mobile.png', output)) });
      }
    }

    evidence.nativeAudio = await page.evaluate(async () => {
      const { defaultMix } = await import(new URL('src/mix-state.mjs', location.href));
      const { toneGraph, pulseValue } = await import(new URL('src/audio-graph.mjs', location.href));
      const { renderWav } = await import(new URL('src/wav-export.mjs', location.href));
      const results = [];
      for (const sampleRate of [44100, 48000]) for (const mode of ['binaural', 'monaural', 'isochronic']) for (const [beat, carrier, seconds] of [[.1, 1, 10], [.1, 5000, 10], [120, 5000, 1], ...(mode === 'isochronic' ? [[120, 1, 1]] : [])]) {
        const mix = defaultMix(); mix.mode = mode; mix.beat = beat; mix.carrier = carrier;
        const context = new OfflineAudioContext(2, seconds * sampleRate, sampleRate);
        const tone = toneGraph(context, mix, context.destination, 0, 0, seconds); tone.output.gain.value = 1; tone.stop(seconds);
        const rendered = await context.startRendering();
        // Independent native oscillators distinguish routing errors from browser phase precision.
        const referenceContext = new OfflineAudioContext(3, seconds * sampleRate, sampleRate), merger = referenceContext.createChannelMerger(3);
        merger.connect(referenceContext.destination);
        for (const [channel, frequency] of [carrier - beat / 2, carrier + beat / 2, carrier].entries()) {
          const oscillator = referenceContext.createOscillator(); oscillator.frequency.value = frequency;
          oscillator.setPeriodicWave(referenceContext.createPeriodicWave(new Float32Array([0, 0]), new Float32Array([0, 1]), { disableNormalization: true }));
          oscillator.connect(merger, 0, channel); oscillator.start();
        }
        const referenceBuffer = await referenceContext.startRendering(), native = [0, 1, 2].map((channel) => referenceBuffer.getChannelData(channel));
        let error = 0, energy = 0, peak = 0;
        for (let channel = 0; channel < 2; channel++) {
          const data = rendered.getChannelData(channel);
          for (let i = 0; i < data.length; i++) {
            const time = i / sampleRate;
            const reference = mode === 'binaural' ? .5 * native[channel][i] : mode === 'monaural' ? .25 * (native[0][i] + native[1][i]) : .5 * native[2][i] * pulseValue(beat * time, mix.pulse);
            if (!Number.isFinite(data[i])) throw new Error('Non-finite audio sample');
            error += (data[i] - reference) ** 2; energy += data[i] ** 2; peak = Math.max(peak, Math.abs(data[i] - reference));
          }
        }
        const rmsError = Math.sqrt(error / rendered.length / 2), rms = Math.sqrt(energy / rendered.length / 2);
        if (rmsError > .003 || peak > .03 || rms < .001) throw new Error(JSON.stringify({ mode, sampleRate, beat, carrier, rmsError, peak, rms }));
        results.push({ mode, sampleRate, beat, carrier, rmsError, peak, rms });
      }
      for (const sampleRate of [44100, 48000]) for (const width of [10, 90]) for (const softness of [0, 100]) {
        const mix = defaultMix(); mix.mode = 'isochronic'; mix.beat = 120; mix.carrier = 5000; mix.pulse = { width, softness, depth: 100 };
        const context = new OfflineAudioContext(2, sampleRate / 4, sampleRate), tone = toneGraph(context, mix, context.destination, 0, 0, .25);
        tone.output.gain.value = 1;
        const data = (await context.startRendering()).getChannelData(0);
        let peak = 0, energy = 0;
        for (const value of data) { if (!Number.isFinite(value)) throw new Error('Non-finite pulse corner sample'); peak = Math.max(peak, Math.abs(value)); energy += value ** 2; }
        const rms = Math.sqrt(energy / data.length);
        if (peak > .8 || rms < .001) throw new Error(JSON.stringify({ sampleRate, width, softness, peak, rms }));
        results.push({ check: 'Pulse-shape corners', sampleRate, width, softness, peak, rms });
      }
      for (const sampleRate of [44100, 48000]) for (const [beat, carrier] of [[.1, 1], [120, 5000]]) {
        const mix = defaultMix(); mix.mode = 'isochronic'; mix.beat = beat; mix.carrier = carrier; mix.sounds.stream.enabled = false; mix.fades = { in: 0, out: 0 };
        const load = () => { throw new Error('Pure-tone check must not load recordings'); };
        const full = new DataView(await (await renderWav(mix, 12, sampleRate, load, () => {}, null, 20)).arrayBuffer());
        const split = new DataView(await (await renderWav(mix, 12, sampleRate, load, () => {}, null, 1)).arrayBuffer());
        let error = 0, peak = 0;
        for (let i = 44; i < full.byteLength; i += 2) { const difference = (full.getInt16(i, true) - split.getInt16(i, true)) / 32768; error += difference ** 2; peak = Math.max(peak, Math.abs(difference)); }
        const rmsError = Math.sqrt(error / ((full.byteLength - 44) / 2));
        if (rmsError > .001 || peak > .01) throw new Error(JSON.stringify({ sampleRate, beat, carrier, rmsError, peak }));
        results.push({ check: 'WAV full/chunk equivalence', sampleRate, beat, carrier, rmsError, peak });
      }
      return results;
    });
    assert.deepEqual(errors, []);
    evidence.jsonVersion = 3; evidence.errors = errors;
    await writeFile(new URL('frequency-range-evidence.json', output), JSON.stringify(evidence, null, 2) + '\n');
  } finally { await page.close(); }

  const limited = await browser.newPage();
  try {
    await limited.addInitScript(() => { const Native = AudioContext; window.AudioContext = class extends Native { constructor(options) { super({ ...options, sampleRate: 32000 }); } }; });
    await limited.goto(url);
    await revealMixerControl(limited, 'input[name="mode"][value="isochronic"]'); await limited.locator('input[name="mode"][value="isochronic"]').check();
    for (const [id, value] of [['#carrier-value', '5000'], ['#beat-value', '120']]) { await limited.locator(id).fill(value); await limited.locator(id).press('Tab'); }
    await limited.locator('#play-button').click();
    await limited.waitForFunction(() => document.querySelector('#status').textContent === 'Audio unavailable');
    assert((await limited.locator('#signal-error').textContent()).includes('sample rate'));
    for (const [id, value] of [['#carrier-value', '200'], ['#beat-value', '8']]) { await limited.locator(id).fill(value); await limited.locator(id).press('Tab'); }
    await limited.locator('#play-button').click();
    await limited.waitForFunction(() => document.querySelector('#status').textContent === 'Playing');
    await limited.waitForFunction(() => parseFloat(document.querySelector('#signal-level').textContent) > -60);
    for (const [id, value] of [['#carrier-value', '5000'], ['#beat-value', '120']]) { await limited.locator(id).fill(value); await limited.locator(id).press('Tab'); }
    assert((await limited.locator('#signal-error').textContent()).includes('sample rate'));
    assert.equal(await limited.locator('#status').textContent(), 'Playing');
    await revealMixerControl(limited, '[data-enable="stream"]'); await limited.locator('[data-enable="stream"]').uncheck();
    await limited.waitForFunction(() => document.querySelector('#signal-level').textContent === '-- dBFS');
    await revealMixerControl(limited, '[data-enable="stream"]'); await limited.locator('[data-enable="stream"]').check();
    await limited.waitForFunction(() => parseFloat(document.querySelector('#signal-level').textContent) > -60);
    await revealMixerControl(limited, 'input[name="mode"][value="off"]'); await limited.locator('input[name="mode"][value="off"]').check();
    assert.equal(await limited.locator('#signal-error').textContent(), '');
  } finally { await limited.close(); }
  console.log('Expanded frequency regressions: UI, saved/imported v3 mixes, sample-rate guard, native reference audio and WAV/MP3 export passed');
}
