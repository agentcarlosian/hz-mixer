import { mkdir, readFile, writeFile, rm, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import { SOUNDS } from '../src/mix-state.mjs';
import { root, read, metadata, modulePaths, iconNames, vendorFiles, creditsMarkup, creditsListener, stampVersion, replaceOnce } from './build-lib.mjs';

const destination = new URL('_site/', root);
if (fileURLToPath(destination) !== resolve(fileURLToPath(root), '_site') + sep) throw new Error('Invalid web output directory.');
// Only remove this fixed build directory; never follow a substituted junction.
try { if ((await lstat(destination)).isSymbolicLink()) throw new Error('_site must not be a link.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await rm(destination, { recursive: true, force: true });
const files = ['styles.css', ...modulePaths, 'src/resources.js', ...iconNames.map((name) => 'assets/icons/' + name + '.svg'), ...SOUNDS.map(({ id }) => 'assets/audio/' + id + '.mp3'), 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'assets/audio/SOURCES.md', 'assets/icons/SOURCES.md', 'assets/icons/LICENSE', ...vendorFiles];
for (const path of files) {
  const target = new URL(path, destination);
  await mkdir(new URL('./', target), { recursive: true });
  const bytes = /\.(?:js|mjs|css|md)$/.test(path) && !path.startsWith('vendor/') ? await read(path) : await readFile(new URL(path, root));
  await writeFile(target, bytes);
}
const html = replaceOnce(stampVersion(await read('index.html')), '<script type="module" src="./src/app.js"></script>', await creditsMarkup() + '\n<script type="module" src="./src/app.js"></script>\n<script type="module">' + creditsListener + '</script>');
await writeFile(new URL('index.html', destination), html);
await writeFile(new URL('.nojekyll', destination), '');
console.log(JSON.stringify({ site: fileURLToPath(destination), version: metadata.version, files: files.length + 2, homepageBytes: Buffer.byteLength(html), deployment: 'not performed' }));
