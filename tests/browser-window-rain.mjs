import assert from 'node:assert/strict';
import { revealMixerControl } from './browser-mixer-helpers.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function windowRainRegressions(browser, url, output) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 1000 }, acceptDownloads: true });
  const errors = [], requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  const range = async (selector, value) => page.locator(selector).evaluate((input, next) => { input.value = next; input.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-enable="window-rain"]').isChecked(), false);
    assert(!requests.some((request) => request.endsWith('/window-rain.mp3')));
    await revealMixerControl(page, 'input[name="mode"][value="off"]'); await page.locator('input[name="mode"][value="off"]').check();
    await revealMixerControl(page, '[data-enable="stream"]'); await page.locator('[data-enable="stream"]').uncheck();
    await revealMixerControl(page, '[data-enable="window-rain"]'); await page.locator('[data-enable="window-rain"]').check();
    await range('[data-volume="window-rain"]', 62); await range('[data-pan="window-rain"]', -40);
    await revealMixerControl(page, '[data-enable="pink"]'); await page.locator('[data-enable="pink"]').check();
    await revealMixerControl(page, '[data-solo="window-rain"]'); await page.locator('[data-solo="window-rain"]').click();
    assert(await page.locator('[data-sound="pink"]').evaluate((row) => row.classList.contains('silenced')));
    await revealMixerControl(page, '[data-mute="window-rain"]'); await page.locator('[data-mute="window-rain"]').click();
    assert.equal(await page.locator('[data-track-state="window-rain"]').textContent(), 'Muted');
    await revealMixerControl(page, '[data-mute="window-rain"]'); await page.locator('[data-mute="window-rain"]').click();
    await page.locator('#play-button').click();
    await page.waitForFunction(() => document.getElementById('status').textContent === 'Playing' && document.querySelector('[data-track-state="window-rain"]').textContent === 'Solo');
    assert(requests.some((request) => request.endsWith('/window-rain.mp3')));
    await page.locator('#play-button').click();
    await page.waitForFunction(() => document.getElementById('status').textContent === 'Paused');
    await page.reload();
    assert(await page.locator('[data-enable="window-rain"]').isChecked());
    assert.equal(await page.locator('[data-volume="window-rain"]').inputValue(), '62');
    assert.equal(await page.locator('[data-pan="window-rain"]').inputValue(), '-40');
    await page.locator('#open-export').click(); await page.locator('[data-export-tab="mix"]').click();
    const waiting = page.waitForEvent('download'); await page.locator('#download-export').click();
    const download = await waiting, path = new URL('window-rain-mix.json', output);
    await download.saveAs(fileURLToPath(path));
    const file = JSON.parse(await readFile(path, 'utf8')); assert.equal(file.version, 5);
    assert.deepEqual(file.mix.sounds['window-rain'], { enabled: true, level: 62, pan: -40, muted: false, solo: true });
    await page.locator('#cancel-export').click();
    const audio = await page.evaluate(async () => {
      const { defaultMix } = await import('./src/mix-state.mjs');
      const { AudioEngine } = await import('./src/audio-engine.js');
      const { renderWav } = await import('./src/wav-export.mjs');
      const { renderMp3 } = await import('./src/mp3-export.mjs');
      const mix = defaultMix(); mix.mode = 'off'; mix.sounds.stream.enabled = false; mix.sounds['window-rain'].enabled = true; mix.fades = { in: 0, out: 0 };
      const engine = new AudioEngine(); engine.update(mix);
      try {
        const buffer = await engine.buffer('window-rain'), load = (id) => engine.buffer(id), noop = () => {};
        const wav = await renderWav(mix, 23, 44100, load, noop, null, 5);
        const decoded = await engine.context.decodeAudioData(await wav.arrayBuffer());
        const rms = (data) => Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
        const channels = [0, 1].map((channel) => decoded.getChannelData(channel)), joins = [];
        for (const time of [buffer.duration, 2 * buffer.duration]) {
          const frame = Math.round(time * decoded.sampleRate), data = channels[0];
          let localMax = 0;
          for (let i = frame - 441; i < frame + 441; i++) if (Math.abs(i - frame) > 2) localMax = Math.max(localMax, Math.abs(data[i] - data[i - 1]));
          joins.push({ time, step: Math.abs(data[frame] - data[frame - 1]), localMax });
        }
        const mp3 = await renderMp3(mix, 23, 44100, 192, load, noop, null, 5);
        const compressed = await engine.context.decodeAudioData(await mp3.arrayBuffer());
        return { loopDuration: buffer.duration, sourceChannels: buffer.numberOfChannels, wavBytes: wav.size,
          rms: channels.map(rms), joins, mp3Channels: compressed.numberOfChannels, mp3Duration: compressed.duration, mp3Rms: rms(compressed.getChannelData(0)) };
      } finally { await engine.context?.close(); }
    });
    assert.equal(audio.sourceChannels, 2); assert(Math.abs(audio.loopDuration - 9.366259) < .001);
    assert.equal(audio.wavBytes, 23 * 44100 * 4 + 44); assert(audio.rms.every((value) => value > .001 && value < .5));
    assert(audio.joins.every((join) => join.step <= Math.max(2 * join.localMax, 1 / 32768) && join.localMax < .15), JSON.stringify(audio));
    assert.equal(audio.mp3Channels, 2); assert(audio.mp3Duration >= 23 && audio.mp3Duration < 23.2); assert(audio.mp3Rms > .001);
    await page.locator('#theme-mode').selectOption('dark');
    const row = page.locator('[data-sound="window-rain"]');
    for (const width of [1365, 390, 320]) {
      await page.setViewportSize({ width, height: 900 }); await revealMixerControl(page, '[data-enable="window-rain"]'); await row.scrollIntoViewIfNeeded();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await row.locator('.sound-icon img').evaluate((image) => image.complete && image.naturalWidth > 0));
      await row.screenshot({ path: fileURLToPath(new URL('window-rain-' + width + '.png', output)) });
    }
    assert.deepEqual(errors, []);
    await writeFile(new URL('window-rain.json', output), JSON.stringify({ audio, mix: file.mix.sounds['window-rain'], errors }, null, 2));
    console.log('Window rain: lazy decode, channel controls, persistence, v5 JSON, looped WAV/MP3 and responsive artwork passed');
  } finally { await page.close(); }
}
