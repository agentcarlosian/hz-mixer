import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { SOUNDS } from '../src/mix-state.mjs';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('Hz Mixer.html', root), 'utf8');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function script(id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp('<script[^>]*id="' + escaped + '"[^>]*>([\\s\\S]*?)<\\/script>'));
  assert(match, 'Embedded script block exists: ' + id);
  return match[1];
}

test('the standalone file contains exact copies of all four recordings', async () => {
  for (const { id } of SOUNDS) {
    const embedded = Buffer.from(script('embedded-audio-' + id), 'base64');
    const original = await readFile(new URL('assets/audio/' + id + '.mp3', root));
    assert.equal(embedded.length, original.length);
    assert.equal(hash(embedded), hash(original), id + ' bytes remain intact');
  }
});

test('all embedded icons retain their original bytes', async () => {
  const icons = JSON.parse(script('embedded-icons'));
  assert(Object.keys(icons).length >= 12);
  for (const [name, uri] of Object.entries(icons)) {
    assert(uri.startsWith('data:image/svg+xml;base64,'));
    const embedded = Buffer.from(uri.split(',')[1], 'base64');
    const original = await readFile(new URL('assets/icons/' + name + '.svg', root));
    assert.equal(hash(embedded), hash(original));
  }
});

test('the page has no companion-file or automatically loaded network dependencies', () => {
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  assert(!/(?:src|href)=["']\.\//.test(markup));
  assert(!/<script[^>]*\bsrc\s*=/.test(html));
  assert(!/<link[^>]*rel="stylesheet"/.test(markup));
  assert(!/url\(\s*["']?(?:https?:|\.\/)/.test(markup));
  for (const match of markup.matchAll(/<img[^>]*\bsrc="([^"]+)"/g)) assert(match[1].startsWith('data:image/'));
});

test('the bundled classic script compiles without module loading or network APIs', () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  const code = scripts[0][1];
  assert(!/^\s*(?:import|export)\b/m.test(code));
  assert(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(code));
  assert(!code.includes('./assets/'));
  assert.doesNotThrow(() => new Script(code));
  assert.doesNotThrow(() => new Script(script('mp3-encoder')));
  assert.doesNotThrow(() => new Script(script('theme-bootstrap')));
  assert(html.includes('id="theme-mode"'));
});

test('recording credits and full icon licence notices travel inside the file', async () => {
  const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  for (const path of ['assets/audio/SOURCES.md', 'assets/icons/LICENSE', 'vendor/lamejs/COPYING', 'vendor/lamejs/COPYING.LESSER', 'vendor/lamejs/README.md']) {
    assert(html.includes(escape((await readFile(new URL(path, root), 'utf8')).replaceAll('\r\n', '\n'))));
  }
  assert(html.includes('id="credits-dialog"'));
});

test('the replaceable encoder and its downloadable source are embedded byte-exact', async () => {
  assert.equal(script('mp3-encoder'), await readFile(new URL('vendor/lamejs/lamejs.iife.js', root), 'utf8'));
  const source = html.match(/download="lamejs-1.2.7-source.tar.gz" href="data:application\/gzip;base64,([^"]+)"/);
  assert(source);
  assert.deepEqual(Buffer.from(source[1], 'base64'), await readFile(new URL('vendor/lamejs/source.tar.gz', root)));
  for (const id of ['export-format', 'export-bitrate', 'privacy-dialog']) assert(html.includes('id="' + id + '"'));
});

test('the standalone controls expose the new precision and carrier limits', () => {
  for (const id of ['beat-value', 'beat-rate']) {
    const input = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'))[0];
    assert(input.includes('step="0.01"'));
  }
  for (const id of ['carrier-value', 'carrier']) {
    const input = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'))[0];
    assert(input.includes('min="20"'));
    assert(input.includes('max="2000"'));
  }
});

test('the standalone embeds every approved roadmap control and updated audio loader', () => {
  for (const id of ['band-filter', 'method-filter', 'favorites-only', 'favorite-mix', 'sweep-start', 'sweep-end', 'sweep-seconds', 'sweep-repeat', 'program-canvas', 'stage-list', 'add-stage', 'fade-in', 'fade-out', 'pulse-width', 'pulse-softness', 'pulse-depth', 'noise-list', 'export-dialog', 'import-dialog', 'export-progress', 'export-direct']) assert(html.includes('id="' + id + '"'), id);
  assert(html.includes('async function audioBytes(name)'));
  assert(!html.includes('function audioUrl('));
  assert(html.includes("'theta-783'"));
  assert(html.includes('class AudioEngine'));
  assert(html.includes('async function renderWav('));
});

test('the standalone uses Hz Mixer branding, version metadata and legacy storage compatibility', async () => {
  const metadata = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert(html.includes('<title>Hz Mixer</title>'));
  assert(html.includes('<h1>Hz Mixer</h1>'));
  assert(html.includes('<meta name="application-version" content="' + metadata.version + '" />'));
  assert(!html.includes('Beat Mixer'));
  for (const key of ['current', 'library', 'theme', 'favorites']) assert(html.includes('beat-mixer.' + key + '.v1'));
});

test('the simplified header and monitor-first organization survive packaging', () => {
  assert(!html.includes('Audio studio'));
  assert(!html.includes('>Rhythm<'));
  assert(!/0[123] \/ (?:Generator|Field recordings|Monitor)/.test(html));
  assert(html.includes('<h2 id="generator-heading">Generator</h2>'));
  assert(html.includes('<h2 id="monitor-heading">Monitor</h2>'));
  assert(html.indexOf('class="transport-bar"') < html.indexOf('class="output-panel"'));
  assert(html.indexOf('class="output-panel"') < html.indexOf('class="workspace"'));
  const icons = JSON.parse(script('embedded-icons'));
  for (const name of ['mixer-waves', ...SOUNDS.map((sound) => sound.icon)]) assert(icons[name]);
  assert(html.includes('<link rel="icon" href="' + icons['mixer-waves'] + '" />'));
  assert.equal(new Set(SOUNDS.map((sound) => sound.icon)).size, SOUNDS.length);
});
