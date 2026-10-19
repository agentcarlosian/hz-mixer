import { STUDIO_SOURCES, audibleLayers } from './mix-state.mjs';
import { CARRIER_BOOKMARKS, defaultStudio, effectsFor, generatorSpecs, modulationCoefficients, amLevelFactor } from './studio-state.mjs';
import { sourceProgram, studioValue, hasStudioLane } from './studio-program.mjs';
import { programAt } from './program.mjs';
import { initializeSessionChanges } from './session-ui.js';
import { iconUrl } from './resources.js';

export function initializeMixerUI({ getMix, onChange, onAudition, getTime }) {
  const host = document.querySelector('.workspace'), primary = host.querySelector('.generator-panel'), environment = host.querySelector('.environment-panel');
  const controls = document.querySelector('.app-shell'), stageEditor = document.getElementById('session-builder');
  const find = (selector) => controls.querySelector(selector);
  const toneIds = ['tone', 'voice-2', 'voice-3'], modeKey = 'hz-mixer.interface.v1';
  let interfaceMode = 'simple';
  try { if (JSON.parse(localStorage.getItem(modeKey)) === 'advanced') interfaceMode = 'advanced'; } catch { /* Keep the simple interface when storage is unavailable. */ }
  const toneName = (id) => 'Tone ' + (toneIds.indexOf(id) + 1);
  const sourceName = (id) => STUDIO_SOURCES.find((item) => item.id === id)?.name || id;
  let selectedTone = 'tone', selectedSource = 'tone', effectTab = 'am', dry = false, previewKey = '', effectsOpener = null;
  const compactLabels = { 'Band-limited square': 'Square', 'Frequency modulation': 'FM', 'Phase modulation': 'PM', 'Follow source rate': 'Follow rate', 'Independent rates': 'Independent', 'Once, then hold': 'Hold end' };
  const options = (items) => items.map(([value, label]) => '<option value="' + value + '" title="' + label + '">' + (compactLabels[label] || label) + '</option>').join('');
  const modes = [['binaural', 'Binaural'], ['monaural', 'Monaural'], ['isochronic', 'Isochronic']];
  const shapes = [['sine', 'Sine'], ['triangle', 'Triangle'], ['square', 'Square'], ['sawtooth', 'Sawtooth'], ['harmonic', 'Harmonic blend']];
  const voiceSelect = (id, label, key, choices) => '<label class="compact-field">' + label + '<select data-voice-id="' + id + '" data-voice-key="' + key + '">' + options(choices) + '</select></label>';
  const voiceNumber = (id, label, key, min, max, step = .01) => '<label class="compact-field">' + label + '<input type="number" data-voice-id="' + id + '" data-voice-key="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" /></label>';
  const voiceRange = (id, label, key, min, max) => '<label class="field"><span>' + label + '<output data-voice-output="' + id + ':' + key + '"></output></span><input type="range" data-voice-id="' + id + '" data-voice-key="' + key + '" min="' + min + '" max="' + max + '" /></label>';
  const bookmarks = (id) => '<label class="compact-field">Carrier bookmark<select data-carrier-bookmark="' + id + '"><option value="">Custom pitch</option>' + CARRIER_BOOKMARKS.map((value) => '<option value="' + value + '">' + value + ' Hz</option>').join('') + '</select></label>';
  const shaping = (id) => '<div class="studio-fields">' + bookmarks(id) + voiceSelect(id, 'Waveform', 'timbre.shape', shapes) + '</div><div class="studio-fields" data-harmonics="' + id + '">' + [0, 1, 2].map((index) => voiceNumber(id, 'H' + (index + 2) + ' %', 'timbre.partials.' + index, 0, 100, 1)).join('') + '</div>' + voiceRange(id, 'Balance', 'pan', -100, 100);
  const extraTones = toneIds.slice(1).map((id) => '<section id="tone-editor-' + id + '" class="tone-editor" role="tabpanel" aria-labelledby="tone-tab-' + id + '" data-studio-voice="' + id + '"><div class="section-heading"><h2>' + toneName(id) + '</h2><label class="enable-toggle"><input type="checkbox" data-voice-id="' + id + '" data-voice-key="enabled" aria-label="Enable ' + toneName(id) + '" /><span></span></label></div><div class="studio-fields">' +
    voiceSelect(id, 'Method', 'mode', modes) + voiceSelect(id, 'Frequency program', 'program', [['follow', 'Follow Tone 1'], ['fixed', 'Fixed'], ['sweep', 'Sweep']]) + voiceNumber(id, 'Carrier Hz', 'carrier', 1, 5000, 1) + voiceNumber(id, 'Beat Hz', 'beat', .1, 120) + '</div>' +
    '<div class="studio-fields" data-voice-sweep="' + id + '">' + voiceNumber(id, 'Start Hz', 'sweep.start', .1, 120) + voiceNumber(id, 'End Hz', 'sweep.end', .1, 120) + voiceNumber(id, 'Seconds', 'sweep.seconds', 5, 7200, 1) + voiceSelect(id, 'Transition', 'sweep.curve', [['linear', 'Linear'], ['smooth', 'Smooth']]) + voiceSelect(id, 'Repeat', 'sweep.repeat', [['once', 'Once, then hold'], ['pingpong', 'Ping-pong']]) + '</div>' + shaping(id) +
    '<div class="studio-fields" data-voice-pulse="' + id + '">' + voiceNumber(id, 'Pulse width %', 'pulse.width', 10, 90, 1) + voiceNumber(id, 'Softness %', 'pulse.softness', 0, 100, 1) + voiceNumber(id, 'Depth %', 'pulse.depth', 0, 100, 1) + '</div><div class="studio-voice-level">' + voiceRange(id, 'Tone level', 'level', 0, 100) + '<div class="channel-tools">' +
    [['muted', 'volume-x', 'Mute'], ['solo', 'headphones', 'Solo']].map(([key, icon, label]) => '<button class="icon-button" data-voice-toggle="' + id + ':' + key + '" title="' + label + ' ' + toneName(id) + '" aria-label="' + label + ' ' + toneName(id) + '" aria-pressed="false"><img src="' + iconUrl(icon) + '" alt="" /></button>').join('') + '</div></div></section>').join('');
  const fxSelect = (label, key, choices) => '<label class="compact-field">' + label + '<select data-fx="' + key + '">' + options(choices) + '</select></label>';
  const fxNumber = (label, key, min, max, step = .01) => '<label class="compact-field">' + label + '<input type="number" data-fx="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" /></label>';
  const fxRange = (label, key) => '<label class="field"><span>' + label + '<output data-fx-output="' + key + '"></output></span><input type="range" data-fx="' + key + '" min="0" max="100" /></label>';
  const fxToggle = (label, key) => '<label class="check-field"><input type="checkbox" data-fx="' + key + '" />' + label + '</label>';
  host.id = 'mixer-workspace';
  controls.dataset.interfaceMode = interfaceMode;
  const modeBar = document.createElement('div'); modeBar.className = 'mixer-mode-bar';
  modeBar.innerHTML = '<div class="interface-mode-control" role="group" aria-label="Mixer interface"><button data-interface-mode="simple">Simple</button><button data-interface-mode="advanced">Advanced</button></div><span id="advanced-status" class="mode-status" hidden>Advanced settings in mix</span>';
  host.before(modeBar);
  const stack = document.createElement('div'); stack.className = 'generator-stack'; primary.before(stack);
  stack.innerHTML = '<div class="tone-layer-toolbar" data-advanced-only><div class="tone-layer-tabs" role="tablist" aria-label="Tone layers">' + toneIds.map((id) => '<button id="tone-tab-' + id + '" data-tone-source="' + id + '" role="tab" aria-controls="tone-editor-' + id + '">' + toneName(id) + '<i aria-hidden="true" data-tone-status="' + id + '"></i></button>').join('') + '</div><span class="studio-trim">Tone headroom <output id="studio-trim"></output></span></div>';
  stack.append(primary); stack.insertAdjacentHTML('beforeend', extraTones);
  primary.id = 'tone-editor-tone';
  const common = document.createElement('div'); common.className = 'tone-shaping'; common.dataset.advancedOnly = ''; common.innerHTML = shaping('tone'); primary.querySelector('.frequency-controls').after(common);
  const fxButton = (id) => '<button class="icon-button source-fx-button" data-open-effects="' + id + '" data-advanced-only aria-haspopup="dialog" aria-controls="source-effects" aria-label="Edit ' + sourceName(id) + ' effects" title="Edit ' + sourceName(id) + ' effects"><img src="' + iconUrl('sliders-horizontal') + '" alt="" /></button>';
  primary.querySelector('.channel-tools').insertAdjacentHTML('afterbegin', fxButton('tone'));
  for (const id of toneIds.slice(1)) find('#tone-editor-' + id + ' .section-heading').insertAdjacentHTML('beforeend', fxButton(id));
  for (const { id } of STUDIO_SOURCES.filter((item) => !toneIds.includes(item.id))) environment.querySelector('[data-sound="' + id + '"] .sound-top').insertAdjacentHTML('beforeend', fxButton(id));
  const effectsMarkup = '<dialog id="source-effects" class="source-effects" aria-labelledby="effects-heading"><div class="effects-heading"><h2 id="effects-heading">Effects</h2><div class="channel-tools"><button id="reset-source-fx" class="icon-button secondary" title="Reset effects for this source" aria-label="Reset source effects"><img src="' + iconUrl('rotate-ccw') + '" alt="" /></button><button id="close-source-effects" class="button secondary">Close</button></div></div><label class="compact-field effects-source">Effects for<select id="studio-source">' + STUDIO_SOURCES.map(({ id, name }) => '<option value="' + id + '">' + name + '</option>').join('') + '</select></label><p id="studio-signal-error" class="error"></p>' +
    '<div class="effect-navigation" role="tablist" aria-label="Effect categories">' + [['am', 'AM'], ['movement', 'Movement'], ['pitch', 'Pitch'], ['filter', 'Filter']].map(([id, name]) => '<button role="tab" id="effect-tab-' + id + '" data-effect-tab="' + id + '" aria-controls="effect-' + id + '">' + name + '</button>').join('') + '</div>' +
    '<div id="effect-am" role="tabpanel" aria-labelledby="effect-tab-am"><fieldset class="studio-fx"><legend>' + fxToggle('Amplitude modulation', 'am.enabled') + '</legend><div class="studio-fields">' + fxSelect('Shape', 'am.shape', [['sine', 'Sine'], ['triangle', 'Triangle'], ['square', 'Band-limited square'], ['pulse', 'Rounded pulse']]) + fxSelect('Timing', 'am.sync', [['true', 'Follow source rate'], ['false', 'Independent']]) + fxNumber('Rate Hz', 'am.rate', .1, 120) + fxNumber('Phase degrees', 'am.phase', 0, 360, 1) + '</div>' + fxRange('Depth', 'am.depth') + '<div class="studio-fields" id="am-pulse-shape">' + fxNumber('Width %', 'am.width', 10, 90, 1) + fxNumber('Softness %', 'am.softness', 0, 100, 1) + '</div><div class="studio-fields">' + fxSelect('Channels', 'am.channels', [['linked', 'Linked'], ['offset', 'Phase offset'], ['independent', 'Independent rates']]) + fxNumber('Right rate Hz', 'am.rightRate', .1, 120) + fxNumber('Right phase degrees', 'am.rightPhase', 0, 360, 1) + '</div></fieldset>' +
    '<div class="envelope-toolbar"><h3>AM envelope</h3><output id="envelope-readout"></output></div><canvas id="am-envelope" width="600" height="110" aria-label="Left and right amplitude envelopes"></canvas><div class="studio-compare" role="group" aria-label="Monitor AM comparison"><span>Monitor A/B</span><button data-am-compare="a" title="Audition AM">A: AM</button><button data-am-compare="b" title="Audition dry, monitor only">B: Dry</button><label class="check-field"><input id="am-match-level" type="checkbox" checked />Match level</label></div></div>' +
    '<div id="effect-movement" role="tabpanel" aria-labelledby="effect-tab-movement"><fieldset class="studio-fx"><legend>' + fxToggle('Auto pan / balance', 'pan.enabled') + '</legend><div class="studio-fields">' + fxNumber('Rate Hz', 'pan.rate', .01, 120) + fxNumber('Phase degrees', 'pan.phase', 0, 360, 1) + '</div>' + fxRange('Depth', 'pan.depth') + '</fieldset></div>' +
    '<div id="effect-pitch" role="tabpanel" aria-labelledby="effect-tab-pitch"><h3>Pitch modulation</h3><div class="studio-fields">' + fxSelect('Mode', 'pitch.mode', [['off', 'Off'], ['fm', 'Frequency modulation'], ['pm', 'Phase modulation']]) + fxNumber('Rate Hz', 'pitch.rate', .01, 120) + '<label class="compact-field"><span id="pitch-depth-label">Deviation Hz</span><input type="number" data-fx="pitch.depth" min="0" max="500" step="0.01" /></label></div></div>' +
    '<div id="effect-filter" role="tabpanel" aria-labelledby="effect-tab-filter"><h3>Filter</h3><div class="studio-fields">' + fxSelect('Type', 'filter.type', [['off', 'Off'], ['lowpass', 'Low-pass'], ['highpass', 'High-pass'], ['bandpass', 'Band-pass'], ['notch', 'Notch']]) + fxNumber('Frequency Hz', 'filter.frequency', 20, 18000, 1) + fxNumber('Q', 'filter.q', .1, 30, .001) + '</div></div></dialog>';
  controls.insertAdjacentHTML('beforeend', effectsMarkup);
  const effectsDialog = find('#source-effects');
  const sessionChanges = initializeSessionChanges({ getMix, onChange });
  const pathValue = (object, path) => path.split('.').reduce((value, key) => value[key], object);
  const assignValue = (object, path, value) => { const keys = path.split('.'), last = keys.pop(); keys.reduce((entry, key) => entry[key], object)[last] = value; };
  const voiceFields = new Set(['enabled', 'mode', 'program', 'carrier', 'beat', 'pan', 'level', 'timbre.shape', 'timbre.partials.0', 'timbre.partials.1', 'timbre.partials.2', 'sweep.start', 'sweep.end', 'sweep.seconds', 'sweep.curve', 'sweep.repeat', 'pulse.width', 'pulse.softness', 'pulse.depth']);
  const fxFields = new Set([...controls.querySelectorAll('[data-fx]')].map((field) => field.dataset.fx));
  const voiceObject = (mix, id) => id === 'tone' ? { carrier: mix.carrier, pan: mix.studio.pan, timbre: mix.studio.timbre } : mix.studio.voices.find((voice) => voice.id === id);
  const assignVoice = (mix, id, key, value) => { if (id === 'tone') { if (key === 'carrier') mix.carrier = value; else if (key === 'pan') mix.studio.pan = value; else if (key.startsWith('timbre.')) assignValue(mix.studio, key, value); } else { const voice = voiceObject(mix, id); if (voice) assignValue(voice, key, value); } };
  const resetComparison = (notify = false) => { const changed = dry; dry = false; if (notify && changed) onAudition(); };
  const commit = (resetClock = false) => { resetComparison(); previewKey = ''; onChange(resetClock); };
  const chooseSource = (id) => {
    if (!STUDIO_SOURCES.some((source) => source.id === id)) return;
    resetComparison(true); selectedSource = id;
    if (toneIds.includes(id)) selectedTone = id;
    previewKey = ''; renderMixer(true);
  };
  function showMode(mode) {
    if (!['simple', 'advanced'].includes(mode)) return;
    resetComparison(true); interfaceMode = mode;
    if (effectsDialog.open) effectsDialog.close();
    try { localStorage.setItem(modeKey, JSON.stringify(mode)); } catch { /* Interface changes still work without storage. */ }
    renderMixer();
  }
  function openEffects(id, opener) {
    if (!STUDIO_SOURCES.some((source) => source.id === id)) return;
    effectsOpener = opener; chooseSource(id);
    if (!effectsDialog.open) effectsDialog.showModal();
    previewKey = ''; drawPreview();
  }
  const inputValue = (field) => field.type === 'checkbox' ? field.checked : ['range', 'number'].includes(field.type) ? Number(field.value) : field.value;
  const updateField = (event) => {
    const field = event.target;
    if (field.disabled) return;
    if (event.type === 'input' && field.type !== 'range') return;
    if (!field.dataset.voiceId && !fxFields.has(field.dataset.fx)) return;
    if (field.type === 'number' && !field.checkValidity()) { renderMixer(true); return; }
    const mix = getMix();
    if (field.dataset.voiceId && voiceFields.has(field.dataset.voiceKey)) { assignVoice(mix, field.dataset.voiceId, field.dataset.voiceKey, inputValue(field)); commit(); }
    else if (fxFields.has(field.dataset.fx)) { const profile = structuredClone(effectsFor(mix, selectedSource)); assignValue(profile, field.dataset.fx, field.dataset.fx === 'am.sync' ? field.value === 'true' : inputValue(field)); mix.studio.effects[selectedSource] = profile; commit(); }
  };
  controls.addEventListener('change', updateField); controls.addEventListener('input', updateField);
  controls.addEventListener('click', (event) => {
    const mode = event.target.closest('button[data-interface-mode]'); if (mode) showMode(mode.dataset.interfaceMode);
    const tone = event.target.closest('[data-tone-source]'); if (tone) { resetComparison(true); selectedTone = tone.dataset.toneSource; renderMixer(); }
    const source = event.target.closest('[data-open-effects]'); if (source) openEffects(source.dataset.openEffects, source);
    const effect = event.target.closest('[data-effect-tab]'); if (effect) { if (effect.dataset.effectTab !== 'am') resetComparison(true); effectTab = effect.dataset.effectTab; previewKey = ''; renderMixer(); }
    const toggle = event.target.closest('[data-voice-toggle]');
    if (toggle) { const [id, key] = toggle.dataset.voiceToggle.split(':'), voice = getMix().studio.voices.find((item) => item.id === id); if (voice && ['muted', 'solo'].includes(key)) { voice[key] = !voice[key]; if (key === 'solo' && voice.solo) voice.enabled = true; commit(); } }
    const comparison = event.target.closest('[data-am-compare]'); if (comparison) { dry = comparison.dataset.amCompare === 'b'; renderMixer(); onAudition(); }
  });
  for (const selector of ['.tone-layer-tabs', '.effect-navigation']) find(selector).addEventListener('keydown', (event) => {
    const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')].filter((tab) => !tab.hidden), index = tabs.indexOf(document.activeElement);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].click(); tabs[next].focus();
  });
  controls.querySelectorAll('[data-carrier-bookmark]').forEach((select) => select.addEventListener('change', () => { if (select.value) { assignVoice(getMix(), select.dataset.carrierBookmark, 'carrier', Number(select.value)); commit(); } }));
  find('#studio-source').addEventListener('change', (event) => chooseSource(event.target.value));
  find('#am-match-level').addEventListener('change', onAudition);
  find('#reset-source-fx').addEventListener('click', () => { delete getMix().studio.effects[selectedSource]; commit(); });
  find('#close-source-effects').addEventListener('click', () => effectsDialog.close());
  effectsDialog.addEventListener('close', () => {
    resetComparison(true); renderMixer();
    const target = effectsOpener?.getClientRects().length ? effectsOpener : find('[data-open-effects="' + selectedSource + '"]');
    if (target?.getClientRects().length) target.focus({ preventScroll: true });
  });

  function renderMixer(force = false) {
    const mix = getMix(), profile = effectsFor(mix, selectedSource), advanced = interfaceMode === 'advanced';
    controls.dataset.interfaceMode = interfaceMode;
    for (const button of controls.querySelectorAll('button[data-interface-mode]')) button.setAttribute('aria-pressed', String(button.dataset.interfaceMode === interfaceMode));
    const configured = JSON.stringify(mix.studio) !== JSON.stringify(defaultStudio()) || mix.automation.stages.some((stage) => stage.lanes?.length);
    find('#advanced-status').hidden = advanced || !configured;
    for (const button of controls.querySelectorAll('[data-tone-source]')) {
      const active = selectedTone === button.dataset.toneSource;
      button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
      find('#tone-editor-' + button.dataset.toneSource).hidden = button.dataset.toneSource === 'tone' ? advanced && !active : !advanced || !active;
    }
    if (advanced) { primary.setAttribute('role', 'tabpanel'); primary.setAttribute('aria-labelledby', 'tone-tab-tone'); }
    else { primary.removeAttribute('role'); primary.setAttribute('aria-labelledby', 'generator-heading'); }
    const stageHost = !advanced || selectedTone === 'tone' ? primary : find('#tone-editor-' + selectedTone);
    if (stageEditor.parentElement !== stageHost) {
      if (stageHost === primary) find('#program-monitor').after(stageEditor);
      else stageHost.append(stageEditor);
    }
    for (const button of controls.querySelectorAll('[data-effect-tab]')) { const supported = button.dataset.effectTab !== 'pitch' || toneIds.includes(selectedSource); button.hidden = !supported; if (!supported && effectTab === 'pitch') effectTab = 'am'; }
    for (const button of controls.querySelectorAll('[data-effect-tab]')) { const active = effectTab === button.dataset.effectTab; button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; find('#effect-' + button.dataset.effectTab).hidden = !active; }
    for (const button of controls.querySelectorAll('[data-open-effects]')) {
      const fx = effectsFor(mix, button.dataset.openEffects), active = fx.am.enabled || fx.pan.enabled || fx.pitch.mode !== 'off' || fx.filter.type !== 'off';
      button.classList.toggle('has-effects', active); button.title = 'Edit ' + sourceName(button.dataset.openEffects) + ' effects' + (active ? ' (enabled)' : '');
    }
    find('#studio-source').value = selectedSource;
    const set = (field, value) => { if (force || field !== document.activeElement || field.type === 'checkbox') { if (field.type === 'checkbox') field.checked = value; else field.value = value; } };
    for (const field of controls.querySelectorAll('[data-voice-key]')) { const voice = voiceObject(mix, field.dataset.voiceId); set(field, pathValue(voice, field.dataset.voiceKey)); if (field.dataset.voiceKey === 'beat') { field.disabled = voice.program !== 'fixed'; field.closest('label').hidden = voice.program !== 'fixed'; } }
    const generators = generatorSpecs(mix), audible = audibleLayers(mix);
    for (const id of toneIds) {
      const voice = voiceObject(mix, id), spec = generators.find((item) => item.id === id);
      find('[data-tone-status="' + id + '"]').classList.toggle('on', spec.enabled);
      find('[data-harmonics="' + id + '"]').hidden = voice.timbre.shape !== 'harmonic';
      find('[data-carrier-bookmark="' + id + '"]').value = CARRIER_BOOKMARKS.includes(voice.carrier) ? voice.carrier : '';
      for (const key of id === 'tone' ? ['pan'] : ['level', 'pan']) find('[data-voice-output="' + id + ':' + key + '"]').value = key === 'level' ? voice.level + '%' : voice.pan === 0 ? 'Center' : (voice.pan < 0 ? 'L ' : 'R ') + Math.abs(voice.pan) + '%';
      if (id !== 'tone') { find('[data-voice-sweep="' + id + '"]').hidden = voice.program !== 'sweep'; find('[data-voice-pulse="' + id + '"]').hidden = voice.mode !== 'isochronic'; for (const key of ['muted', 'solo']) find('[data-voice-toggle="' + id + ':' + key + '"]').setAttribute('aria-pressed', String(voice[key])); }
    }
    const count = generators.filter((voice) => voice.enabled && audible.has(voice.id)).length;
    find('#studio-trim').value = (count > 1 ? -20 * Math.log10(count) : 0).toFixed(1) + ' dB';
    for (const field of controls.querySelectorAll('[data-fx]')) set(field, pathValue(profile, field.dataset.fx));
    for (const output of controls.querySelectorAll('[data-fx-output]')) output.value = pathValue(profile, output.dataset.fxOutput) + '%';
    const rate = programAt(sourceProgram(mix, selectedSource), getTime()).rate, rateField = find('[data-fx="am.rate"]'); rateField.disabled = profile.am.sync; if (profile.am.sync) rateField.value = rate.toFixed(2);
    find('[data-fx="am.rightRate"]').disabled = profile.am.channels !== 'independent'; find('[data-fx="am.rightPhase"]').disabled = profile.am.channels === 'linked';
    find('#am-pulse-shape').hidden = ['sine', 'triangle'].includes(profile.am.shape); find('[data-fx="am.softness"]').disabled = profile.am.shape !== 'pulse';
    find('#pitch-depth-label').textContent = profile.pitch.mode === 'pm' ? 'Phase depth degrees' : 'Deviation Hz'; find('[data-fx="pitch.depth"]').max = profile.pitch.mode === 'pm' ? 180 : 500;
    find('[data-fx="pitch.rate"]').disabled = find('[data-fx="pitch.depth"]').disabled = profile.pitch.mode === 'off';
    find('[data-fx="filter.frequency"]').disabled = find('[data-fx="filter.q"]').disabled = profile.filter.type === 'off';
    const match = find('#am-match-level'); match.disabled = hasStudioLane(mix, selectedSource + ':amDepth'); match.title = match.disabled ? 'Level matching unavailable while depth is automated' : 'Match dry level to the AM envelope RMS';
    if (!profile.am.enabled) dry = false;
    for (const button of controls.querySelectorAll('[data-am-compare]')) { button.disabled = !profile.am.enabled; button.setAttribute('aria-pressed', String((button.dataset.amCompare === 'b') === dry)); }
    sessionChanges.render(); drawPreview();
  }
  function drawPreview() {
    find('#studio-signal-error').textContent = document.getElementById('signal-error').textContent;
    if (!effectsDialog.open || effectTab !== 'am') return;
    const mix = getMix(), am = effectsFor(mix, selectedSource).am, rate = am.sync ? programAt(sourceProgram(mix, selectedSource), getTime()).rate : am.rate;
    const depth = studioValue(mix, selectedSource + ':amDepth', am.depth, getTime()), canvas = find('#am-envelope'), width = canvas.clientWidth;
    if (!width) return;
    const key = [JSON.stringify(am), rate.toFixed(2), depth.toFixed(2), width, document.documentElement.dataset.theme].join(':'); if (previewKey === key) return; previewKey = key;
    const scale = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(width * scale); canvas.height = 110 * scale;
    const drawing = canvas.getContext('2d'), styles = getComputedStyle(document.documentElement); drawing.scale(scale, scale); drawing.strokeStyle = styles.getPropertyValue('--canvas-grid').trim(); drawing.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { drawing.beginPath(); drawing.moveTo(0, 10 + i * 22); drawing.lineTo(width, 10 + i * 22); drawing.stroke(); }
    const coefficients = modulationCoefficients(am);
    for (const channel of am.channels === 'linked' ? [0] : [0, 1]) {
      drawing.strokeStyle = styles.getPropertyValue(channel ? '--canvas-peak' : '--canvas-wave').trim(); drawing.lineWidth = 2; drawing.beginPath();
      for (let i = 0; i <= 256; i++) { const channelRate = channel && am.channels === 'independent' ? am.rightRate : rate; const phase = 2 * i / 256 * channelRate / rate + am.phase / 360 + (channel ? am.rightPhase / 360 : 0); let unit = coefficients.mean;
        for (let n = 1; n < coefficients.real.length; n++) unit += coefficients.real[n] * Math.cos(n * phase * Math.PI * 2) + coefficients.imaginary[n] * Math.sin(n * phase * Math.PI * 2);
        const gain = am.enabled ? 1 - depth / 100 * (1 - unit) : 1, x = i / 256 * width, y = 98 - Math.max(0, Math.min(1, gain)) * 88; if (i) drawing.lineTo(x, y); else drawing.moveTo(x, y);
      }
      drawing.stroke();
    }
    find('#envelope-readout').value = rate.toFixed(2) + ' Hz / ' + depth.toFixed(0) + '%';
  }
  function playbackMix(value) {
    const profile = effectsFor(value, selectedSource); if (!dry || !profile.am.enabled) return value;
    const copy = structuredClone(value), effects = structuredClone(profile); effects.am.enabled = false; copy.studio.effects[selectedSource] = effects;
    const factor = find('#am-match-level').checked && !hasStudioLane(value, selectedSource + ':amDepth') ? amLevelFactor(profile.am) : 1;
    if (selectedSource === 'tone') copy.toneLevel *= factor; else if (copy.studio.voices.some((voice) => voice.id === selectedSource)) copy.studio.voices.find((voice) => voice.id === selectedSource).level *= factor; else (copy.sounds[selectedSource] || copy.noise[selectedSource]).level *= factor;
    for (const stage of copy.automation.stages) for (const lane of stage.lanes || []) if (lane.target === selectedSource + ':level') { lane.start *= factor; lane.end *= factor; }
    return copy;
  }
  return { render: renderMixer, drawPreview, playbackMix, resetComparison, showMode, openEffects };
}
