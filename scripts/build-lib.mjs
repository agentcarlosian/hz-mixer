import { readFile } from 'node:fs/promises';
import { SOUNDS, NOISES } from '../src/mix-state.mjs';

export const root = new URL('../', import.meta.url);
export const read = async (path) => (await readFile(new URL(path, root), 'utf8')).replaceAll('\r\n', '\n');
export const metadata = JSON.parse(await read('package.json'));
export const modulePaths = ['src/mix-state.mjs', 'src/program.mjs', 'src/library.mjs', 'src/audio-graph.mjs', 'src/audio-engine.js', 'src/wav-export.mjs', 'src/mp3-export.mjs', 'src/matrix-rain.mjs', 'src/guide.js', 'src/app.js'];
export const iconNames = [...new Set(['mixer-waves', 'save', 'trash', 'rotate-ccw', 'star', 'download', 'upload', 'play', 'pause', 'square', 'volume-2', 'volume-x', 'headphones', 'plus', 'arrow-up', 'arrow-down', 'info', 'triangle-alert', 'book-open', 'arrow-left', ...SOUNDS.map((s) => s.icon), ...NOISES.map((s) => s.icon)])].sort();
export const vendorFiles = ['lamejs.iife.js', 'LICENSE', 'COPYING', 'COPYING.LESSER', 'source.tar.gz', 'README.md'].map((name) => 'vendor/lamejs/' + name);
export const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export function replaceOnce(text, expected, replacement) {
  if (text.split(expected).length !== 2) throw new Error('Expected one source marker: ' + expected);
  return text.replace(expected, () => replacement);
}
export async function creditsMarkup(portable = false) {
  const source = portable ? 'data:application/gzip;base64,' + (await readFile(new URL('vendor/lamejs/source.tar.gz', root))).toString('base64') : './vendor/lamejs/source.tar.gz';
  const section = async (title, path) => '<details><summary>' + title + '</summary><pre>' + escapeHtml(await read(path)) + '</pre></details>';
  return '<dialog id="credits-dialog" class="credits-dialog" aria-labelledby="credits-heading"><form method="dialog"><h2 id="credits-heading">Credits and licences</h2><button class="button secondary">Close</button></form><p>Hz Mixer ' + escapeHtml(metadata.version) + '</p>'
    + await section('Original source: MIT', 'LICENSE')
    + await section('Recordings: CC0', 'assets/audio/SOURCES.md')
    + await section('Icons and artwork', 'assets/icons/SOURCES.md')
    + await section('Icon licences', 'assets/icons/LICENSE')
    + '<h3>MP3 encoder: lamejs 1.2.7 / LGPL-3.0</h3><p>Unmodified LAME JavaScript port by Alex Zhukov and contributors. <a href="https://lame.sourceforge.net/" target="_blank" rel="noopener">LAME project</a>. You may modify and replace the encoder; its separate script is not part of the MIT licence.</p><p><a download="lamejs-1.2.7-source.tar.gz" href="' + source + '">Download exact upstream encoder source</a></p>'
    + await section('Encoder notice and replacement instructions', 'vendor/lamejs/README.md')
    + await section('Original LAME notice', 'vendor/lamejs/LICENSE')
    + await section('GNU LGPL version 3', 'vendor/lamejs/COPYING.LESSER')
    + await section('GNU GPL version 3', 'vendor/lamejs/COPYING') + '</dialog>';
}
export const creditsListener = "document.getElementById('recording-credits').addEventListener('click', () => document.getElementById('credits-dialog').showModal());";
export function stampVersion(html) {
  return replaceOnce(html, '<meta name="application-version" content="development" />', '<meta name="application-version" content="' + metadata.version + '" />');
}
