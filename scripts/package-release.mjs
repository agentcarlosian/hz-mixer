import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createReleaseArchive, checksums, normalizeText, releaseEntries, portableDownloadName } from './release-lib.mjs';

const root = new URL('../', import.meta.url);
const metadata = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
if (metadata.license === 'UNLICENSED') throw new Error('Original source licence selection is pending. No release archive was created.');
const entries = await releaseEntries(root);
const { zip, manifest } = createReleaseArchive(entries, metadata.version, metadata.license);
const archiveName = 'hz-mixer-' + metadata.version + '.zip';
const notes = Buffer.from(normalizeText(await readFile(new URL('docs/releases/v' + metadata.version + '.md', root), 'utf8')));
const files = { [archiveName]: zip, [portableDownloadName]: entries['Hz Mixer.html'], 'release-manifest.json': manifest, 'RELEASE_NOTES.md': notes };
await mkdir(new URL('dist/', root), { recursive: true });
for (const [name, bytes] of Object.entries(files)) await writeFile(new URL('dist/' + name, root), bytes);
await writeFile(new URL('dist/SHA256SUMS.txt', root), checksums(files));
console.log(JSON.stringify({ version: metadata.version, files: Object.entries(files).map(([name, bytes]) => ({ name, bytes: bytes.byteLength })), publication: 'not performed' }, null, 2));
