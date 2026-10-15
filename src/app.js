import { SOUNDS, NOISES, BANDS, PRESETS, defaultMix, normalizeMix, normalizeLibrary, audibleLayers } from './mix-state.mjs';
import { AudioEngine } from './audio-engine.js';
import { iconUrl } from './resources.js';
import { programAt, sessionSeconds, signalError } from './program.mjs';
import { makeBackup, makeMixFile, parseBackup, mergeImports } from './library.mjs';
import { renderWav, wavError, exportSeconds } from './wav-export.mjs';
import { renderMp3, mp3Error } from './mp3-export.mjs';

const $ = (selector) => document.querySelector(selector);
$('#privacy-open').addEventListener('click', () => $('#privacy-dialog').showModal());
// Preserve legacy keys when upgrading on the same browser origin.
const CURRENT_KEY = 'beat-mixer.current.v1';
const LIBRARY_KEY = 'beat-mixer.library.v1';
const THEME_KEY = 'hz-mixer.theme.v2';
const FAVORITES_KEY = 'beat-mixer.favorites.v1';
const allLayers = [...SOUNDS, ...NOISES];
const layerConfig = (id) => mix.sounds[id] || mix.noise[id];
function readStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw && raw.length < 100000 ? JSON.parse(raw) : null;
  } catch { return null; }
}
const restored = readStorage(CURRENT_KEY);
let mix = normalizeMix(restored?.mix);
let library = normalizeLibrary(readStorage(LIBRARY_KEY));
let selectedMix = [...PRESETS.map((entry) => 'preset:' + entry.id), ...library.map((entry) => 'saved:' + entry.id)].includes(restored?.selection) ? restored.selection : 'custom';
let suggestedName = typeof restored?.name === 'string' ? restored.name.slice(0, 40) : '';
let view = restored?.view === 'spectrum' ? 'spectrum' : 'waveform';
let themePreference = document.documentElement.dataset.themePreference || 'system';
const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
let canvasTheme = {};
let favorites = new Set(Array.isArray(readStorage(FAVORITES_KEY)) ? readStorage(FAVORITES_KEY).filter((id) => PRESETS.some((p) => 'preset:' + p.id === id)) : []);
let sessionState = 'Ready';
let busy = false;
let transportOperation = 0;
const trackStates = {};
const engine = new AudioEngine((id, state) => {
  trackStates[id] = state;
  renderTrackState(id);
});

const channelMarkup = (layers) => layers.map(({ id, name, detail, duration, channels, icon, color }) =>
  '<article class="sound-row" data-sound="' + id + '">' +
  '<div class="sound-top"><span class="sound-icon ' + color + '"><img src="' + iconUrl(icon) + '" alt="" /></span><div class="sound-title"><h3>' + name + '</h3><small>' + detail + (duration ? ' &middot; ' + duration : '') + '</small></div>' +
  '<label class="enable-toggle"><input type="checkbox" data-enable="' + id + '" aria-label="Enable ' + name + '" /><span></span></label></div>' +
  '<div class="channel-strip"><label class="field"><span>Level <output data-level-value="' + id + '"></output></span><input type="range" data-volume="' + id + '" aria-label="' + name + ' volume" min="0" max="100" /></label>' +
  '<div class="channel-tools"><button class="icon-button mute" data-mute="' + id + '" aria-label="Mute ' + name + '" title="Mute ' + name + '" aria-pressed="false"><img src="' + iconUrl('volume-x') + '" alt="" /></button><button class="icon-button solo" data-solo="' + id + '" aria-label="Solo ' + name + '" title="Solo ' + name + '" aria-pressed="false"><img src="' + iconUrl('headphones') + '" alt="" /></button></div></div>' +
  '<div class="pan-field"><div class="pan-heading"><span>' + (channels || 'Mono') + ' balance</span><button data-center="' + id + '" aria-label="Center ' + name + ' balance" title="Reset balance to center"><output data-pan-value="' + id + '">Center</output></button></div><input type="range" data-pan="' + id + '" aria-label="' + name + ' balance" min="-100" max="100" step="1" /></div><p class="track-state" data-track-state="' + id + '"></p></article>'
).join('');
$('#sound-list').innerHTML = channelMarkup(SOUNDS);
$('#noise-list').innerHTML = channelMarkup(NOISES);

const frequencyFields = [
  { input: $('#beat-value'), slider: $('#beat-rate'), key: 'beat', decimals: 2 },
  { input: $('#carrier-value'), slider: $('#carrier'), key: 'carrier', decimals: 0 },
];

function notify(message) { $('#storage-status').textContent = message; }
function applyTheme() {
  themePreference = window.hzMixerTheme.apply(themePreference, themeMedia.matches);
  const styles = getComputedStyle(document.documentElement);
  canvasTheme = Object.fromEntries(['grid', 'wave', 'spectrum', 'peak', 'program', 'marker'].map((name) => [name, styles.getPropertyValue('--canvas-' + name).trim()]));
  $('#theme-mode').value = themePreference;
  drawProgram();
}
$('#theme-mode').addEventListener('change', () => {
  themePreference = $('#theme-mode').value;
  applyTheme();
  try { localStorage.setItem(THEME_KEY, JSON.stringify(themePreference)); }
  catch { notify('Theme changed; browser storage unavailable'); }
});
themeMedia.addEventListener('change', () => { if (themePreference === 'system') applyTheme(); });
function persistCurrent() {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify({ mix, view, selection: selectedMix, name: suggestedName }));
    notify('Current mix saved on this device');
  } catch { notify('Browser storage unavailable'); }
}
function writeLibrary(nextLibrary) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(nextLibrary)); return true; }
  catch { return false; }
}
function pressed(selector, value) { $(selector).setAttribute('aria-pressed', String(value)); }
function formatTime(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  return String(Math.floor(whole / 60)).padStart(2, '0') + ':' + String(whole % 60).padStart(2, '0');
}
function renderLibrary() {
  const select = $('#mix-select');
  select.replaceChildren(new Option('Custom mix', 'custom'));
  const band = $('#band-filter').value, method = $('#method-filter').value, search = $('#preset-search').value.trim().toLowerCase(), onlyFavorites = $('#favorites-only').checked;
  const matches = (entry, id) => (band === 'all' || entry.band === band) && (method === 'all' || entry.mix.mode === method) && (!onlyFavorites || favorites.has(id)) && entry.name.toLowerCase().includes(search);
  for (const [bandId, name] of [...BANDS.map((b) => [b.id, b.name]), ['nature', 'Nature only']]) {
    const group = document.createElement('optgroup');
    group.label = name;
    PRESETS.filter((preset) => preset.band === bandId && matches(preset, 'preset:' + preset.id)).forEach((preset) => group.append(new Option((favorites.has('preset:' + preset.id) ? '* ' : '') + preset.name, 'preset:' + preset.id)));
    if (group.children.length) select.append(group);
  }
  if (library.length) {
    const saved = document.createElement('optgroup');
    saved.label = 'My mixes';
    library.filter((entry) => entry.name.toLowerCase().includes(search) && !onlyFavorites).forEach((entry) => saved.append(new Option(entry.name, 'saved:' + entry.id)));
    if (saved.children.length) select.append(saved);
  }
  if (selectedMix !== 'custom' && ![...select.options].some((o) => o.value === selectedMix)) {
    const entry = PRESETS.find((e) => 'preset:' + e.id === selectedMix) || library.find((e) => 'saved:' + e.id === selectedMix);
    if (entry) select.append(new Option(entry.name + ' (current)', selectedMix));
  }
  select.value = selectedMix;
}
function renderTrackState(id) {
  const config = layerConfig(id);
  const audible = audibleLayers(mix);
  const state = config.enabled ? trackStates[id] || (config.muted ? 'Muted' : config.solo ? 'Solo' : !audible.has(id) ? 'Excluded by solo' : '') : '';
  $('[data-track-state="' + id + '"]').textContent = state;
}
function render(preserveInput = false) {
  $('#mix-select').value = selectedMix;
  $('#delete-mix').disabled = !selectedMix.startsWith('saved:');
  for (const field of frequencyFields) {
    field.slider.value = mix[field.key];
    if (!preserveInput || document.activeElement !== field.input) field.input.value = mix[field.key].toFixed(field.decimals);
  }
  $('input[name="mode"][value="' + mix.mode + '"]').checked = true;
  $('#tone-level').value = mix.toneLevel;
  $('#tone-value').value = mix.toneLevel + '%';
  $('#master-level').value = mix.master;
  $('#master-value').value = mix.master + '%';
  if (![...$('#duration').options].some((o) => Number(o.value) === mix.duration)) $('#duration').append(new Option(formatTime(mix.duration), String(mix.duration)));
  $('#duration').value = mix.duration;
  $('#duration').disabled = mix.automation.kind === 'sequence';
  if (mix.automation.kind === 'sequence') {
    let option = $('#duration option[value="stages"]');
    if (!option) { option = new Option('', 'stages'); $('#duration').append(option); }
    option.textContent = 'Stages / ' + formatTime(sessionSeconds(mix));
    $('#duration').value = 'stages';
  }
  pressed('#tone-mute', mix.toneMuted);
  pressed('#tone-solo', mix.toneSolo);
  pressed('#master-mute', mix.masterMuted);
  $('#tone-mute').disabled = $('#tone-solo').disabled = mix.mode === 'off';
  $('#master-mute').title = $('#master-mute').ariaLabel = mix.masterMuted ? 'Unmute master' : 'Mute master';
  $('#master-mute img').src = iconUrl(mix.masterMuted ? 'volume-x' : 'volume-2');
  const left = (mix.carrier - mix.beat / 2).toFixed(3);
  const right = (mix.carrier + mix.beat / 2).toFixed(3);
  $('#signal-detail').textContent = mix.mode === 'off' ? 'Generator off'
    : mix.mode === 'binaural' ? 'Left ' + left + ' Hz \u00b7 Right ' + right + ' Hz'
    : mix.mode === 'monaural' ? left + ' + ' + right + ' Hz mixed to both ears'
    : mix.carrier + ' Hz tone \u00b7 ' + mix.beat.toFixed(2) + ' pulses/second';
  $('#headphone-note').hidden = mix.mode !== 'binaural';
  const audible = audibleLayers(mix);
  let count = 0;
  for (const { id, name } of allLayers) {
    const config = layerConfig(id);
    $('[data-enable="' + id + '"]').checked = config.enabled;
    $('[data-volume="' + id + '"]').value = config.level;
    $('[data-pan="' + id + '"]').value = config.pan;
    $('[data-level-value="' + id + '"]').value = config.level + '%';
    $('[data-pan-value="' + id + '"]').value = config.pan === 0 ? 'Center' : (config.pan < 0 ? 'L ' : 'R ') + Math.abs(config.pan) + '%';
    pressed('[data-mute="' + id + '"]', config.muted);
    pressed('[data-solo="' + id + '"]', config.solo);
    const mute = $('[data-mute="' + id + '"]');
    mute.title = mute.ariaLabel = (config.muted ? 'Unmute ' : 'Mute ') + name;
    const row = $('[data-sound="' + id + '"]');
    row.classList.toggle('active', config.enabled);
    row.classList.toggle('silenced', !audible.has(id));
    renderTrackState(id);
    if (audible.has(id)) count += 1;
  }
  $('#active-count').textContent = count + (count === 1 ? ' layer' : ' layers');
  const solo = mix.toneSolo || allLayers.some(({ id }) => layerConfig(id).solo);
  $('#solo-note').textContent = solo ? 'Solo active' : 'Independent audio layers';
  $('#clear-solo').hidden = !solo;
  document.querySelectorAll('[data-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  $('#scope-canvas').ariaLabel = 'Live output ' + view;
  renderProgram(preserveInput);
  $('#favorite-mix').disabled = !selectedMix.startsWith('preset:');
  pressed('#favorite-mix', favorites.has(selectedMix));
  $('#favorite-mix').title = $('#favorite-mix').ariaLabel = favorites.has(selectedMix) ? 'Remove favorite preset' : 'Favorite preset';
  $('#preset-summary').textContent = mix.mode === 'off' ? 'Nature only' : mix.mode + ' / ' + (mix.automation.kind === 'fixed' ? mix.beat.toFixed(2) + ' Hz' : mix.automation.kind) + ' / ' + mix.carrier + ' Hz carrier';
  renderTransport();
}
function changed(preserveInput = false) {
  selectedMix = 'custom';
  mix = normalizeMix(mix);
  engine.update(mix);
  render(preserveInput);
  persistCurrent();
}
function applyMix(nextMix, selection, name) {
  const next = normalizeMix(nextMix);
  mix = next;
  selectedMix = selection;
  suggestedName = name;
  engine.update(mix);
  engine.resetPosition();
  render();
  persistCurrent();
}

function renderTransport() {
  const playing = engine.playing;
  $('#play-button span').textContent = playing ? 'Pause' : sessionState === 'Paused' ? 'Resume' : 'Play';
  $('#play-button img').src = iconUrl(playing ? 'pause' : 'play');
  $('#play-button').disabled = busy || engine.stopping;
  $('#stop-button').disabled = !engine.stopping && (busy || !['Playing', 'Paused'].includes(sessionState));
  $('#stop-button').title = engine.stopping ? 'Stop immediately' : 'Stop session';
  $('#status').textContent = engine.stopping ? 'Fading out...' : busy ? engine.playing ? 'Pausing...' : 'Starting...' : sessionState;
  $('#status-dot').classList.toggle('playing', playing);
  $('#scope-state').textContent = mix.masterMuted ? 'Master muted' : sessionState;
  $('#remaining').value = sessionSeconds(mix) ? formatTime(sessionSeconds(mix) - engine.elapsed()) : '--:--';
}
function tickTimer() {
  if (engine.tick() && !busy) { stopSession(true); return; }
  $('#remaining').value = sessionSeconds(mix) ? formatTime(sessionSeconds(mix) - engine.elapsed()) : '--:--';
  drawProgram();
}
async function togglePlayback() {
  if (busy) return;
  busy = true;
  renderTransport();
  try {
    if (engine.playing) {
      await engine.pause();
      sessionState = 'Paused';
    } else {
      await engine.play(mix);
      sessionState = 'Playing';
    }
  } catch (error) {
    await engine.pause();
    sessionState = 'Audio unavailable';
    notify(error.message);
  } finally { busy = false; renderTransport(); }
}
async function stopSession(finished = false) {
  if (engine.stopping) { transportOperation++; await engine.stop(true); sessionState = 'Stopped'; busy = false; renderTransport(); return; }
  if (busy) return;
  const operation = ++transportOperation;
  busy = true;
  const task = engine.stop(finished);
  renderTransport();
  await task;
  if (operation !== transportOperation) return;
  sessionState = finished ? 'Session complete' : 'Stopped';
  busy = false;
  renderTransport();
}
$('#play-button').addEventListener('click', togglePlayback);
$('#stop-button').addEventListener('click', () => stopSession());
document.addEventListener('visibilitychange', tickTimer);
$('#duration').addEventListener('change', () => {
  mix.duration = Number($('#duration').value);
  changed();
});
for (const [id, key] of [['#master-level', 'master'], ['#tone-level', 'toneLevel']]) {
  $(id).addEventListener('input', () => { mix[key] = Number($(id).value); changed(); });
}
for (const field of frequencyFields) {
  field.slider.addEventListener('input', () => { mix[field.key] = Number(field.slider.value); if (field.key === 'beat') mix.automation.kind = 'fixed'; changed(); });
  field.input.addEventListener('input', () => {
    const value = field.input.valueAsNumber;
    if (!Number.isFinite(value) || value < Number(field.input.min) || value > Number(field.input.max)) return;
    mix[field.key] = value;
    if (field.key === 'beat') mix.automation.kind = 'fixed';
    changed(true);
  });
  const commit = () => {
    if (!Number.isFinite(field.input.valueAsNumber)) { render(); return; }
    const next = normalizeMix({ ...mix, [field.key]: field.input.valueAsNumber });
    if (next[field.key] === mix[field.key]) render();
    else { mix = next; if (field.key === 'beat') mix.automation.kind = 'fixed'; changed(); }
  };
  field.input.addEventListener('change', commit);
  field.input.addEventListener('blur', commit);
}
document.querySelectorAll('input[name="mode"]').forEach((input) => input.addEventListener('change', () => {
  mix.mode = input.value;
  if (mix.mode === 'off') mix.toneSolo = false;
  changed();
}));
for (const [id, key] of [['#master-mute', 'masterMuted'], ['#tone-mute', 'toneMuted'], ['#tone-solo', 'toneSolo']]) {
  $(id).addEventListener('click', () => { mix[key] = !mix[key]; changed(); });
}
for (const { id } of allLayers) {
  $('[data-enable="' + id + '"]').addEventListener('change', (event) => {
    layerConfig(id).enabled = event.target.checked;
    if (!event.target.checked) layerConfig(id).solo = false;
    changed();
  });
  for (const [attribute, key] of [['volume', 'level'], ['pan', 'pan']]) {
    $('[data-' + attribute + '="' + id + '"]').addEventListener('input', (event) => { layerConfig(id)[key] = Number(event.target.value); changed(); });
  }
  for (const [attribute, key] of [['mute', 'muted'], ['solo', 'solo']]) {
    $('[data-' + attribute + '="' + id + '"]').addEventListener('click', () => {
      layerConfig(id)[key] = !layerConfig(id)[key];
      if (key === 'solo' && layerConfig(id).solo) layerConfig(id).enabled = true;
      changed();
    });
  }
  $('[data-center="' + id + '"]').addEventListener('click', () => { layerConfig(id).pan = 0; changed(); });
}
$('#clear-solo').addEventListener('click', () => {
  mix.toneSolo = false;
  allLayers.forEach(({ id }) => { layerConfig(id).solo = false; });
  changed();
});
$('#mix-select').addEventListener('change', (event) => {
  const selection = event.target.value;
  const entry = selection.startsWith('preset:') ? PRESETS.find((x) => 'preset:' + x.id === selection) : library.find((x) => 'saved:' + x.id === selection);
  if (entry) applyMix(entry.mix, selection, entry.name);
  else { selectedMix = 'custom'; render(); }
});
$('#reset-mix').addEventListener('click', () => applyMix(defaultMix(), 'custom', ''));
$('#save-mix').addEventListener('click', () => {
  $('#mix-name').value = suggestedName;
  $('#save-error').textContent = '';
  saveHint();
  $('#save-dialog').showModal();
  $('#mix-name').focus();
});
function saveHint() {
  const name = $('#mix-name').value.trim().toLowerCase();
  $('#save-hint').textContent = library.some((entry) => entry.name.toLowerCase() === name) ? 'Saving will update the mix with this name.' : 'Stored in this browser.';
}
$('#mix-name').addEventListener('input', saveHint);
$('#cancel-save').addEventListener('click', () => $('#save-dialog').close());
$('#save-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#mix-name').value.trim().slice(0, 40);
  if (!name) { $('#save-error').textContent = 'Enter a name for this mix.'; return; }
  const existing = library.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
  if (!existing && library.length >= 30) { $('#save-error').textContent = 'Your library is full. Remove a saved mix first.'; return; }
  const entry = { id: existing?.id || crypto.randomUUID(), name, mix: normalizeMix(mix) };
  const nextLibrary = existing ? library.map((item) => item.id === existing.id ? entry : item) : [...library, entry];
  if (!writeLibrary(nextLibrary)) { $('#save-error').textContent = 'This browser could not save the mix.'; return; }
  library = nextLibrary;
  selectedMix = 'saved:' + entry.id;
  suggestedName = name;
  persistCurrent();
  renderLibrary();
  render();
  $('#save-dialog').close();
  notify('Saved ' + name);
});
$('#delete-mix').addEventListener('click', () => {
  const entry = library.find((item) => 'saved:' + item.id === selectedMix);
  if (!entry) return;
  const nextLibrary = library.filter((item) => item.id !== entry.id);
  if (!writeLibrary(nextLibrary)) { notify('This browser could not remove the mix'); return; }
  library = nextLibrary;
  selectedMix = 'custom';
  persistCurrent();
  renderLibrary();
  render();
  notify('Removed ' + entry.name + '. Current settings retained.');
});
function renderProgram(preserveInput) {
  const kind = mix.automation.kind;
  $('input[name="program"][value="' + kind + '"]').checked = true;
  $('#sweep-controls').hidden = kind !== 'sweep';
  $('#session-builder').hidden = kind !== 'sequence';
  $('#program-monitor').hidden = kind === 'fixed';
  $('#pulse-controls').hidden = mix.mode !== 'isochronic';
  const set = (id, value) => { if (!preserveInput || document.activeElement !== $(id)) $(id).value = value; };
  for (const key of ['start', 'end', 'seconds', 'curve', 'repeat']) set('#sweep-' + key, mix.automation.sweep[key]);
  for (const key of ['in', 'out']) set('#fade-' + key, mix.fades[key]);
  for (const key of ['width', 'softness', 'depth']) { set('#pulse-' + key, mix.pulse[key]); $('#pulse-' + key + '-value').value = mix.pulse[key] + '%'; }
  $('#signal-error').textContent = signalError(mix);
  if (kind === 'sequence' && !document.activeElement?.closest('.stage-row')) renderStages();
  $('#session-total').value = formatTime(mix.automation.stages.reduce((sum, stage) => sum + stage.seconds, 0));
  $('#add-stage').disabled = mix.automation.stages.length >= 16 || mix.automation.stages.reduce((sum, stage) => sum + stage.seconds, 0) > 7195;
  drawProgram();
}
function renderStages() {
  $('#stage-list').innerHTML = mix.automation.stages.map((stage, i) => '<div class="stage-row" data-stage="' + i + '"><span class="stage-number">' + (i + 1) + '</span>' +
    '<label class="compact-field">Type<select data-stage-key="type"><option value="hold"' + (stage.type === 'hold' ? ' selected' : '') + '>Hold</option><option value="sweep"' + (stage.type === 'sweep' ? ' selected' : '') + '>Sweep</option></select></label>' +
    '<label class="compact-field">Start Hz<input data-stage-key="start" type="number" min="0.5" max="40" step="0.01" value="' + stage.start.toFixed(2) + '" /></label>' +
    '<label class="compact-field">End Hz<input data-stage-key="end" type="number" min="0.5" max="40" step="0.01" value="' + stage.end.toFixed(2) + '"' + (stage.type === 'hold' ? ' disabled' : '') + ' /></label>' +
    '<label class="compact-field">Seconds<input data-stage-key="seconds" type="number" min="5" max="3600" step="1" value="' + stage.seconds + '" /></label>' +
    '<label class="compact-field">Curve<select data-stage-key="curve"' + (stage.type === 'hold' ? ' disabled' : '') + '><option value="linear"' + (stage.curve === 'linear' ? ' selected' : '') + '>Linear</option><option value="smooth"' + (stage.curve === 'smooth' ? ' selected' : '') + '>Smooth</option></select></label>' +
    '<div class="stage-actions">' + [['up', 'arrow-up', 'Move stage up', i === 0], ['down', 'arrow-down', 'Move stage down', i === mix.automation.stages.length - 1], ['remove', 'trash', 'Remove stage', mix.automation.stages.length === 1]].map(([action, icon, label, disabled]) => '<button class="icon-button" data-stage-action="' + action + '" title="' + label + '" aria-label="' + label + '"' + (disabled ? ' disabled' : '') + '><img src="' + iconUrl(icon) + '" alt="" /></button>').join('') + '</div></div>').join('');
}
function drawProgram() {
  if (mix.automation.kind === 'fixed') return;
  const elapsed = engine.elapsed(), current = programAt(mix, elapsed);
  $('#live-rate').value = current.rate.toFixed(2) + ' Hz';
  $('#program-label').textContent = current.label;
  $('#program-progress').value = current.progress;
  for (const row of document.querySelectorAll('.stage-row')) row.classList.toggle('current-stage', Number(row.dataset.stage) === current.stage && mix.automation.kind === 'sequence');
  const canvas = $('#program-canvas'), drawing = canvas.getContext('2d');
  const width = canvas.clientWidth, height = 80;
  if (!width) return;
  canvas.width = Math.round(width * Math.min(devicePixelRatio || 1, 2)); canvas.height = height * Math.min(devicePixelRatio || 1, 2);
  drawing.scale(canvas.width / width, canvas.height / height);
  const length = mix.automation.kind === 'sequence' ? sessionSeconds(mix) : mix.automation.sweep.seconds * (mix.automation.sweep.repeat === 'pingpong' ? 2 : 1);
  const rates = Array.from({ length: 129 }, (_, i) => programAt(mix, i / 128 * length).rate);
  const low = Math.min(...rates), range = Math.max(1, Math.max(...rates) - low);
  const y = (rate) => 66 - (rate - low) / range * 52;
  drawing.strokeStyle = canvasTheme.program; drawing.lineWidth = 2;
  drawing.beginPath(); rates.forEach((rate, i) => i ? drawing.lineTo(i / 128 * width, y(rate)) : drawing.moveTo(0, y(rate))); drawing.stroke();
  const position = mix.automation.kind === 'sweep' && mix.automation.sweep.repeat === 'pingpong' ? elapsed % length : Math.min(elapsed, length);
  drawing.fillStyle = canvasTheme.marker; drawing.beginPath(); drawing.arc(position / length * (width - 8) + 4, y(current.rate), 4, 0, Math.PI * 2); drawing.fill();
  const left = (mix.carrier - current.rate / 2).toFixed(3), right = (mix.carrier + current.rate / 2).toFixed(3);
  $('#signal-detail').textContent = mix.mode === 'off' ? 'Generator off' : mix.mode === 'isochronic' ? mix.carrier + ' Hz tone / ' + current.rate.toFixed(2) + ' pulses/second' : mix.mode === 'binaural' ? 'Left ' + left + ' Hz / Right ' + right + ' Hz' : left + ' + ' + right + ' Hz mixed to both ears';
}
document.querySelectorAll('input[name="program"]').forEach((input) => input.addEventListener('change', () => { mix.automation.kind = input.value; changed(); engine.resetPosition(); }));
for (const key of ['start', 'end', 'seconds', 'curve', 'repeat']) {
  const updateSweep = () => {
  const input = $('#sweep-' + key); if (input.type === 'number' && !input.checkValidity()) { render(); return; }
  if (mix.automation.sweep[key] === (input.type === 'number' ? input.valueAsNumber : input.value)) return;
  mix.automation.sweep[key] = input.type === 'number' ? input.valueAsNumber : input.value;
  changed(true); engine.resetPosition();
  };
  $('#sweep-' + key).addEventListener('change', updateSweep);
  if (['start', 'end', 'seconds'].includes(key)) $('#sweep-' + key).addEventListener('input', () => { if ($('#sweep-' + key).checkValidity()) updateSweep(); });
}
for (const key of ['in', 'out']) {
  const updateFade = () => { if (!$('#fade-' + key).checkValidity()) return; mix.fades[key] = $('#fade-' + key).valueAsNumber; changed(true); };
  $('#fade-' + key).addEventListener('change', updateFade); $('#fade-' + key).addEventListener('input', updateFade);
}
for (const key of ['width', 'softness', 'depth']) $('#pulse-' + key).addEventListener('input', () => { mix.pulse[key] = Number($('#pulse-' + key).value); changed(); });
function updateStage(event) {
  const key = event.target.dataset.stageKey; if (!key) return;
  if (event.target.type === 'number' && !event.target.checkValidity()) { renderStages(); return; }
  const index = Number(event.target.closest('.stage-row').dataset.stage);
  const value = event.target.type === 'number' ? event.target.valueAsNumber : event.target.value;
  if (key === 'seconds' && mix.automation.stages.reduce((sum, stage, i) => sum + (i === index ? value : stage.seconds), 0) > 7200) { $('#stage-error').textContent = 'A session can be at most 2 hours.'; renderStages(); return; }
  mix.automation.stages[index][key] = value;
  $('#stage-error').textContent = ''; changed(true); engine.resetPosition();
  if (event.type === 'change') renderStages();
}
$('#stage-list').addEventListener('change', updateStage);
$('#stage-list').addEventListener('input', (event) => { if (event.target.type === 'number' && event.target.checkValidity()) updateStage(event); });
$('#stage-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-stage-action]'); if (!button) return;
  const index = Number(button.closest('.stage-row').dataset.stage), stages = mix.automation.stages;
  const action = button.dataset.stageAction;
  if (action === 'remove') stages.splice(index, 1);
  else { const next = index + (action === 'up' ? -1 : 1); [stages[index], stages[next]] = [stages[next], stages[index]]; }
  document.activeElement.blur(); changed(); engine.resetPosition();
});
$('#add-stage').addEventListener('click', () => {
  const stages = mix.automation.stages, end = stages.at(-1).end;
  stages.push({ type: 'hold', start: end, end, seconds: Math.min(60, 7200 - stages.reduce((sum, stage) => sum + stage.seconds, 0)), curve: 'linear' });
  changed(); engine.resetPosition();
});
for (const id of ['#band-filter', '#method-filter', '#preset-search', '#favorites-only']) $(id).addEventListener(id === '#preset-search' ? 'input' : 'change', renderLibrary);
function persistFavorites() {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); }
  catch { notify('Favorites changed; browser storage unavailable'); }
}
$('#favorite-mix').addEventListener('click', () => { if (!selectedMix.startsWith('preset:')) return; if (favorites.has(selectedMix)) favorites.delete(selectedMix); else favorites.add(selectedMix); persistFavorites(); renderLibrary(); render(); });

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function jsonDownload(value, filename) { downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), filename); }
function exportName() { return 'Hz Mixer - ' + ((suggestedName || 'My mix').replace(/[^a-z0-9 _-]/gi, '').trim() || 'My mix'); }
let exportTab = 'audio', exportAbort = null;
if (typeof window.showSaveFilePicker === 'function') $('#export-summary').before($('#direct-export-template').content.cloneNode(true));
function renderExport() {
  $('#audio-export-fields').hidden = exportTab !== 'audio';
  const seconds = Number($('#export-seconds').value), rate = Number($('#export-rate').value), mp3 = $('#export-format').value === 'mp3', bitrate = Number($('#export-bitrate').value);
  const bytes = mp3 ? seconds * bitrate * 125 : 44 + seconds * rate * 4;
  $('#export-bitrate-field').hidden = !mp3;
  $('#export-summary').textContent = exportTab === 'audio' ? (mp3 ? 'Stereo MP3 / ' + bitrate + ' kbps / ' : 'Stereo 16-bit PCM / ') + formatTime(seconds) + ' / ' + (mp3 ? 'approx. ' : '') + (bytes / 1048576).toFixed(1) + ' MB' + (mp3 ? ' / Lossy; use WAV for an uncompressed reference.' : '') : exportTab === 'mix' ? 'Current mix, frequency program and layer settings.' : library.length + ' saved mixes, current mix and ' + favorites.size + ' favorites.';
  $('#export-seconds').disabled = Boolean(exportAbort) || mix.automation.kind === 'sequence';
  $('#export-rate').disabled = Boolean(exportAbort);
  $('#export-format').disabled = Boolean(exportAbort); $('#export-bitrate').disabled = Boolean(exportAbort);
  $('#download-export').disabled = Boolean(exportAbort);
  if ($('#export-direct')) { $('#direct-export-field').hidden = exportTab !== 'audio'; $('#export-direct').disabled = Boolean(exportAbort); }
  if (exportTab === 'audio' && bytes > 128 * 1048576 && !$('#export-direct')?.checked) $('#export-summary').textContent += ' / Large download: browser memory use may be high.';
  document.querySelectorAll('[data-export-tab]').forEach((button) => { button.setAttribute('aria-pressed', String(button.dataset.exportTab === exportTab)); button.disabled = Boolean(exportAbort); });
}
$('#open-export').addEventListener('click', () => { $('#export-seconds').value = exportSeconds(mix); $('#export-error').textContent = ''; $('#export-progress').hidden = true; renderExport(); $('#export-dialog').showModal(); });
document.querySelectorAll('[data-export-tab]').forEach((button) => button.addEventListener('click', () => { exportTab = button.dataset.exportTab; $('#export-error').textContent = ''; renderExport(); }));
$('#export-seconds').addEventListener('input', renderExport); $('#export-rate').addEventListener('change', renderExport);
$('#export-format').addEventListener('change', renderExport); $('#export-bitrate').addEventListener('change', renderExport);
$('#export-direct')?.addEventListener('change', renderExport);
function cancelExport() { if (exportAbort) { exportAbort.abort(); $('#cancel-export').disabled = true; } else $('#export-dialog').close(); }
$('#cancel-export').addEventListener('click', cancelExport);
$('#export-dialog').addEventListener('cancel', (event) => { if (exportAbort) { event.preventDefault(); cancelExport(); } });
$('#download-export').addEventListener('click', async () => {
  if (exportTab === 'mix') { jsonDownload(makeMixFile(mix, suggestedName), exportName() + '.json'); return; }
  if (exportTab === 'library') { jsonDownload(makeBackup(library, mix, suggestedName, [...favorites]), 'Hz Mixer library.json'); return; }
  const snapshot = normalizeMix(mix), seconds = Number($('#export-seconds').value), rate = Number($('#export-rate').value), format = $('#export-format').value, bitrate = Number($('#export-bitrate').value), filename = exportName() + '.' + format;
  const error = format === 'mp3' ? mp3Error(snapshot, seconds, rate, bitrate) : wavError(snapshot, seconds, rate); if (error) { $('#export-error').textContent = error; return; }
  exportAbort = new AbortController(); renderExport(); $('#export-error').textContent = ''; $('#export-progress').hidden = false; $('#export-progress').value = 0;
  $('#cancel-export').textContent = 'Cancel export';
  let writable = null;
  try {
    if ($('#export-direct')?.checked) {
      const handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: format.toUpperCase() + ' audio', accept: { [format === 'mp3' ? 'audio/mpeg' : 'audio/wav']: ['.' + format] } }] });
      writable = await handle.createWritable();
    }
    const progress = (value, status) => { $('#export-progress').value = value; $('#export-summary').textContent = status + ' / ' + Math.round(value * 100) + '%'; };
    const blob = format === 'mp3'
      ? await renderMp3(snapshot, seconds, rate, bitrate, (id) => engine.buffer(id), progress, exportAbort.signal, 20, writable)
      : await renderWav(snapshot, seconds, rate, (id) => engine.buffer(id), progress, exportAbort.signal, 20, writable);
    if (writable) await writable.close(); else downloadBlob(blob, filename);
    notify(format.toUpperCase() + ' export complete');
  } catch (error) { if (writable) { try { await writable.abort(); } catch { /* A completed or closed writer cannot be aborted. */ } } $('#export-error').textContent = error.name === 'AbortError' ? 'Export cancelled. No completed audio file was saved.' : error.message; }
  finally { exportAbort = null; $('#cancel-export').textContent = 'Close'; $('#cancel-export').disabled = false; renderExport(); }
});
let importData = null, importRequest = 0;
$('#open-import').addEventListener('click', () => { importRequest++; importData = null; $('#import-file').value = ''; $('#import-error').textContent = ''; $('#import-summary').textContent = 'Select a mix or library backup.'; $('#import-preview').replaceChildren(); $('#confirm-import').disabled = true; $('#import-current-field').hidden = true; $('#import-dialog').showModal(); });
$('#cancel-import').addEventListener('click', () => $('#import-dialog').close());
$('#import-file').addEventListener('change', async () => {
  const request = ++importRequest;
  importData = null; $('#confirm-import').disabled = true; $('#import-error').textContent = ''; $('#import-preview').replaceChildren();
  try {
    const file = $('#import-file').files[0]; if (!file) return;
    if (file.size > 1000000) throw new Error('Choose a JSON file smaller than 1 MB.');
    const text = await file.text();
    if (request !== importRequest) return;
    importData = parseBackup(text);
    $('#import-summary').textContent = importData.entries.length + ' saved mixes / ' + importData.favorites.length + ' favorites' + (importData.current ? ' / current: ' + importData.current.name : '');
    for (const entry of importData.entries) { const item = document.createElement('li'); item.textContent = entry.name; $('#import-preview').append(item); }
    $('#import-current-field').hidden = !importData.current; $('#import-current').checked = true; $('#confirm-import').disabled = false;
  } catch (error) { if (request === importRequest) $('#import-error').textContent = error.message; }
});
$('#confirm-import').addEventListener('click', () => {
  if (!importData) return;
  try {
    const incoming = [...importData.entries];
    if (importData.current && $('#import-current').checked) incoming.push({ id: crypto.randomUUID(), name: importData.current.name, mix: importData.current.mix });
    const replace = $('#import-action').value === 'replace';
    const next = mergeImports(library, incoming, replace, () => crypto.randomUUID());
    if (!writeLibrary(next)) throw new Error('This browser could not store the imported library.');
    library = next; favorites = new Set(replace ? importData.favorites : [...favorites, ...importData.favorites]); persistFavorites();
    if (selectedMix.startsWith('saved:') && !library.some((e) => 'saved:' + e.id === selectedMix)) selectedMix = 'custom';
    persistCurrent(); renderLibrary(); render(); $('#import-dialog').close(); notify('Imported library. Current audio unchanged.');
  } catch (error) { $('#import-error').textContent = error.message; }
});

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
  view = button.dataset.view;
  $('#scope-canvas').ariaLabel = 'Live output ' + view;
  render();
  persistCurrent();
}));

const canvas = $('#scope-canvas');
const scope = canvas.getContext('2d');
const waveform = new Float32Array(2048);
const spectrum = new Uint8Array(1024);
let lastDraw = 0;
function drawScope(timestamp) {
  requestAnimationFrame(drawScope);
  if (timestamp - lastDraw < 50) return;
  lastDraw = timestamp;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (width < 1 || height < 1) return;
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  scope.clearRect(0, 0, width, height);
  scope.strokeStyle = canvasTheme.grid;
  scope.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    scope.beginPath(); scope.moveTo(0, height * i / 4); scope.lineTo(width, height * i / 4); scope.stroke();
  }
  if (engine.playing) engine.analyser.getFloatTimeDomainData(waveform);
  else waveform.fill(0);
  const rms = Math.sqrt(waveform.reduce((sum, sample) => sum + sample * sample, 0) / waveform.length);
  const db = rms > 0.00001 ? 20 * Math.log10(rms) : -100;
  $('#signal-level').value = db < -80 ? '-- dBFS' : db.toFixed(1) + ' dBFS';
  $('#meter-fill').style.width = Math.max(0, Math.min(100, (db + 60) / 60 * 100)) + '%';
  if (view === 'spectrum') {
    if (engine.playing) engine.analyser.getByteFrequencyData(spectrum);
    else spectrum.fill(0);
    const count = 80;
    const rate = engine.context?.sampleRate || 48000;
    for (let i = 0; i < count; i += 1) {
      const frequency = 30 * Math.pow(400, i / count);
      const bin = Math.min(spectrum.length - 1, Math.round(frequency * 2048 / rate));
      const barHeight = spectrum[bin] / 255 * height * .84;
      scope.fillStyle = i < count * .65 ? canvasTheme.spectrum : canvasTheme.peak;
      scope.fillRect(i * width / count, height - barHeight, Math.max(1, width / count - 3 * ratio), Math.max(1, barHeight));
    }
  } else {
    scope.beginPath(); scope.strokeStyle = canvasTheme.wave; scope.lineWidth = 1.5 * ratio;
    waveform.forEach((value, i) => {
      const x = i / (waveform.length - 1) * width;
      const y = height / 2 - value * height * .9;
      if (i === 0) scope.moveTo(x, y); else scope.lineTo(x, y);
    });
    scope.stroke();
  }
  canvas.dataset.view = view;
}
applyTheme();
engine.update(mix);
renderLibrary();
render();
setInterval(tickTimer, 250);
requestAnimationFrame(drawScope);
