import assert from 'node:assert/strict';
import { revealMixerControl } from './browser-mixer-helpers.mjs';
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function bellRegressions(browser, previewUrl, artifacts) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 1000 }, acceptDownloads: true });
  const errors = [], requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  const commit = async (selector, value) => { await revealMixerControl(page, selector); await page.locator(selector).fill(String(value)); await page.locator(selector).press('Tab'); };
  await page.addInitScript(() => {
    window.__bellQA = [];
    const original = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = original.call(this), entry = { source, context: this, starts: [], stops: [] };
      source.addEventListener('ended', () => { entry.ended = true; });
      window.__bellQA.push(entry);
      const start = source.start.bind(source), stop = source.stop.bind(source);
      source.start = (...args) => { entry.starts.push(args); return start(...args); };
      source.stop = (...args) => { entry.stops.push(args); return stop(...args); };
      return source;
    };
  });
  try {
    await page.goto(previewUrl, { waitUntil: 'networkidle' });
    assert(!requests.some((url) => /\.(?:mp3|wav)$/.test(url)), 'recordings remain lazy');
    for (const [id, name] of [['bell-33', 'Singing Bowl I'], ['bell-37', 'Singing Bowl II']]) {
      assert.equal(await page.locator('[data-sound="' + id + '"] h3').textContent(), name);
      assert.equal(await page.locator('[data-enable="' + id + '"]').getAttribute('aria-label'), 'Enable ' + name);
      assert.equal(await page.locator('[data-repeat="' + id + '"]').getAttribute('aria-label'), name + ' repeat interval in minutes');
    }
    for (const id of ['campfire', 'bell-33', 'bell-37']) assert.equal(await page.locator('[data-enable="' + id + '"]').isChecked(), false);
    for (const id of ['bell-33', 'bell-37']) {
      const field = page.locator('[data-repeat="' + id + '"]');
      const down = page.locator('[data-repeat-adjust="' + id + '"][data-step="-1"]');
      const up = page.locator('[data-repeat-adjust="' + id + '"][data-step="1"]');
      await revealMixerControl(page, '[data-repeat="' + id + '"]');
      for (const value of ['0.75', '0.5', '0.25']) {
        await field.press('ArrowDown');
        assert.equal(await field.inputValue(), value);
      }
      assert(await down.isDisabled());
      await field.press('ArrowDown'); assert.equal(await field.inputValue(), '0.25');
      await up.click(); assert.equal(await field.inputValue(), '0.5');
      await down.click(); assert.equal(await field.inputValue(), '0.25');
      await field.fill('1'); assert(!(await down.isDisabled()));
      await down.click(); assert.equal(await field.inputValue(), '0.75');
      await commit('[data-repeat="' + id + '"]', .3333);
      assert(await field.evaluate((input) => input.checkValidity()), 'custom whole-second intervals remain valid');
      await field.press('ArrowUp'); assert.equal(await field.inputValue(), '0.5833');
      assert.equal(await page.evaluate((bell) => JSON.parse(localStorage.getItem('beat-mixer.current.v1')).mix.bells[bell].interval, id), 35);
      await down.click(); assert.equal(await field.inputValue(), '0.3333');
      await field.press('ArrowDown'); assert.equal(await field.inputValue(), '0.25');
      await commit('[data-repeat="' + id + '"]', 120); assert(await up.isDisabled());
      await field.press('ArrowUp'); assert.equal(await field.inputValue(), '120');
      await field.fill('1'); assert(!(await up.isDisabled()));
      await field.press('ArrowUp'); assert.equal(await field.inputValue(), '1.25');
      await commit('[data-repeat="' + id + '"]', 0); assert.equal(await field.inputValue(), '1.25');
      await commit('[data-repeat="' + id + '"]', .25);
      assert.equal(await page.locator('[data-enable="' + id + '"]').isChecked(), false, 'editing an interval does not enable a bell');
    }
    await page.reload();
    for (const id of ['bell-33', 'bell-37']) {
      assert.equal(await page.locator('[data-repeat="' + id + '"]').inputValue(), '0.25');
      assert.equal(await page.evaluate((bell) => JSON.parse(localStorage.getItem('beat-mixer.current.v1')).mix.bells[bell].interval, id), 15);
    }
    await revealMixerControl(page, 'input[name="mode"][value="off"]'); await page.locator('input[name="mode"][value="off"]').check();
    await revealMixerControl(page, '[data-enable="stream"]'); await page.locator('[data-enable="stream"]').uncheck();
    await commit('#fade-in', 0); await commit('#fade-out', 0);
    await commit('[data-repeat="bell-33"]', 1); await commit('[data-repeat="bell-37"]', 5);
    for (const id of ['campfire', 'bell-33', 'bell-37']) { await revealMixerControl(page, '[data-enable="' + id + '"]'); await page.locator('[data-enable="' + id + '"]').check(); }
    await page.locator('#play-button').click();
    await page.waitForFunction(() => [10.9339, 5.115624].every((duration) => window.__bellQA.some((entry) => entry.starts.length && Math.abs((entry.source.buffer?.duration || 0) - duration) < .001)));
    const starts = await page.evaluate(() => {
      const all = window.__bellQA.filter((entry) => entry.starts.length);
      return [10.9339, 5.115624].map((duration) => {
        const matching = all.filter((entry) => Math.abs(entry.source.buffer.duration - duration) < .001);
        return { duration: matching[0]?.source.buffer.duration, count: matching.length, times: matching.slice(0, 3).map((entry) => entry.starts[0][0]), offset: matching[0]?.starts[0][1] };
      });
    });
    assert(starts[0].count > 20, JSON.stringify(starts)); assert(starts[1].count >= 6, JSON.stringify(starts));
    assert(Math.abs(starts[0].times[2] - starts[0].times[1] - 60) < .001);
    assert(Math.abs(starts[1].times[2] - starts[1].times[1] - 300) < .001);
    assert(starts.every((entry) => entry.offset === 0), 'first strikes retain their full attack after initial loading');
    assert(requests.some((url) => url.endsWith('/campfire.mp3')));
    await revealMixerControl(page, '[data-solo="bell-33"]'); await page.locator('[data-solo="bell-33"]').click();
    assert.equal(await page.locator('[data-solo="bell-33"]').getAttribute('aria-pressed'), 'true');
    assert(await page.locator('[data-sound="campfire"]').evaluate((row) => row.classList.contains('silenced')));
    await page.locator('#clear-solo').click();
    const beforeStep = await page.evaluate(() => window.__bellQA.length);
    await page.locator('[data-repeat-adjust="bell-33"][data-step="-1"]').click();
    await page.waitForFunction((count) => window.__bellQA.length > count, beforeStep);
    const stepped = await page.evaluate((count) => {
      const old = window.__bellQA.slice(0, count).filter((entry) => Math.abs((entry.source.buffer?.duration || 0) - 10.9339) < .001);
      const next = window.__bellQA.slice(count).filter((entry) => Math.abs((entry.source.buffer?.duration || 0) - 10.9339) < .001);
      return { stopped: old.every((entry) => entry.stops.length > 0 || entry.ended), delta: next[2].starts[0][0] - next[1].starts[0][0] };
    }, beforeStep);
    assert.equal(await page.locator('[data-repeat="bell-33"]').inputValue(), '0.75');
    assert(stepped.stopped); assert(Math.abs(stepped.delta - 45) < .001, 'arrows reschedule live audio at the sub-minute interval');
    const beforeChange = await page.evaluate(() => window.__bellQA.length);
    await commit('[data-repeat="bell-33"]', 5);
    await page.waitForFunction((count) => window.__bellQA.length > count, beforeChange);
    const changed = await page.evaluate((count) => {
      const old = window.__bellQA.slice(0, count).filter((entry) => Math.abs((entry.source.buffer?.duration || 0) - 10.9339) < .001);
      const next = window.__bellQA.slice(count).filter((entry) => Math.abs((entry.source.buffer?.duration || 0) - 10.9339) < .001);
      return { stopped: old.every((entry) => entry.stops.length > 0 || entry.ended), delta: next[2].starts[0][0] - next[1].starts[0][0] };
    }, beforeChange);
    assert(changed.stopped); assert(Math.abs(changed.delta - 300) < .001);
    await page.locator('#play-button').click();
    await page.waitForFunction(() => document.getElementById('status').textContent === 'Paused');
    const paused = await page.evaluate(() => ({ time: window.__bellQA[0].context.currentTime, count: window.__bellQA.length, stopped: window.__bellQA.every((entry) => entry.stops.length || entry.ended) }));
    assert(paused.stopped);
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate(() => window.__bellQA[0].context.currentTime), paused.time);
    await page.locator('#play-button').click();
    await page.waitForFunction((count) => window.__bellQA.length > count, paused.count);
    const resumed = await page.evaluate((count) => window.__bellQA.slice(count).find((entry) => Math.abs((entry.source.buffer?.duration || 0) - 10.9339) < .001)?.starts[0], paused.count);
    assert(resumed[1] > starts[0].offset, 'resume continues the decay rather than retriggering it');
    await page.locator('#stop-button').click();
    await page.waitForFunction(() => document.getElementById('status').textContent === 'Stopped');
    await page.reload();
    assert.equal(await page.locator('[data-repeat="bell-33"]').inputValue(), '5');
    assert.equal(await page.locator('[data-repeat="bell-37"]').inputValue(), '5');
    assert(await page.locator('[data-enable="campfire"]').isChecked());
    assert.equal(await page.locator('#status').textContent(), 'Ready');
    const current = await page.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.current.v1')).mix);
    assert.equal(current.bells['bell-33'].interval, 300); assert.equal(current.bells['bell-37'].interval, 300);
    await page.locator('#open-export').click();
    await page.locator('[data-export-tab="mix"]').click();
    const downloadTask = page.waitForEvent('download'); await page.locator('#download-export').click();
    const download = await downloadTask, jsonPath = new URL('bell-mix.json', artifacts);
    await download.saveAs(fileURLToPath(jsonPath));
    const json = JSON.parse(await readFile(jsonPath, 'utf8'));
    assert.equal(json.version, 4); assert.deepEqual(json.mix, current);
    await page.locator('#cancel-export').click();
    const exported = await page.evaluate(async () => {
      const { makeMixFile, parseBackup } = await import('./src/library.mjs');
      const mix = JSON.parse(localStorage.getItem('beat-mixer.current.v1')).mix, file = makeMixFile(mix);
      return { version: file.version, same: JSON.stringify(parseBackup(JSON.stringify(file)).entries[0].mix) === JSON.stringify(mix) };
    });
    assert.deepEqual(exported, { version: 4, same: true });
    const rendered = await page.evaluate(async () => {
      const { AudioEngine } = await import('./src/audio-engine.js');
      const { defaultMix } = await import('./src/mix-state.mjs');
      const { renderWav } = await import('./src/wav-export.mjs');
      const { renderMp3 } = await import('./src/mp3-export.mjs');
      const mix = defaultMix(); mix.mode = 'off'; mix.sounds.stream.enabled = false;
      mix.bells['bell-33'].enabled = true; mix.bells['bell-33'].interval = 15;
      mix.bells['bell-33'].level = 55; mix.fades = { in: 0, out: 0 };
      const engine = new AudioEngine(); engine.update(mix);
      const load = (id) => engine.buffer(id), noop = () => {};
      const one = await renderWav(mix, 23, 44100, load, noop, null, 30);
      const blocks = await renderWav(mix, 23, 44100, load, noop, null, 5);
      const bytes = new DataView(await one.arrayBuffer()), chunked = new DataView(await blocks.arrayBuffer());
      let error = 0, max = 0;
      for (let i = 44; i < bytes.byteLength; i += 2) { const delta = (bytes.getInt16(i, true) - chunked.getInt16(i, true)) / 32768; error += delta * delta; max = Math.max(max, Math.abs(delta)); }
      const rms = (data, from, to) => {
        let energy = 0; for (let frame = Math.round(from * 44100); frame < Math.round(to * 44100); frame++) energy += (data.getInt16(44 + frame * 4, true) / 32768) ** 2;
        return Math.sqrt(energy / Math.round((to - from) * 44100));
      };
      const mp3 = await renderMp3(mix, 23, 44100, 192, load, noop, null, 5);
      const decoded = await engine.context.decodeAudioData(await mp3.arrayBuffer());
      const mp3Rms = (from, to) => {
        const data = decoded.getChannelData(0); let energy = 0;
        for (let i = Math.round(from * decoded.sampleRate); i < Math.round(to * decoded.sampleRate); i++) energy += data[i] ** 2;
        return Math.sqrt(energy / ((to - from) * decoded.sampleRate));
      };
      const buffers = {};
      for (const id of ['campfire', 'bell-33', 'bell-37']) { const buffer = await load(id); buffers[id] = { channels: buffer.numberOfChannels, duration: buffer.duration }; }
      await engine.context.close();
      const windows = Array.from({ length: 23 }, (_, second) => {
        let difference = 0, peak = 0;
        for (let frame = second * 44100; frame < (second + 1) * 44100; frame++) {
          const delta = (bytes.getInt16(44 + frame * 4, true) - chunked.getInt16(44 + frame * 4, true)) / 32768;
          difference += delta ** 2; peak = Math.max(peak, Math.abs(delta));
        }
        return { second, rms: Math.sqrt(difference / 44100), peak };
      });
      return { frames: (bytes.byteLength - 44) / 4, rmsDiff: Math.sqrt(error / ((bytes.byteLength - 44) / 2)), maxDiff: max,
        first: rms(bytes, 0, 5), silence: rms(bytes, 12, 14), second: rms(bytes, 15, 20), tailAcrossJoin: rms(chunked, 20, 22),
        mp3: { channels: decoded.numberOfChannels, duration: decoded.duration, second: mp3Rms(15.1, 20), silence: mp3Rms(12, 14) }, buffers, windows };
    });
    assert.equal(rendered.frames, 23 * 44100);
    assert(rendered.first > .001 && rendered.second > .001 && rendered.tailAcrossJoin > .00001);
    assert.equal(rendered.silence, 0); assert(rendered.rmsDiff < .0001, JSON.stringify(rendered));
    assert.equal(rendered.mp3.channels, 2); assert(rendered.mp3.duration >= 23 && rendered.mp3.duration < 23.2);
    assert(rendered.mp3.second > .001); assert(rendered.mp3.silence < .00001);
    assert(Object.values(rendered.buffers).every((buffer) => buffer.channels === 2));
    assert(Math.abs(rendered.buffers['bell-33'].duration - 10.9339) < .001);
    assert(Math.abs(rendered.buffers['bell-37'].duration - 5.115624) < .001);
    assert(Math.abs(rendered.buffers.campfire.duration - (12.725542 - 1.5)) < .001);
    await page.locator('#theme-mode').selectOption('dark');
    await revealMixerControl(page, '[data-repeat="bell-33"]');
    await page.locator('#bell-list').screenshot({ path: fileURLToPath(new URL('bell-controls-desktop.png', artifacts)) });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#bell-list').scrollIntoViewIfNeeded();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: fileURLToPath(new URL('bell-controls-mobile.png', artifacts)), fullPage: true });
    for (const theme of ['Light', 'Dark', 'Green', 'Blue', 'Matrix']) {
      await page.locator('#theme-mode').selectOption({ label: theme });
      for (const width of [320, 390, 768, 1365]) {
        await page.setViewportSize({ width, height: 1000 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), theme + ' at ' + width);
        for (const id of ['bell-33', 'bell-37']) {
          const fits = await page.locator('[data-sound="' + id + '"] .bell-repeat').evaluate((row) => {
            const bounds = row.getBoundingClientRect(), label = row.querySelector('label').getBoundingClientRect();
            const controls = row.querySelector('.bell-interval-controls').getBoundingClientRect();
            return controls.left >= bounds.left - 1 && controls.right <= bounds.right + 1 &&
              (controls.left >= label.right - 1 || controls.top >= label.bottom - 1);
          });
          assert(fits, id + ' controls fit without overlap: ' + theme + ' at ' + width);
        }
      }
    }
    await page.setViewportSize({ width: 320, height: 844 });
    await page.locator('#bell-list').screenshot({ path: fileURLToPath(new URL('bell-controls-matrix-320.png', artifacts)) });
    assert.deepEqual(errors, []);
    await writeFile(new URL('bells.json', artifacts), JSON.stringify({ starts, stepped, changed, rendered, exported, errors }, null, 2));
    console.log('Campfire and bells: 15-second arrows, custom intervals, real decode, live edits/pause, persistence, v4 JSON, chunked WAV/MP3 tails and responsive controls passed');
  } finally { await page.close(); }
}
