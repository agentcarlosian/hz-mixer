import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const source = html.match(/<script id="theme-bootstrap">([\s\S]*?)<\/script>/)[1];
const script = new Script(source, { filename: 'theme-bootstrap' });
function boot(stored, systemDark, blocked = false) {
  const dataset = {};
  const meta = {};
  script.runInNewContext({
    localStorage: { getItem: () => { if (blocked) throw new Error('Unavailable'); return stored; } },
    window: { matchMedia: () => ({ matches: systemDark }) },
    document: { documentElement: { dataset }, querySelector: () => meta },
  });
  return { preference: dataset.themePreference, theme: dataset.theme, color: meta.content };
}

test('an unset theme follows the system before the page paints', () => {
  assert.deepEqual(boot(null, false), { preference: 'system', theme: 'light', color: '#f5f7f6' });
  assert.deepEqual(boot(null, true), { preference: 'system', theme: 'dark', color: '#171b1a' });
});

test('stored explicit preferences override the system appearance', () => {
  assert.equal(boot('"dark"', false).theme, 'dark');
  assert.equal(boot('"light"', true).theme, 'light');
  assert.equal(boot('"system"', true).theme, 'dark');
});

test('invalid or inaccessible storage falls back to system appearance', () => {
  for (const value of ['invalid JSON', '"unknown"', '{}', '42']) assert.equal(boot(value, true).preference, 'system');
  assert.equal(boot(null, true, true).theme, 'dark');
});
