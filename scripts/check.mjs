import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
for (const directory of ['src/', 'scripts/', 'tests/']) {
  for (const name of await readdir(new URL(directory, root))) if (/\.(?:mjs|js)$/.test(name)) execFileSync(process.execPath, ['--check', fileURLToPath(new URL(directory + name, root))], { stdio: 'inherit' });
}
execFileSync(process.execPath, ['--check', fileURLToPath(new URL('serve.mjs', root))], { stdio: 'inherit' });
const metadata = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
if (metadata.name !== 'hz-mixer' || !metadata.private || !/^\d+\.\d+\.\d+$/.test(metadata.version)) throw new Error('Project metadata does not describe the local Hz Mixer release.');
const html = await readFile(new URL('index.html', root), 'utf8');
if (!html.includes('<title>Hz Mixer</title>') || html.includes('Beat Mixer')) throw new Error('Source branding check failed.');
if (!['MIT', 'Apache-2.0', 'UNLICENSED'].includes(metadata.license)) throw new Error('Unexpected source licence.');
if (metadata.license !== 'UNLICENSED') await readFile(new URL('LICENSE', root));
await readFile(new URL('docs/releases/v' + metadata.version + '.md', root));
console.log('Source syntax, branding and release metadata checks passed.');
