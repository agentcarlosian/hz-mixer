import { mkdir, readFile, writeFile, rm, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import { SOUNDS } from '../src/mix-state.mjs';
import { guidePage, guideMarkup } from './guide-lib.mjs';
import { root, read, metadata, modulePaths, iconNames, vendorFiles, creditsMarkup, creditsListener, stampVersion, replaceOnce } from './build-lib.mjs';

export async function renderWebEntries() {
  const files = ['styles.css', ...modulePaths, 'src/resources.js', ...iconNames.map((name) => 'assets/icons/' + name + '.svg'), ...SOUNDS.map(({ id }) => 'assets/audio/' + id + '.mp3'), 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'assets/audio/SOURCES.md', 'assets/icons/SOURCES.md', 'assets/icons/LICENSE', ...vendorFiles];
  const entries = {};
  for (const path of files) entries[path] = Buffer.from(/\.(?:js|mjs|css|md)$/.test(path) && !path.startsWith('vendor/') ? await read(path) : await readFile(new URL(path, root)));
  let html = replaceOnce(stampVersion(await read('index.html')), '<script type="module" src="./src/app.js"></script>', await creditsMarkup() + '\n<script type="module" src="./src/app.js"></script>\n<script type="module">' + creditsListener + '</script>');
  html = replaceOnce(html, '<!-- embedded-guide -->', await guideMarkup(true));
  html = replaceOnce(html, 'href="./guide.html" target="_blank" rel="noopener"', 'href="#guide"');
  entries['index.html'] = Buffer.from(html); entries['.nojekyll'] = Buffer.alloc(0);
  entries['guide.html'] = Buffer.from(await guidePage());
  return entries;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entries = await renderWebEntries(), destination = new URL('_site/', root);
  if (fileURLToPath(destination) !== resolve(fileURLToPath(root), '_site') + sep) throw new Error('Invalid web output directory.');
  // Only remove this fixed build directory; never follow a substituted junction.
  try { if ((await lstat(destination)).isSymbolicLink()) throw new Error('_site must not be a link.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await rm(destination, { recursive: true, force: true });
  for (const [path, bytes] of Object.entries(entries)) {
    const target = new URL(path, destination);
    await mkdir(new URL('./', target), { recursive: true }); await writeFile(target, bytes);
  }
  console.log(JSON.stringify({ site: fileURLToPath(destination), version: metadata.version, files: Object.keys(entries).length, homepageBytes: entries['index.html'].length, deployment: 'not performed' }));
}
