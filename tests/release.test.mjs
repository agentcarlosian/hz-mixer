import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { zipSync, unzipSync } from 'fflate';
import { createReleaseArchive, validateReleaseArchive, releaseFiles } from '../scripts/release-lib.mjs';

const entries = () => Object.fromEntries(releaseFiles.map((name) => [name, Buffer.from('Synthetic release: ' + name + '\n')]));
test('release archives are allowlisted, checksummed and reproducible', () => {
  const first = createReleaseArchive(entries(), '0.1.0', 'MIT');
  const second = createReleaseArchive(entries(), '0.1.0', 'MIT');
  assert.deepEqual(first.zip, second.zip);
  assert.equal(validateReleaseArchive(first.zip, '0.1.0', 'MIT').manifest.product, 'Hz Mixer');
});
test('release packaging fails closed on unselected licensing, invalid versions or extra files', () => {
  assert.throws(() => createReleaseArchive(entries(), '0.1.0', 'UNLICENSED'), /licence/);
  assert.throws(() => createReleaseArchive(entries(), '../bad', 'MIT'), /version/);
  assert.throws(() => createReleaseArchive({ ...entries(), '.env': Buffer.from('secret') }, '0.1.0', 'MIT'), /allowlist/);
});
test('release validation rejects content changes, metadata mismatch and extra archive paths', () => {
  const archive = createReleaseArchive(entries(), '0.1.0', 'MIT').zip;
  assert.throws(() => validateReleaseArchive(archive, '0.2.0', 'MIT'), /metadata/);
  const changed = unzipSync(archive); changed['Hz Mixer.html'][0] ^= 1;
  assert.throws(() => validateReleaseArchive(zipSync(changed), '0.1.0', 'MIT'), /checksum/);
  const extra = unzipSync(archive); extra['../outside'] = Buffer.from('bad');
  assert.throws(() => validateReleaseArchive(zipSync(extra), '0.1.0', 'MIT'), /entries/);
});
test('package versions and lockfile are aligned; runtime stays dependency-free', async () => {
  const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url)));
  assert.equal(lock.name, metadata.name); assert.equal(lock.version, metadata.version);
  assert.deepEqual(lock.packages[''].devDependencies, metadata.devDependencies);
  assert.equal(lock.packages[''].license, metadata.license);
  assert.equal(metadata.dependencies, undefined); assert(metadata.private);
});

test('CI is validation-only, SHA-pinned and read-only', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert(workflow.includes('contents: read'));
  assert(workflow.includes('persist-credentials: false'));
  assert(!/contents:\s*write|pull_request_target|gh release|git push|npm publish|id-token:\s*write/.test(workflow));
  const actions = [...workflow.matchAll(/uses:\s*([^\s]+)@([^\s]+)/g)];
  assert.equal(actions.length, 3);
  assert(actions.every(([, name, ref]) => name.startsWith('actions/') && /^[a-f0-9]{40}$/.test(ref)));
});

test('original source licensing, when selected, travels inside the portable build', async () => {
  const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  const html = await readFile(new URL('../Hz Mixer.html', import.meta.url), 'utf8');
  if (metadata.license === 'UNLICENSED') { assert(html.includes('Do not distribute this build.')); return; }
  const licence = (await readFile(new URL('../LICENSE', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  assert(licence.length > 500); assert(html.includes(escape(licence)));
});
