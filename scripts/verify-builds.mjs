import assert from 'node:assert/strict';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root } from './build-lib.mjs';
import { renderWebEntries } from './build-web.mjs';
import { renderStandaloneHtml } from './build-standalone.mjs';

export async function verifyBuilds() {
  const portable = new URL('Hz Mixer.html', root), site = new URL('_site/', root);
  assert(!(await lstat(portable)).isSymbolicLink(), 'Portable HTML must not be a link.');
  assert((await readFile(portable)).equals(Buffer.from(await renderStandaloneHtml())), 'Portable HTML is stale. Run npm run build.');
  assert(!(await lstat(site)).isSymbolicLink(), 'Web build must not be a link.');
  const actual = {};
  async function walk(directory, prefix = '') {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      assert(!item.isSymbolicLink(), 'Web build must not contain links.');
      const path = prefix + item.name;
      if (item.isDirectory()) await walk(new URL(item.name + '/', directory), path + '/');
      else actual[path] = await readFile(new URL(item.name, directory));
    }
  }
  await walk(site);
  const expected = await renderWebEntries();
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), 'Web build allowlist is stale. Run npm run build.');
  for (const [path, bytes] of Object.entries(expected)) assert(actual[path].equals(bytes), 'Web build differs from current source: ' + path + '. Run npm run build.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyBuilds(); console.log('Web and portable outputs match the current source.');
}
