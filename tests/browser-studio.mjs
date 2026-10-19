import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openStageChanges } from './browser-mixer-helpers.mjs';

export async function studioRegressions(browser, url, output) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 1000 }, acceptDownloads: true });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const commit = async (selector, value) => { await page.locator(selector).fill(String(value)); await page.locator(selector).press('Tab'); };
  await page.addInitScript(() => {
    window.__studioOscillators = []; window.__studioBuffers = [];
    const oscillator = AudioContext.prototype.createOscillator, buffer = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createOscillator = function () { const node = oscillator.call(this); window.__studioOscillators.push(node); return node; };
    AudioContext.prototype.createBufferSource = function () { const node = buffer.call(this), start = node.start.bind(node), entry = { node, args: null }; window.__studioBuffers.push(entry); node.start = (...args) => { entry.args = args; return start(...args); }; return node; };
  });
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#studio-panel, .mixer-navigation').count(), 0);
    assert.equal(await page.locator('button[data-interface-mode="simple"]').getAttribute('aria-pressed'), 'true');
    assert(await page.locator('[data-open-effects="tone"]').isHidden());
    assert(await page.locator('#session-builder').isHidden());
    assert(await page.locator('#fade-in').isVisible());
    for (const id of ['cascade', 'stream', 'storm', 'waves', 'campfire', 'window-rain', 'white', 'pink', 'brown', 'bell-33', 'bell-37']) assert(await page.locator('[data-enable="' + id + '"]').isVisible(), id + ' remains visible in Simple');
    await page.locator('[data-enable="stream"]').check();
    const originalLayout = await page.evaluate(() => ({ generator: document.querySelector('.generator-panel').getBoundingClientRect().toJSON(), environment: document.querySelector('.environment-panel').getBoundingClientRect().toJSON(), monitor: document.querySelector('.output-panel').getBoundingClientRect().toJSON() }));
    assert(originalLayout.environment.left > originalLayout.generator.right, 'classic generator-left/environment-right layout');
    assert(originalLayout.monitor.bottom <= originalLayout.generator.top, 'monitor stays above the mixer');
    await page.locator('button[data-interface-mode="advanced"]').click();
    await page.locator('[data-carrier-bookmark="tone"]').selectOption('528'); assert.equal(await page.locator('#carrier-value').inputValue(), '528');
    await page.locator('[data-voice-id="tone"][data-voice-key="timbre.shape"]').selectOption('harmonic');
    await commit('[data-voice-id="tone"][data-voice-key="timbre.partials.0"]', 40);
    await page.locator('[data-tone-source="voice-2"]').click();
    await page.locator('[data-voice-id="voice-2"][data-voice-key="enabled"]').check();
    await page.locator('[data-voice-id="voice-2"][data-voice-key="mode"]').selectOption('monaural');
    await page.locator('[data-voice-id="voice-2"][data-voice-key="program"]').selectOption('fixed');
    await commit('[data-voice-id="voice-2"][data-voice-key="beat"]', 12);
    await page.locator('[data-tone-source="tone"]').click();
    await page.locator('[data-open-effects="tone"]').click();
    assert.equal(await page.locator('#studio-source').inputValue(), 'tone');
    await page.locator('[data-fx="am.enabled"]').check(); await page.locator('[data-fx="am.sync"]').selectOption('false');
    await commit('[data-fx="am.rate"]', 10);
    await page.locator('[data-effect-tab="pitch"]').click();
    await page.locator('[data-fx="pitch.mode"]').selectOption('fm'); await commit('[data-fx="pitch.rate"]', .3); await commit('[data-fx="pitch.depth"]', 4);
    await page.locator('[data-effect-tab="filter"]').click();
    await page.locator('[data-fx="filter.type"]').selectOption('lowpass'); await commit('[data-fx="filter.frequency"]', 3000);
    await page.locator('#studio-source').selectOption('window-rain');
    assert(await page.locator('[data-effect-tab="pitch"]').isHidden());
    await page.locator('[data-effect-tab="am"]').click();
    await page.locator('[data-fx="am.enabled"]').check(); await page.locator('[data-fx="am.channels"]').selectOption('offset');
    await page.locator('#close-source-effects').click();
    assert(await page.locator('[data-open-effects="window-rain"]').evaluate((button) => button.classList.contains('has-effects')));
    await page.locator('[data-enable="window-rain"]').check();
    assert.equal(await page.locator('#active-count').textContent(), '2 layers', 'environment count excludes extra tones');
    const configured = await page.evaluate(() => localStorage.getItem('beat-mixer.current.v1'));
    await page.locator('button[data-interface-mode="simple"]').click();
    assert(await page.locator('#advanced-status').isVisible(), 'hidden advanced settings are disclosed');
    assert(await page.locator('#beat-value').isVisible() && await page.locator('#tone-editor-voice-2').isHidden());
    assert.equal(await page.evaluate(() => localStorage.getItem('beat-mixer.current.v1')), configured, 'Simple never clears configured advanced settings');
    await page.locator('button[data-interface-mode="advanced"]').click();
    await page.locator('input[name="program"][value="sequence"]').check(); await openStageChanges(page, 0); await page.locator('[data-add-change="0"]').click();
    const firstChange = '[data-change-stage="0"][data-change-index="0"] ';
    const secondChange = '[data-change-stage="0"][data-change-index="1"] ';
    await commit(firstChange + '[data-change-key="start"]', 0); await commit(firstChange + '[data-change-key="end"]', 40);
    await page.locator('[data-add-change="0"]').click();
    await page.locator(secondChange + '[data-change-key="target"]').selectOption('voice-2:level');
    assert.equal(await page.locator(secondChange + '[data-change-key="start"]').inputValue(), '25');
    await commit(secondChange + '[data-change-key="end"]', 0);
    await page.locator(secondChange + '[data-change-key="target"]').selectOption('tone:level');
    assert.equal(await page.locator(secondChange + '[data-change-key="target"]').inputValue(), 'voice-2:level', 'duplicate setting is rejected');
    await page.locator('[data-stage="0"] [data-stage-action="down"]').click();
    assert.equal(await page.locator('[data-stage="1"] .stage-change-row').count(), 2, 'changes move with the stage');
    await page.locator('[data-stage="1"] [data-stage-action="up"]').click();
    await page.locator('input[name="program"][value="fixed"]').check();
    await page.locator('#play-button').click(); await page.waitForFunction(() => document.getElementById('status').textContent === 'Playing');
    await page.waitForFunction(() => window.__studioBuffers.some((entry) => entry.args && Math.abs((entry.node.buffer?.duration || 0) - 9.366259) < .001));
    const storedBeforeNavigation = await page.evaluate(() => localStorage.getItem('beat-mixer.current.v1'));
    const nodesBeforeNavigation = await page.evaluate(() => window.__studioOscillators.length);
    for (const mode of ['simple', 'advanced', 'simple', 'advanced']) await page.locator('button[data-interface-mode="' + mode + '"]').click();
    for (const id of ['voice-2', 'voice-3', 'tone']) await page.locator('[data-tone-source="' + id + '"]').click();
    assert.equal(await page.locator('#status').textContent(), 'Playing');
    assert.equal(await page.evaluate(() => localStorage.getItem('beat-mixer.current.v1')), storedBeforeNavigation, 'interface changes do not change the mix');
    assert.equal(await page.evaluate(() => window.__studioOscillators.length), nodesBeforeNavigation, 'interface changes do not rebuild the audio graph');
    const oscillatorsBefore = await page.evaluate(() => window.__studioOscillators.length);
    await commit('#beat-value', 12);
    await page.waitForFunction((count) => window.__studioOscillators.slice(count).some((node) => Math.abs(node.frequency.value - 12) < .001), oscillatorsBefore);
    const buffersBefore = await page.evaluate(() => window.__studioBuffers.length);
    await page.locator('input[name="program"][value="sequence"]').check();
    await page.waitForFunction((count) => window.__studioBuffers.slice(count).some((entry) => entry.args && Math.abs((entry.node.buffer?.duration || 0) - 9.366259) < .001), buffersBefore);
    const preservedOffset = await page.evaluate((count) => window.__studioBuffers.slice(count).find((entry) => entry.args && Math.abs((entry.node.buffer?.duration || 0) - 9.366259) < .001).args[1], buffersBefore);
    assert(preservedOffset > .01, 'recording position survives program/FX clock reset');
    await page.locator('[data-open-effects="tone"]').click(); await page.locator('[data-effect-tab="am"]').click();
    const before = await page.evaluate(() => localStorage.getItem('beat-mixer.current.v1'));
    await page.locator('[data-am-compare="b"]').click(); assert.equal(await page.locator('[data-am-compare="b"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => localStorage.getItem('beat-mixer.current.v1')), before, 'monitor A/B must not alter stored/exported settings');
    await page.locator('[data-effect-tab="filter"]').click();
    assert.equal(await page.locator('[data-am-compare="a"]').getAttribute('aria-pressed'), 'true', 'leaving AM ends the monitor-only dry audition');
    await page.locator('[data-effect-tab="am"]').click(); await page.locator('[data-am-compare="b"]').click();
    await page.keyboard.press('Escape');
    assert(await page.locator('#source-effects').isHidden());
    assert.equal(await page.locator('[data-am-compare="a"]').getAttribute('aria-pressed'), 'true', 'closing effects ends the monitor-only dry audition');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.openEffects), 'tone', 'close restores source-button focus');
    await page.locator('#play-button').click(); await page.waitForFunction(() => document.getElementById('status').textContent === 'Paused');
    await page.locator('#open-export').click(); await page.locator('[data-export-tab="mix"]').click();
    const waiting = page.waitForEvent('download'); await page.locator('#download-export').click(); const download = await waiting;
    const destination = new URL('studio-mix.json', output); await download.saveAs(fileURLToPath(destination)); const file = JSON.parse(await readFile(destination, 'utf8'));
    assert.equal(file.version, 6); assert.equal(file.mix.studio.voices[0].enabled, true); assert.equal(file.mix.automation.stages[0].lanes.length, 2);
    await page.locator('#cancel-export').click(); await page.reload();
    assert.equal(await page.locator('button[data-interface-mode="advanced"]').getAttribute('aria-pressed'), 'true');
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('beat-mixer.current.v1')).mix);
    assert.equal(restored.studio.effects.tone.pitch.mode, 'fm'); assert.equal(restored.studio.timbre.shape, 'harmonic');
    await page.locator('button[data-interface-mode="simple"]').click(); await page.reload();
    assert.equal(await page.locator('button[data-interface-mode="simple"]').getAttribute('aria-pressed'), 'true');
    assert(await page.locator('#advanced-status').isVisible());
    assert(await page.locator('.stage-changes').first().isHidden(), 'Simple keeps only the original stage controls');
    const dsp = await page.evaluate(async () => {
      const { defaultMix } = await import('./src/mix-state.mjs');
      const { defaultEffects } = await import('./src/studio-state.mjs');
      const { studioEffectsGraph } = await import('./src/effects-graph.mjs');
      const { renderWav } = await import('./src/wav-export.mjs');
      const { toneGraph, pulseValue } = await import('./src/audio-graph.mjs');
      const { renderMp3 } = await import('./src/mp3-export.mjs');
      const context = new AudioContext(), noop = () => {}, load = async () => { throw new Error('Tone-only fixture must not load recordings'); };
      const base = () => { const mix = defaultMix(); mix.sounds.stream.enabled = false; mix.fades = { in: 0, out: 0 }; mix.master = 40; return mix; };
      const render = async (mix, seconds = 3, chunk = 20) => context.decodeAudioData(await (await renderWav(mix, seconds, 44100, load, noop, null, chunk)).arrayBuffer());
      const magnitude = (buffer, channel, hz, from = 1, seconds = 1) => {
        const data = buffer.getChannelData(channel), count = Math.round(buffer.sampleRate * seconds), start = Math.round(from * buffer.sampleRate); let a = 0, b = 0;
        for (let i = 0; i < count; i++) { const phase = 2 * Math.PI * hz * i / buffer.sampleRate; a += data[start + i] * Math.cos(phase); b += data[start + i] * Math.sin(phase); }
        return 2 * Math.hypot(a, b) / count;
      };
      try {
        const hybrid = base(); hybrid.studio.effects.tone = defaultEffects(); Object.assign(hybrid.studio.effects.tone.am, { enabled: true, sync: false, rate: 10, depth: 100 });
        const h = await render(hybrid), hybridBins = { left: magnitude(h, 0, 196), wrongLeft: magnitude(h, 0, 204), right: magnitude(h, 1, 204), wrongRight: magnitude(h, 1, 196), lower: magnitude(h, 0, 186), upper: magnitude(h, 0, 206) };
        const envelopes = [];
        for (const shape of ['sine', 'triangle', 'square', 'pulse']) {
          const mix = base(); mix.studio.effects.white = defaultEffects(); Object.assign(mix.studio.effects.white.am, { enabled: true, sync: false, rate: 5, depth: 100, shape, channels: 'offset', rightPhase: 180 });
          const offline = new OfflineAudioContext(2, 44100, 44100), source = offline.createConstantSource(); source.offset.value = .2;
          studioEffectsGraph(offline, mix, 'white', source, offline.destination, 0, 1, 0); source.start(0); const buffer = await offline.startRendering();
          const left = buffer.getChannelData(0), right = buffer.getChannelData(1); let min = 1, max = -1, difference = 0;
          for (let i = 0; i < left.length; i++) { min = Math.min(min, left[i], right[i]); max = Math.max(max, left[i], right[i]); difference += Math.abs(left[i] - right[i]); }
          envelopes.push({ shape, min, max, channelDifference: difference / left.length });
        }
        const pan = base(); pan.carrier = 270; pan.beat = 56; pan.studio.effects.tone = defaultEffects(); Object.assign(pan.studio.effects.tone.pan, { enabled: true, rate: 1, depth: 80 });
        const p = await render(pan), panBins = { own: magnitude(p, 0, 242), crossed: magnitude(p, 0, 298) };
        const multi = base(); multi.studio.voices[0].enabled = true; multi.studio.voices[0].program = 'fixed'; multi.studio.voices[0].mode = 'monaural'; multi.studio.voices[0].carrier = 400; multi.studio.voices[0].beat = 10;
        Object.assign(multi.studio.voices[1], { enabled: true, mode: 'isochronic', program: 'fixed', beat: 6, carrier: 600 });
        const m = await render(multi), multiBins = [magnitude(m, 0, 196), magnitude(m, 1, 204), magnitude(m, 0, 395), magnitude(m, 1, 405), magnitude(m, 0, 600)];
        const complex = base(); complex.studio.timbre = { shape: 'harmonic', partials: [50, 25, 0] }; const c = await render(complex);
        const harmonicRatio = magnitude(c, 0, 392) / magnitude(c, 0, 196);
        const filtered = base(); filtered.carrier = 1000; filtered.studio.effects.tone = defaultEffects(); filtered.studio.effects.tone.filter = { type: 'notch', frequency: 1000, q: 5 };
        const f = await render(filtered), unfiltered = base(); unfiltered.carrier = 1000; const u = await render(unfiltered);
        const notchRatio = magnitude(f, 0, 996) / magnitude(u, 0, 996);
        const pitch = [];
        for (const mode of ['fm', 'pm']) {
          const mix = base(); mix.studio.effects.tone = defaultEffects(); mix.studio.effects.tone.pitch = { mode, rate: .7, depth: mode === 'fm' ? 4 : 90 };
          const single = await render(mix, 12, 20), chunked = await render(mix, 12, 3); let error = 0, peak = 0;
          for (let channel = 0; channel < 2; channel++) { const a = single.getChannelData(channel), b = chunked.getChannelData(channel); for (let i = 0; i < a.length; i++) { error += (a[i] - b[i]) ** 2; peak = Math.max(peak, Math.abs(a[i] - b[i])); } }
          pitch.push({ mode, rmsError: Math.sqrt(error / (single.length * 2)), peak });
        }
        const automation = base(); automation.studio.voices[0].enabled = true; Object.assign(automation.studio.voices[0], { program: 'fixed', carrier: 400, beat: 8 });
        automation.automation.kind = 'sequence'; automation.automation.stages = [{ type: 'hold', start: 8, end: 8, seconds: 8, curve: 'linear', lanes: [{ target: 'tone:level', start: 0, end: 60, curve: 'linear' }, { target: 'voice-2:level', start: 60, end: 0, curve: 'linear' }] }];
        const a = await render(automation, 8, 3), crossfade = { mainEarly: magnitude(a, 0, 196, .5), mainLate: magnitude(a, 0, 196, 6.5), otherEarly: magnitude(a, 0, 396, .5), otherLate: magnitude(a, 0, 396, 6.5) };
        const lanes = base(); lanes.automation.kind = 'sequence'; lanes.automation.stages = [{ type: 'hold', start: 8, end: 8, seconds: 8, curve: 'linear', lanes: [{ target: 'tone:carrier', start: 200, end: 240, curve: 'smooth' }, { target: 'tone:amDepth', start: 20, end: 90, curve: 'linear' }, { target: 'tone:filterFrequency', start: 500, end: 2000, curve: 'smooth' }, { target: 'tone:pan', start: -40, end: 40, curve: 'linear' }] }];
        lanes.studio.effects.tone = defaultEffects(); lanes.studio.effects.tone.am.enabled = true; lanes.studio.effects.tone.filter.type = 'lowpass';
        const laneReference = await render(lanes, 8, 20), laneChunks = await render(lanes, 8, 3); let laneEnergy = 0;
        for (let channel = 0; channel < 2; channel++) { const left = laneReference.getChannelData(channel), right = laneChunks.getChannelData(channel); for (let i = 0; i < left.length; i++) laneEnergy += (left[i] - right[i]) ** 2; }
        const laneError = Math.sqrt(laneEnergy / (laneReference.length * 2));
        const dualSweeps = [];
        const cycles = (start, end, seconds, time, curve) => {
          const t = Math.min(time, seconds), delta = end - start;
          return start * t + delta * (curve === 'smooth' ? t ** 3 / seconds ** 2 - t ** 4 / (2 * seconds ** 3) : t ** 2 / (2 * seconds)) + Math.max(0, time - seconds) * end;
        };
        for (const curve of ['linear', 'smooth']) for (const independent of [false, true]) {
          const mix = base(); mix.carrier = 200; mix.automation.kind = 'sweep'; Object.assign(mix.automation.sweep, { start: 12, end: 4, seconds: 8, curve, repeat: 'once' });
          const voice = mix.studio.voices[0]; Object.assign(voice, { enabled: true, mode: 'isochronic', carrier: 400, program: independent ? 'sweep' : 'follow' });
          Object.assign(voice.sweep, { start: 6, end: 18, seconds: 6, curve, repeat: 'once' });
          const offline = new OfflineAudioContext(2, 44100 * 9, 44100);
          for (const id of ['tone', 'voice-2']) { const graph = toneGraph(offline, mix, offline.destination, 0, 0, 9, id); graph.output.gain.value = 1; }
          const native = await offline.startRendering(); let error = 0, peak = 0;
          for (let i = 0; i < native.length; i++) {
            const t = i / 44100, main = cycles(12, 4, 8, t, curve), pulse = independent ? cycles(6, 18, 6, t, curve) : main;
            const iso = .5 * Math.sin(2 * Math.PI * 400 * t) * pulseValue(pulse, voice.pulse);
            for (const channel of [0, 1]) {
              const expected = .5 * Math.sin(2 * Math.PI * (200 * t + (channel ? .5 : -.5) * main)) + iso;
              const difference = native.getChannelData(channel)[i] - expected; error += difference ** 2; peak = Math.max(peak, Math.abs(difference));
            }
          }
          const whole = await render(mix, 12, 20), chunks = await render(mix, 12, 3); let joins = 0;
          for (const channel of [0, 1]) for (let i = 0; i < whole.length; i++) joins += (whole.getChannelData(channel)[i] - chunks.getChannelData(channel)[i]) ** 2;
          dualSweeps.push({ curve, independent, referenceRms: Math.sqrt(error / (native.length * 2)), referencePeak: peak, chunkRms: Math.sqrt(joins / (whole.length * 2)) });
        }
        const mp3 = await renderMp3(hybrid, 3, 44100, 192, load, noop, null, 1), compressed = await context.decodeAudioData(await mp3.arrayBuffer());
        return { hybridBins, envelopes, panBins, multiBins, harmonicRatio, notchRatio, pitch, crossfade, laneError, dualSweeps, mp3: { channels: compressed.numberOfChannels, duration: compressed.duration } };
      } finally { await context.close(); }
    });
    assert(dsp.hybridBins.left > .005 && dsp.hybridBins.right > .005 && dsp.hybridBins.lower > .001 && dsp.hybridBins.upper > .001, JSON.stringify(dsp));
    assert(dsp.hybridBins.wrongLeft < dsp.hybridBins.left * .02 && dsp.hybridBins.wrongRight < dsp.hybridBins.right * .02);
    assert(dsp.envelopes.every((row) => row.min >= -.00003 && row.max <= .20003 && row.channelDifference > .01), JSON.stringify(dsp.envelopes));
    assert(dsp.panBins.crossed < dsp.panBins.own * .02, JSON.stringify(dsp.panBins));
    assert(dsp.multiBins.every((value) => value > .002)); assert(Math.abs(dsp.harmonicRatio - .5) < .04); assert(dsp.notchRatio < .15);
    assert(dsp.pitch.every((row) => row.rmsError < .004 && row.peak < .08), JSON.stringify(dsp.pitch));
    assert(dsp.crossfade.mainLate > dsp.crossfade.mainEarly * 3 && dsp.crossfade.otherEarly > dsp.crossfade.otherLate * 3, JSON.stringify(dsp.crossfade));
    assert(dsp.laneError < .004, 'automated carrier/depth/filter/pan join error ' + dsp.laneError);
    assert(dsp.dualSweeps.every((row) => row.referenceRms < .003 && row.referencePeak < .03 && row.chunkRms < .004), 'mixed-method sweep reference/chunks: ' + JSON.stringify(dsp.dualSweeps));
    assert.equal(dsp.mp3.channels, 2); assert(dsp.mp3.duration >= 3 && dsp.mp3.duration < 3.2);
    const checkLayout = async (label) => {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ' page overflow');
      const clipped = await page.evaluate(() => [...document.querySelectorAll('.app-shell input, .app-shell select, .app-shell button')].filter((element) => element.getClientRects().length && (element.getBoundingClientRect().left < -1 || element.getBoundingClientRect().right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 2)).map((element) => ({ html: element.outerHTML, width: element.clientWidth, scroll: element.scrollWidth })));
      assert.deepEqual(clipped, [], label + ' clipped controls');
    };
    for (const theme of ['light', 'dark', 'green', 'cyberpunk', 'matrix']) {
      await page.locator('#theme-mode').selectOption(theme);
      for (const width of [1365, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const mode of ['simple', 'advanced']) {
          await page.locator('button[data-interface-mode="' + mode + '"]').click();
          await checkLayout(theme + '/' + mode + '/' + width);
          if (theme === 'dark' && width !== 768) await page.screenshot({ path: fileURLToPath(new URL('mixer-' + mode + '-' + width + '.png', output)), fullPage: true });
        }
        for (const id of ['voice-2', 'voice-3', 'tone']) { await page.locator('[data-tone-source="' + id + '"]').click(); await checkLayout(theme + '/' + id + '/' + width); }
        for (const source of ['tone', 'window-rain', 'pink']) {
          await page.locator('[data-open-effects="' + source + '"]').click();
          for (const category of source === 'tone' ? ['am', 'movement', 'pitch', 'filter'] : ['am', 'movement', 'filter']) {
            await page.locator('[data-effect-tab="' + category + '"]').click(); await checkLayout(theme + '/' + source + '/' + category + '/' + width);
            assert(await page.locator('#source-effects').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth));
            if (theme === 'dark' && category === 'am' && width !== 768) await page.screenshot({ path: fileURLToPath(new URL('effects-' + source + '-' + width + '.png', output)) });
          }
          await page.keyboard.press('Escape');
          assert.equal(await page.evaluate(() => document.activeElement.dataset.openEffects), source);
        }
      }
    }
    await page.locator('[data-tone-source="tone"]').focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-tone-source="voice-2"]').getAttribute('aria-selected'), 'true');
    await page.locator('[data-open-effects="voice-2"]').click(); await page.locator('[data-effect-tab="am"]').focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-effect-tab="movement"]').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Escape');
    await page.locator('[data-tone-source="tone"]').click();
    await page.locator('[data-open-effects="tone"]').click();
    await page.locator('#studio-source').selectOption('voice-2');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.openEffects), 'voice-2', 'focus follows a source switch when the original tone is hidden');
    await page.locator('button[data-interface-mode="simple"]').click();
    assert.deepEqual(errors, []);
    await writeFile(new URL('studio-evidence.json', output), JSON.stringify(dsp, null, 2));
    console.log('Mixer: classic Simple layout, compact Advanced controls, modal effects, tone layers, inline stage changes, AM envelopes/hybrids/stereo, auto-pan, FM/PM joins, harmonics, notch filters, crossfades, JSON, A/B and responsive UI passed');
  } finally { await page.close(); }
}
