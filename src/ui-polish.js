export function initializeUIPolish({ onLevelChange }) {
  const root = document.querySelector('.app-shell'), bindings = [], motions = new WeakMap();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  for (const range of root.querySelectorAll('#master-level, #tone-level, input[type="range"][data-volume], input[type="range"][data-voice-key="level"]')) {
    let field = range.closest('.field');
    const output = field.querySelector('output'), heading = field.querySelector(':scope > span');
    if (field.tagName === 'LABEL') {
      const replacement = document.createElement('div');
      for (const attribute of field.attributes) if (attribute.name !== 'for') replacement.setAttribute(attribute.name, attribute.value);
      while (field.firstChild) replacement.append(field.firstChild);
      field.replaceWith(replacement); field = replacement;
    }
    range.id ||= 'level-' + (range.dataset.volume || range.dataset.voiceId);
    const label = document.createElement('label'); label.htmlFor = range.id;
    label.textContent = heading.firstChild.textContent.trim(); heading.firstChild.replaceWith(label);
    heading.classList.add('level-heading'); output.classList.add('sr-only'); output.setAttribute('aria-hidden', 'true');
    const box = document.createElement('span'), input = document.createElement('input'), unit = document.createElement('span');
    box.className = 'percent-field'; input.type = 'number'; input.min = range.min; input.max = range.max; input.step = 'any'; input.inputMode = 'decimal';
    input.id = range.id + '-number'; input.dataset.percentSource = range.id;
    const name = range.dataset.voiceId ? 'Tone ' + range.dataset.voiceId.replace('voice-', '') + ' level' : range.getAttribute('aria-label')?.replace(/volume$/, 'level') || (range.id === 'master-level' ? 'Master level' : 'Tone level');
    input.setAttribute('aria-label', name + ' percent'); unit.textContent = '%'; unit.setAttribute('aria-hidden', 'true');
    box.append(input, unit); heading.append(box);
    const read = () => Number.parseFloat(output.value) || 0;
    const commit = () => {
      const value = input.valueAsNumber;
      if (Number.isFinite(value) && value >= Number(range.min) && value <= Number(range.max) && value !== read()) onLevelChange(range, value);
      input.value = String(read());
    };
    input.addEventListener('change', commit); input.addEventListener('blur', commit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); commit(); }
      if (event.key === 'Escape') { event.preventDefault(); input.value = String(read()); }
    });
    bindings.push({ input, read });
  }
  function syncLevels() { for (const { input, read } of bindings) if (document.activeElement !== input) input.value = String(read()); }
  for (const type of ['input', 'change', 'click']) root.addEventListener(type, syncLevels);
  function animateCommand(button, command) {
    const icon = button.querySelector('img');
    motions.get(icon)?.cancel();
    if (reducedMotion.matches || !icon.animate) return;
    const frames = command === 'reset' ? [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-360deg)' }]
      : [{ transform: 'translateY(0) rotate(0deg)' }, { transform: 'translateY(-3px) rotate(75deg)', offset: .25 }, { transform: 'translateY(1px) rotate(285deg)', offset: .75 }, { transform: 'translateY(0) rotate(360deg)' }];
    motions.set(icon, icon.animate(frames, { duration: command === 'reset' ? 420 : 520, easing: 'ease-out' }));
  }
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) for (const icon of root.querySelectorAll('#reset-mix img, #randomize-mix img')) motions.get(icon)?.cancel(); });
  initializeControlTooltips(); syncLevels();
  return { syncLevels, animateCommand };
}

function initializeControlTooltips() {
  const tip = document.createElement('div'); tip.id = 'control-tooltip'; tip.className = 'control-tooltip'; tip.role = 'tooltip'; tip.hidden = true; document.body.append(tip);
  let owner = null, queued = null, timer = 0, keyboard = false;
  const titleToTooltip = (button) => {
    const title = button.getAttribute('title');
    if (title) { button.dataset.tooltip = title; button.removeAttribute('title'); }
  };
  const collect = (node) => {
    if (node.nodeType !== 1) return;
    if (node.matches('button[title]')) titleToTooltip(node);
    for (const button of node.querySelectorAll('button[title]')) titleToTooltip(button);
  };
  function dismiss() {
    clearTimeout(timer); tip.hidden = true;
    if (owner) {
      const ids = (owner.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => id && id !== tip.id);
      if (ids.length) owner.setAttribute('aria-describedby', ids.join(' ')); else owner.removeAttribute('aria-describedby');
    }
    owner = null; queued = null;
  }
  function position(button) {
    const box = button.getBoundingClientRect(), bounds = tip.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(innerWidth - bounds.width - 8, box.left + (box.width - bounds.width) / 2)) + 'px';
    tip.style.top = Math.max(8, Math.min(innerHeight - bounds.height - 8, box.top >= bounds.height + 8 ? box.top - bounds.height - 8 : box.bottom + 8)) + 'px';
  }
  function show(button) {
    if (!button.isConnected || button.disabled || !button.getClientRects().length) return;
    dismiss(); owner = button; tip.textContent = button.dataset.tooltip || button.getAttribute('aria-label');
    if (!tip.textContent) { owner = null; return; }
    (button.closest('dialog[open]') || document.body).append(tip); tip.hidden = false;
    const ids = (button.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    button.setAttribute('aria-describedby', [...new Set([...ids, tip.id])].join(' '));
    position(button);
  }
  function afterLayoutChange() {
    const button = owner || queued;
    dismiss();
    if (button?.isConnected && (button.matches(':hover') || keyboard && document.activeElement === button)) {
      queued = button; timer = setTimeout(() => show(button), 300);
    }
  }
  collect(document.body);
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target.matches('button')) titleToTooltip(record.target);
      for (const node of record.addedNodes) collect(node);
    }
    if (owner && (!owner.isConnected || owner.disabled || !owner.getClientRects().length)) dismiss();
    else if (owner) {
      const text = owner.dataset.tooltip || owner.getAttribute('aria-label');
      if (tip.textContent !== text) { tip.textContent = text; position(owner); }
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title', 'disabled', 'hidden'] });
  document.addEventListener('pointerdown', (event) => { keyboard = false; if (event.pointerType === 'touch') dismiss(); });
  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const button = event.target.closest('button[data-tooltip]');
    if (!button || event.relatedTarget instanceof Node && button.contains(event.relatedTarget)) return;
    dismiss(); queued = button; timer = setTimeout(() => show(button), 300);
  });
  document.addEventListener('pointerout', (event) => {
    const button = event.target.closest('button[data-tooltip]');
    if (!button || event.relatedTarget instanceof Node && (button.contains(event.relatedTarget) || tip.contains(event.relatedTarget))) return;
    if (!keyboard || document.activeElement !== button) dismiss();
  });
  tip.addEventListener('pointerleave', () => { if (!keyboard || document.activeElement !== owner) dismiss(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Tab') keyboard = true; if (event.key === 'Escape') dismiss(); });
  document.addEventListener('focusin', (event) => { const button = event.target.closest('button[data-tooltip]'); if (keyboard && button) show(button); });
  document.addEventListener('focusout', (event) => { if (event.target === owner) dismiss(); });
  document.addEventListener('scroll', afterLayoutChange, true); window.addEventListener('resize', afterLayoutChange);
  document.addEventListener('close', dismiss, true);
}
