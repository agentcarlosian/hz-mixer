import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const source = html.match(/<script id="theme-bootstrap">([\s\S]*?)<\/script>/)[1];
const script = new Script(source, { filename: 'theme-bootstrap' });
function boot(stored, systemDark, blocked = false, legacy = null) {
  const dataset = {};
  const meta = {};
  script.runInNewContext({
    localStorage: { getItem: (key) => { if (blocked) throw new Error('Unavailable'); return key === 'hz-mixer.theme.v2' ? stored : legacy; } },
    window: { matchMedia: () => ({ matches: systemDark }) },
    document: { documentElement: { dataset }, querySelector: () => meta },
  });
  return { preference: dataset.themePreference, theme: dataset.theme, scheme: dataset.colorScheme, color: meta.content };
}

test('an unset theme follows the system before the page paints', () => {
  assert.deepEqual(boot(null, false), { preference: 'system', theme: 'light', scheme: 'light', color: '#f5f7f6' });
  assert.deepEqual(boot(null, true), { preference: 'system', theme: 'dark', scheme: 'dark', color: '#08080b' });
});

test('stored explicit preferences override the system appearance', () => {
  for (const theme of ['light', 'green', 'dark', 'cyberpunk', 'matrix']) {
    assert.equal(boot(JSON.stringify(theme), false).theme, theme);
    assert.equal(boot(JSON.stringify(theme), true).theme, theme);
  }
  assert.equal(boot('"system"', true).theme, 'dark');
});

test('legacy dark selections migrate to Green while new Dark remains black-purple', () => {
  assert.deepEqual(boot(null, false, false, '"dark"'), { preference: 'green', theme: 'green', scheme: 'dark', color: '#171b1a' });
  assert.equal(boot(null, true, false, '"light"').theme, 'light');
  assert.equal(boot(null, true, false, '"system"').theme, 'dark');
  assert.equal(boot('"dark"', false, false, '"dark"').color, '#08080b');
  assert.equal(boot('"matrix"', false, false, '"dark"').theme, 'matrix');
});

test('theme choices and browser chrome colors agree with the pre-paint registry', () => {
  const colors = { light: '#f5f7f6', green: '#171b1a', dark: '#08080b', cyberpunk: '#090a0e', matrix: '#030705' };
  const selector = html.match(/<select id="theme-mode">([\s\S]*?)<\/select>/)[1];
  assert.deepEqual([...selector.matchAll(/value="([^"]+)"/g)].map((match) => match[1]), ['system', 'dark', 'light', 'green', 'cyberpunk', 'matrix']);
  assert(selector.includes('<option value="cyberpunk">Blue</option>'), 'Blue keeps the existing stored theme ID');
  assert(!selector.includes('>Cyberpunk<'));
  for (const [theme, color] of Object.entries(colors)) assert.equal(boot(JSON.stringify(theme), false).color, color);
});

test('invalid or inaccessible storage falls back to system appearance', () => {
  for (const value of ['invalid JSON', '"unknown"', '{}', '42', '["dark"]', 'null', '"__proto__"']) assert.equal(boot(value, true).preference, 'system');
  assert.equal(boot(null, true, true).theme, 'dark');
});
