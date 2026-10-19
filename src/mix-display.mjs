import { SOUNDS, NOISES, BELLS, bandFor } from './mix-state.mjs';
import { generatorSpecs } from './studio-state.mjs';
import { sourceProgram } from './studio-program.mjs';

const methodNames = { binaural: 'Binaural', monaural: 'Monaural', isochronic: 'Isochronic' };
function programSummary(mix) {
  if (mix.automation.kind === 'fixed') return mix.beat.toFixed(2) + ' Hz';
  if (mix.automation.kind === 'sweep') return 'Sweep ' + mix.automation.sweep.start.toFixed(2) + ' to ' + mix.automation.sweep.end.toFixed(2) + ' Hz';
  const stages = mix.automation.stages;
  return 'Session ' + stages[0].start.toFixed(2) + ' to ' + stages.at(-1).end.toFixed(2) + ' Hz';
}
export function mixSummary(mix) {
  const tones = generatorSpecs(mix).filter((tone) => tone.enabled);
  if (!tones.length) return 'Environment only';
  const methods = [...new Set(tones.map((tone) => methodNames[tone.mode]))].join(' + ');
  const programs = [...new Set(tones.map((tone) => programSummary(sourceProgram(mix, tone.id))))].join(' | ');
  return tones.length === 1 ? methods + ' / ' + programs + ' / ' + tones[0].carrier + ' Hz carrier'
    : tones.length + ' tones / ' + methods + ' / ' + programs;
}
export function matchesMixSearch(entry, query) {
  const words = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const mix = entry.mix, tones = generatorSpecs(mix).filter((tone) => tone.enabled);
  const band = entry.band || (tones.length ? bandFor(sourceProgram(mix, tones[0].id).beat) : 'nature');
  const terms = [entry.name, band === 'nature' ? 'environment only ambient' : band, mixSummary(mix)];
  for (const tone of tones) {
    const program = sourceProgram(mix, tone.id);
    terms.push(tone.mode, program.automation.kind === 'sequence' ? 'session sequence' : program.automation.kind);
  }
  for (const { id, name } of [...SOUNDS, ...NOISES, ...BELLS]) if ((mix.sounds[id] || mix.noise[id] || mix.bells[id]).enabled) terms.push(name);
  const haystack = terms.join(' ').toLowerCase();
  return words.every((word) => haystack.includes(word));
}
