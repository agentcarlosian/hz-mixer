import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { SOUNDS } from '../src/mix-state.mjs';
import { guideMarkup } from './guide-lib.mjs';
import { root, read, metadata, modulePaths, iconNames, creditsMarkup, creditsListener, stampVersion, replaceOnce } from './build-lib.mjs';

const escapeScript = (text) => text.replace(/<\/script/gi, '<\\/script');
export async function renderStandaloneHtml() {
  const icons = {};
  for (const name of iconNames) icons[name] = 'data:image/svg+xml;base64,' + (await readFile(new URL('assets/icons/' + name + '.svg', root))).toString('base64');
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
  async function loadMp3Encoder() { return globalThis.lamejs.Mp3Encoder; }
  `;
  const bundled = [resources];
  for (const path of modulePaths) {
    let source = await read(path);
    source = source.replace(/^import \{[^\n]+\} from '\.\/([^']+)';\n/gm, (statement, dependency) => {
      if (dependency !== 'resources.js' && !modulePaths.includes('src/' + dependency)) throw new Error('Unexpected dependency: ' + dependency);
      return '';
    });
    source = source.replace(/^export (?=const|function|async function|class)/gm, '');
    if (/^\s*(?:import|export)\b/m.test(source)) throw new Error('Unsupported module syntax in ' + path);
    bundled.push(source);
  }
  bundled.push(creditsListener);
  const javascript = escapeScript("(() => {\n'use strict';\n" + bundled.join('\n\n') + '\n})();');
  new Script(javascript, { filename: 'Hz Mixer.html (inline app)' });
  // Preserve the LGPL library as an independently replaceable, byte-exact script.
  const encoder = await readFile(new URL('vendor/lamejs/lamejs.iife.js', root), 'utf8');
  if (/<\/script/i.test(encoder)) throw new Error('Encoder cannot safely be embedded without changing it.');
  new Script(encoder, { filename: 'mp3-encoder' });
  let html = stampVersion(await read('index.html'));
  html = replaceOnce(html, '<!-- embedded-guide -->', await guideMarkup(true));
  html = replaceOnce(html, 'href="./guide.html" target="_blank" rel="noopener"', 'href="#guide"');
  html = replaceOnce(html, '<link rel="stylesheet" href="./styles.css" />', '<style>' + await read('styles.css') + '</style>');
  html = html.replace(/(src|href)="\.\/assets\/icons\/([a-z0-9-]+)\.svg"/g, (_, attribute, name) => {
    if (!icons[name]) throw new Error('Missing static icon: ' + name);
    return attribute + '="' + icons[name] + '"';
  });
  const embedded = await creditsMarkup(true) + '\n<script type="application/json" id="embedded-icons">' + JSON.stringify(icons) + '</script>\n' + audioBlocks.join('\n') + '\n<script id="mp3-encoder">' + encoder + '</script>\n<script>\n' + javascript + '\n</script>';
  html = replaceOnce(html, '<script type="module" src="./src/app.js"></script>', embedded);
  if (/(?:src|href)=["']\.\//.test(html)) throw new Error('A companion-file reference remains in the standalone build');
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const html = await renderStandaloneHtml(), destination = new URL('Hz Mixer.html', root);
  await writeFile(destination, html, 'utf8');
  console.log(JSON.stringify({ file: fileURLToPath(destination), bytes: Buffer.byteLength(html), sha256: createHash('sha256').update(html).digest('hex'), version: metadata.version, recordings: SOUNDS.length, icons: iconNames.length }, null, 2));
}
