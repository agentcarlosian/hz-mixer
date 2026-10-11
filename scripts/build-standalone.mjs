import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { SOUNDS } from '../src/mix-state.mjs';

const root = new URL('../', import.meta.url);
const read = async (path) => (await readFile(new URL(path, root), 'utf8')).replaceAll('\r\n', '\n');
const metadata = JSON.parse(await read('package.json'));
const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const escapeScript = (text) => text.replace(/<\/script/gi, '<\\/script');
function replaceOnce(text, expected, replacement) {
  if (text.split(expected).length !== 2) throw new Error('Expected one source marker: ' + expected);
  return text.replace(expected, () => replacement);
}

// Flatten only this allowlisted, dependency-ordered module graph.
const icons = {};
const modulePaths = ['src/mix-state.mjs', 'src/program.mjs', 'src/library.mjs', 'src/audio-graph.mjs', 'src/audio-engine.js', 'src/wav-export.mjs', 'src/app.js'];
for (const name of (await readdir(new URL('assets/icons/', root))).filter((name) => name.endsWith('.svg')).sort()) {
  icons[name.slice(0, -4)] = 'data:image/svg+xml;base64,' + (await readFile(new URL('assets/icons/' + name, root))).toString('base64');
}
const audioBlocks = [];
for (const { id } of SOUNDS) {
  const bytes = await readFile(new URL('assets/audio/' + id + '.mp3', root));
  audioBlocks.push('<script type="audio/base64" id="embedded-audio-' + id + '">' + bytes.toString('base64') + '</script>');
}

const resources = `
const embeddedIcons = JSON.parse(document.getElementById('embedded-icons').textContent);
const embeddedAudio = new Map();
function iconUrl(name) {
  if (!embeddedIcons[name]) throw new Error('Missing embedded icon: ' + name);
  return embeddedIcons[name];
}
async function audioBytes(name) {
  if (embeddedAudio.has(name)) return embeddedAudio.get(name).slice(0);
  const block = document.getElementById('embedded-audio-' + name);
  if (!block) throw new Error('Missing embedded recording: ' + name);
  const binary = atob(block.textContent.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  embeddedAudio.set(name, bytes.buffer);
  block.textContent = '';
  return bytes.buffer.slice(0);
}
`;
const bundled = [resources];
for (const path of modulePaths) {
  let source = await read(path);
  source = source.replace(/^import \{[^\n]+\} from '\.\/([^']+)';\r?\n/gm, (statement, dependency) => {
    if (dependency !== 'resources.js' && !modulePaths.includes('src/' + dependency)) throw new Error('Unexpected dependency: ' + dependency);
    return '';
  });
  source = source.replace(/^export (const|function|async function|class) /gm, '$1 ');
  if (/^\s*(?:import|export)\b/m.test(source)) throw new Error('Unsupported module syntax in ' + path);
  bundled.push(source);
}
bundled.push(`
document.getElementById('recording-credits').addEventListener('click', (event) => {
  event.preventDefault();
  document.getElementById('credits-dialog').showModal();
});
`);
const javascript = escapeScript("(() => {\n'use strict';\n" + bundled.join('\n\n') + '\n})();');
new Script(javascript, { filename: 'Hz Mixer.html (inline script)' });

const codeLicense = metadata.license === 'UNLICENSED' ? 'Original source licensing is not yet selected. Do not distribute this build.' : await read('LICENSE');
const credits = '<dialog id="credits-dialog" class="credits-dialog"><form method="dialog"><h2>Credits and licences</h2><button class="button secondary">Close</button></form><p>Hz Mixer ' + escapeHtml(metadata.version) + '</p><details><summary>Source licence</summary><pre>' + escapeHtml(codeLicense) + '</pre></details><h3>Recordings</h3><pre>' + escapeHtml(await read('assets/audio/SOURCES.md')) + '</pre><details><summary>Icon licences</summary><pre>' + escapeHtml(await read('assets/icons/LICENSE')) + '</pre></details></dialog>';
const css = await read('styles.css') + '\n.credits-dialog { width: min(760px, calc(100% - 32px)); max-height: 85vh; overflow: auto; }\n.credits-dialog form { display: flex; align-items: center; justify-content: space-between; gap: 16px; }\n.credits-dialog form h2 { margin: 0; }\n.credits-dialog pre { white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.6 "Segoe UI", Arial, sans-serif; }\n.credits-dialog summary { cursor: pointer; font-weight: 600; }\n';
let html = await read('index.html');
html = replaceOnce(html, '<meta name="application-version" content="development" />', '<meta name="application-version" content="' + escapeHtml(metadata.version) + '" />');
html = replaceOnce(html, '<link rel="stylesheet" href="./styles.css" />', '<style>' + css + '</style>');
html = html.replace(/src="\.\/assets\/icons\/([a-z0-9-]+)\.svg"/g, (_, name) => {
  if (!icons[name]) throw new Error('Missing static icon: ' + name);
  return 'src="' + icons[name] + '"';
});
html = replaceOnce(html, '<a href="./assets/audio/SOURCES.md" target="_blank" rel="noopener">Recording credits</a>', '<a href="#credits-dialog" id="recording-credits">Recording credits</a>');
const embedded = credits + '\n<script type="application/json" id="embedded-icons">' + JSON.stringify(icons) + '</script>\n' + audioBlocks.join('\n') + '\n<script>\n' + javascript + '\n</script>';
html = replaceOnce(html, '<script type="module" src="./src/app.js"></script>', embedded);
if (/(?:src|href)=["']\.\//.test(html)) throw new Error('A companion-file reference remains in the standalone build');
const destination = new URL('Hz Mixer.html', root);
await writeFile(destination, html, 'utf8');
console.log(JSON.stringify({ file: fileURLToPath(destination), bytes: Buffer.byteLength(html), sha256: createHash('sha256').update(html).digest('hex'), recordings: SOUNDS.length, icons: Object.keys(icons).length }, null, 2));
