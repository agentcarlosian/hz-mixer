import { createHash } from 'node:crypto';
import { zipSync, unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';
import { vendorFiles } from './build-lib.mjs';

export const releaseFiles = ['Hz Mixer.html', 'README.txt', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'assets/audio/SOURCES.md', 'assets/icons/SOURCES.md', 'assets/icons/LICENSE', ...vendorFiles];
export const portableDownloadName = 'Hz-Mixer.html';
export async function releaseEntries(root) {
  const entries = {};
  for (const name of releaseFiles) {
    const path = name === 'README.txt' ? 'docs/release-readme.txt' : name;
    const bytes = await readFile(new URL(path, root));
    entries[name] = path.startsWith('vendor/') ? bytes : Buffer.from(normalizeText(bytes.toString('utf8')));
  }
  return entries;
}
export const archiveFiles = [...releaseFiles, 'release-manifest.json', 'SHA256SUMS.txt'];
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const normalizeText = (text) => text.replaceAll('\r\n', '\n');
export function checksums(entries) {
  return Object.entries(entries).map(([name, bytes]) => digest(bytes) + '  ' + name + '\n').join('');
}
export function createReleaseArchive(entries, version, license) {
  if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(version)) throw new Error('Invalid release version.');
  if (!['MIT', 'Apache-2.0'].includes(license)) throw new Error('Select an original-source licence before packaging a release.');
  if (Object.keys(entries).sort().join('|') !== [...releaseFiles].sort().join('|')) throw new Error('Release files do not match the allowlist.');
  const manifest = { product: 'Hz Mixer', version, license, files: releaseFiles.map((name) => ({ name, bytes: entries[name].byteLength, sha256: digest(entries[name]) })) };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  const contents = { ...entries, 'release-manifest.json': manifestBytes };
  contents['SHA256SUMS.txt'] = Buffer.from(checksums(contents));
  const input = Object.fromEntries(archiveFiles.map((name) => [name, [contents[name], { mtime: new Date(1980, 0, 1, 0, 0, 0), level: 6 }]]));
  return { zip: zipSync(input), manifest: manifestBytes };
}
export function validateReleaseArchive(zip, version, license) {
  const contents = unzipSync(zip);
  if (Object.keys(contents).sort().join('|') !== [...archiveFiles].sort().join('|')) throw new Error('Unexpected or missing archive entries.');
  const manifest = JSON.parse(Buffer.from(contents['release-manifest.json']).toString('utf8'));
  if (manifest.product !== 'Hz Mixer' || manifest.version !== version || manifest.license !== license || manifest.files?.length !== releaseFiles.length) throw new Error('Release metadata mismatch.');
  if (manifest.files.map((file) => file.name).join('|') !== releaseFiles.join('|')) throw new Error('Manifest file list mismatch.');
  for (const file of manifest.files) {
    const bytes = contents[file.name];
    if (file.bytes !== bytes.byteLength || file.sha256 !== digest(bytes)) throw new Error('Archive checksum mismatch: ' + file.name);
  }
  const hashed = Object.fromEntries([...releaseFiles, 'release-manifest.json'].map((name) => [name, contents[name]]));
  if (Buffer.from(contents['SHA256SUMS.txt']).toString('utf8') !== checksums(hashed)) throw new Error('Archive checksum list mismatch.');
  return { contents, manifest };
}
