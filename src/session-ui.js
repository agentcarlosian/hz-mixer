import { STUDIO_TARGETS } from './mix-state.mjs';
import { studioBaseValue } from './studio-state.mjs';
import { iconUrl } from './resources.js';

export function initializeSessionChanges({ getMix, onChange }) {
  const root = document.getElementById('stage-list');
  const rendered = new WeakMap();
  const render = () => {
    const mix = getMix();
    for (const [index, stage] of mix.automation.stages.entries()) {
      const row = root.children[index]; if (!row) continue;
      let changes = row.querySelector('.stage-changes');
      if (!changes) { changes = document.createElement('details'); changes.className = 'stage-changes'; changes.dataset.advancedOnly = ''; changes.open = Boolean(stage.lanes?.length); row.append(changes); }
      if (changes.contains(document.activeElement)) continue;
      const lanes = stage.lanes || [];
      const signature = JSON.stringify([index, lanes]);
      if (rendered.get(changes) === signature) continue;
      rendered.set(changes, signature);
      changes.innerHTML = '<summary>Parameter changes <span>(' + lanes.length + ')</span></summary><div class="stage-changes-heading"><button class="button secondary" data-add-change="' + index + '"' + (lanes.length >= 16 ? ' disabled' : '') + '><img class="icon" src="' + iconUrl('plus') + '" alt="" />Add change</button></div>' +
        lanes.map((lane, laneIndex) => {
          const spec = STUDIO_TARGETS.find((target) => target.key === lane.target);
          return '<div class="stage-change-row" data-change-stage="' + index + '" data-change-index="' + laneIndex + '"><label class="compact-field">Setting<select data-change-key="target">' + STUDIO_TARGETS.map((target) => '<option value="' + target.key + '">' + target.label + '</option>').join('') + '</select></label>' +
            ['start', 'end'].map((key) => '<label class="compact-field">' + (key === 'start' ? 'From' : 'To') + '<input type="number" data-change-key="' + key + '" min="' + spec.min + '" max="' + spec.max + '" step="' + spec.step + '" value="' + lane[key] + '" /></label>').join('') +
            '<label class="compact-field">Transition<select data-change-key="curve"><option value="linear">Linear</option><option value="smooth">Smooth</option></select></label><button class="icon-button" data-remove-change="' + laneIndex + '" title="Remove change" aria-label="Remove change ' + (laneIndex + 1) + ' from stage ' + (index + 1) + '"><img src="' + iconUrl('trash') + '" alt="" /></button></div>';
        }).join('') + '<p class="error stage-change-error" role="alert"></p>';
      for (const [laneIndex, lane] of lanes.entries()) { const entry = changes.querySelector('[data-change-index="' + laneIndex + '"]'); entry.querySelector('[data-change-key="target"]').value = lane.target; entry.querySelector('[data-change-key="curve"]').value = lane.curve; }
    }
  };
  const commit = () => { onChange(getMix().automation.kind === 'sequence'); render(); };
  root.addEventListener('click', (event) => {
    const add = event.target.closest('[data-add-change]');
    if (add) {
      const mix = getMix(), stage = mix.automation.stages[Number(add.dataset.addChange)], lanes = stage.lanes || [];
      const spec = STUDIO_TARGETS.find((target) => !lanes.some((lane) => lane.target === target.key));
      if (!spec || lanes.length >= 16) return;
      const value = studioBaseValue(mix, spec.key); stage.lanes = [...lanes, { target: spec.key, start: value, end: value, curve: 'linear' }];
      add.blur(); commit();
      root.children[Number(add.dataset.addChange)]?.querySelector('[data-change-index="' + lanes.length + '"] select')?.focus();
    }
    const remove = event.target.closest('[data-remove-change]');
    if (remove) { const entry = remove.closest('[data-change-stage]'); getMix().automation.stages[Number(entry.dataset.changeStage)].lanes.splice(Number(entry.dataset.changeIndex), 1); remove.blur(); commit(); }
  });
  root.addEventListener('change', (event) => {
    const field = event.target, key = field.dataset.changeKey, entry = field.closest('[data-change-stage]');
    if (!entry || !['target', 'start', 'end', 'curve'].includes(key)) return;
    const mix = getMix(), lanes = mix.automation.stages[Number(entry.dataset.changeStage)].lanes, index = Number(entry.dataset.changeIndex);
    if (field.type === 'number' && !field.checkValidity()) { field.value = lanes[index][key]; return; }
    if (key === 'target') {
      const spec = STUDIO_TARGETS.find((target) => target.key === field.value);
      if (!spec || lanes.some((lane, i) => i !== index && lane.target === field.value)) { entry.closest('.stage-changes').querySelector('.stage-change-error').textContent = 'This setting already has a change in this stage.'; field.value = lanes[index].target; return; }
      const value = studioBaseValue(mix, spec.key); lanes[index] = { ...lanes[index], target: spec.key, start: value, end: value };
      for (const name of ['start', 'end']) { const number = entry.querySelector('[data-change-key="' + name + '"]'); number.min = spec.min; number.max = spec.max; number.step = spec.step; number.value = value; }
    } else lanes[index][key] = field.type === 'number' ? Number(field.value) : field.value;
    entry.closest('.stage-changes').querySelector('.stage-change-error').textContent = ''; commit();
  });
  return { render };
}
