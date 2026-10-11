import { normalizeMix, normalizeLibrary, PRESETS } from './mix-state.mjs';

export function makeBackup(entries, current, name, favorites) {
  return { format: 'hz-mixer-library', version: 2, entries: normalizeLibrary(entries), current: { name: name || 'Current mix', mix: normalizeMix(current) }, favorites: favorites.filter((id) => PRESETS.some((preset) => 'preset:' + preset.id === id)) };
}

export function makeMixFile(mix, name) {
  return { format: 'hz-mixer-mix', version: 2, name: name || 'My mix', mix: normalizeMix(mix) };
}

function checkMix(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !['binaural', 'monaural', 'isochronic', 'off'].includes(value.mode)) throw new Error('A mix has an invalid audio mode.');
  if (value.automation?.stages && (!Array.isArray(value.automation.stages) || !value.automation.stages.length || value.automation.stages.length > 16 || value.automation.stages.some((stage) => !stage || !Number.isFinite(stage.seconds) || stage.seconds < 5 || stage.seconds > 3600) || value.automation.stages.reduce((sum, stage) => sum + stage.seconds, 0) > 7200)) throw new Error('Session stages must fit within two hours and use 1 to 16 stages.');
  return normalizeMix(value);
}

export function parseBackup(text) {
  if (text.length > 1000000) throw new Error('Import files must be smaller than 1 MB.');
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!raw || raw.version !== 2 || !['hz-mixer-library', 'hz-mixer-mix'].includes(raw.format)) throw new Error('Choose a version 2 Hz Mixer mix or library backup.');
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
