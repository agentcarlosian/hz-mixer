import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { posix } from 'node:path';
import { relativeLinkErrors } from '../scripts/links.mjs';
import { root, modulePaths, iconNames, vendorFiles, metadata } from '../scripts/build-lib.mjs';
import { RECORDINGS, recordingPath } from '../src/mix-state.mjs';

async function tree(directory, prefix = '') {
  const entries = {};
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw new Error('Unexpected link in build.');
    const path = prefix + item.name;
    if (item.isDirectory()) Object.assign(entries, await tree(new URL(item.name + '/', directory), path + '/'));
    else entries[path] = await readFile(new URL(item.name, directory));
  }
  return entries;
}
test('the web output has an exact deploy allowlist, version and lazy local assets', async () => {
  const entries = await tree(new URL('_site/', root));
  const expected = ['index.html', 'guide.html', '.nojekyll', 'styles.css', ...modulePaths, 'src/resources.js', ...iconNames.map((name) => 'assets/icons/' + name + '.svg'), ...RECORDINGS.map(({ id }) => recordingPath(id)), 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'assets/audio/SOURCES.md', 'assets/icons/SOURCES.md', 'assets/icons/LICENSE', ...vendorFiles];
  assert.deepEqual(Object.keys(entries).sort(), expected.sort());
  const html = entries['index.html'].toString();
  // The complete guide and licence notices are inline; audio and the encoder remain lazy.
  assert(Buffer.byteLength(html) < 160000);
  assert(html.includes('content="' + metadata.version + '"'));
  assert(!html.includes('audio/base64')); assert(!html.includes('data:application/gzip'));
  assert(!/<script[^>]*src="[^\"]*lamejs/.test(html));
  assert(html.includes('id="privacy-dialog"')); assert(html.includes('id="credits-dialog"'));
  for (const [, href] of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) assert(href.slice(2) in entries, href);
  for (const [, href] of entries['guide.html'].toString().matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) assert(href.slice(2) in entries, href);
  for (const path of [...modulePaths, 'src/resources.js']) {
    const source = entries[path].toString();
    for (const [, target] of source.matchAll(/from '(\.\/[^']+)'/g)) assert(posix.join(posix.dirname(path), target) in entries, path + ' -> ' + target);
  }
  for (const path of vendorFiles) assert.deepEqual(entries[path], await readFile(new URL(path, root)));
  assert.deepEqual(relativeLinkErrors(entries), []);
});
test('public source documentation links resolve and missing archive links fail validation', async () => {
  const paths = ['README.md', 'CONTRIBUTING.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE', 'docs/images/mixer-dark.png', 'docs/images/hz-mixer-banner.png', 'docs/images/SOURCES.md', 'docs/mixer-guide.md', 'docs/privacy.md', 'docs/release.md', 'docs/releases/v0.1.0.md', 'assets/audio/SOURCES.md', 'assets/icons/SOURCES.md', 'assets/icons/LICENSE', ...vendorFiles];
  const entries = {};
  for (const path of paths) entries[path] = await readFile(new URL(path, root));
  assert.deepEqual(relativeLinkErrors(entries), []);
  assert.equal(relativeLinkErrors({ 'NOTICE.md': Buffer.from('[credits](missing.md)') }).length, 1);
  assert.deepEqual(relativeLinkErrors({ 'NOTICE.md': Buffer.from('[credits](folder/a%20b.md)'), 'folder/a b.md': Buffer.from('ok') }), []);
});
