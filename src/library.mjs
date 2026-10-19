import { defaultMix, normalizeMix, normalizeLibrary, PRESETS, STUDIO_TARGETS } from './mix-state.mjs';

export const MAX_JSON_BYTES = 4000000;

function exportVersion(mixes) {
  const defaults = defaultMix();
  if (mixes.some((mix) => JSON.stringify(mix.studio) !== JSON.stringify(defaults.studio) || mix.automation.stages.some((stage) => stage.lanes?.length))) return 6;
  if (mixes.some((mix) => JSON.stringify(mix.sounds['window-rain']) !== JSON.stringify(defaults.sounds['window-rain']))) return 5;
  if (mixes.some((mix) => JSON.stringify(mix.bells) !== JSON.stringify(defaults.bells) || JSON.stringify(mix.sounds.campfire) !== JSON.stringify(defaults.sounds.campfire))) return 4;
  return mixes.some((mix) => mix.carrier < 20 || mix.carrier > 2000 || [mix.beat, mix.automation.sweep.start, mix.automation.sweep.end, ...mix.automation.stages.flatMap((stage) => [stage.start, stage.end])].some((rate) => rate < .5 || rate > 40)) ? 3 : 2;
}

export function makeBackup(entries, current, name, favorites) {
  const saved = normalizeLibrary(entries), mix = normalizeMix(current);
  return { format: 'hz-mixer-library', version: exportVersion([mix, ...saved.map((entry) => entry.mix)]), entries: saved, current: { name: name || 'Current mix', mix }, favorites: favorites.filter((id) => PRESETS.some((preset) => 'preset:' + preset.id === id)) };
}

export function makeMixFile(mix, name) {
  const normalized = normalizeMix(mix);
  return { format: 'hz-mixer-mix', version: exportVersion([normalized]), name: name || 'My mix', mix: normalized };
}

function checkMix(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !['binaural', 'monaural', 'isochronic', 'off'].includes(value.mode)) throw new Error('A mix has an invalid audio mode.');
  if (value.automation?.stages && (!Array.isArray(value.automation.stages) || !value.automation.stages.length || value.automation.stages.length > 16 || value.automation.stages.some((stage) => !stage || !Number.isFinite(stage.seconds) || stage.seconds < 5 || stage.seconds > 3600) || value.automation.stages.reduce((sum, stage) => sum + stage.seconds, 0) > 7200)) throw new Error('Session stages must fit within two hours and use 1 to 16 stages.');
  for (const stage of value.automation?.stages || []) if (stage.lanes) {
    const seen = new Set();
    if (!Array.isArray(stage.lanes) || stage.lanes.length > 16 || stage.lanes.some((lane) => {
      if (!lane || !STUDIO_TARGETS.some((target) => target.key === lane.target) || seen.has(lane.target) || !Number.isFinite(lane.start) || !Number.isFinite(lane.end)) return true;
      seen.add(lane.target); return false;
    })) throw new Error('Stage automation requires unique, valid targets and at most 16 lanes per stage.');
  }
  return normalizeMix(value);
}

export function parseBackup(text) {
  if (text.length > MAX_JSON_BYTES || new TextEncoder().encode(text).length > MAX_JSON_BYTES) throw new Error('Import files must be smaller than 4 MB.');
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!raw || ![2, 3, 4, 5, 6].includes(raw.version) || !['hz-mixer-library', 'hz-mixer-mix'].includes(raw.format)) throw new Error('Choose a version 2-6 Hz Mixer mix or library backup.');
  if (raw.format === 'hz-mixer-mix') return { entries: [{ id: 'imported-current', name: String(raw.name || 'Imported mix').slice(0, 40), mix: checkMix(raw.mix) }], current: null, favorites: [] };
  if (!Array.isArray(raw.entries) || raw.entries.length > 30) throw new Error('A library can contain at most 30 saved mixes.');
  const entries = raw.entries.map((entry) => {
    if (!entry || typeof entry.id !== 'string' || typeof entry.name !== 'string' || !entry.name.trim()) throw new Error('A saved mix is missing its name or identifier.');
    return { id: entry.id, name: entry.name, mix: checkMix(entry.mix) };
  });
  const normalized = normalizeLibrary(entries);
  if (normalized.length !== entries.length) throw new Error('The backup contains duplicate or invalid mix identifiers.');
  return { entries: normalized, current: raw.current ? { name: String(raw.current.name || 'Imported current mix').slice(0, 40), mix: checkMix(raw.current.mix) } : null, favorites: Array.isArray(raw.favorites) ? raw.favorites.filter((id) => PRESETS.some((preset) => 'preset:' + preset.id === id)) : [] };
}

export function mergeImports(existing, incoming, replace, makeId) {
  const result = replace ? [] : normalizeLibrary(existing);
  for (const raw of incoming) {
    const entry = normalizeLibrary([raw])[0];
    if (!entry) throw new Error('An imported mix has invalid data.');
    if (result.some((item) => item.id === entry.id && JSON.stringify(item.mix) === JSON.stringify(entry.mix) && item.name === entry.name)) continue;
    let name = entry.name;
    let suffix = 1;
    while (result.some((item) => item.name.toLowerCase() === name.toLowerCase())) name = entry.name.slice(0, 28) + ' (import ' + suffix++ + ')';
    result.push({ id: result.some((item) => item.id === entry.id) ? makeId() : entry.id, name, mix: normalizeMix(entry.mix) });
    if (result.length > 30) throw new Error('This import would exceed the 30-mix library limit.');
  }
  return result;
}
