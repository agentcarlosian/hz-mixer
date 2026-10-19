export async function revealMixerControl(page, selector) {
  const location = await page.locator(selector).first().evaluate((element) => ({
    tone: element.closest('[id^="tone-editor-"]')?.id.slice('tone-editor-'.length),
    advanced: Boolean(element.closest('[data-advanced-only], [data-studio-voice]')),
    effects: Boolean(element.closest('#source-effects')),
  }));
  if (location.effects) return;
  if (await page.locator('#source-effects').evaluate((dialog) => dialog.open)) await page.locator('#close-source-effects').click();
  if (location.advanced) await page.locator('button[data-interface-mode="advanced"]').click();
  if (location.tone && await page.locator('[data-tone-source="' + location.tone + '"]').isVisible()) await page.locator('[data-tone-source="' + location.tone + '"]').click();
}

export async function setStageDuration(page, index, seconds) {
  const prefix = '[data-stage="' + index + '"] ';
  const minuteField = page.locator(prefix + '[data-stage-duration="minutes"]'), secondField = page.locator(prefix + '[data-stage-duration="seconds"]');
  await minuteField.fill(String(Math.floor(seconds / 60)));
  await secondField.fill(String(seconds % 60));
  await secondField.press('Tab');
}

export async function openStageChanges(page, index) {
  const changes = page.locator('[data-stage="' + index + '"] .stage-changes');
  if (!(await changes.evaluate((element) => element.open))) await changes.locator('summary').click();
}
