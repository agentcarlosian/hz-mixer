import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

test('freshness verification rejects runtime edits and modified/missing/extra web files', async () => {
  const base = resolve(tmpdir()), directory = await mkdtemp(join(base, 'hz-mixer-freshness-'));
  try {
    for (const path of ['src', 'scripts', 'assets', 'vendor', 'package.json', 'index.html', 'styles.css', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) await cp(fileURLToPath(new URL('../' + path, import.meta.url)), join(directory, path), { recursive: true });
    const run = (name) => execFileSync(process.execPath, ['scripts/' + name + '.mjs'], { cwd: directory, stdio: 'pipe' });
    run('build-web'); run('build-standalone'); run('verify-builds');
    const sourcePath = join(directory, 'src/app.js'), original = await readFile(sourcePath);
    await writeFile(sourcePath, Buffer.concat([original, Buffer.from('\n// Synthetic source change.\n')]));
    assert.throws(() => run('verify-builds'), /Portable HTML is stale/);
    await writeFile(sourcePath, original);
    const webPath = join(directory, '_site/styles.css'), styles = await readFile(webPath);
    await writeFile(webPath, 'body {}'); assert.throws(() => run('verify-builds'), /Web build differs/);
    await writeFile(webPath, styles);
    const extra = join(directory, '_site/unexpected.txt'); await writeFile(extra, 'not deployable');
    assert.throws(() => run('verify-builds'), /allowlist is stale/); await rm(extra);
    await rm(webPath); assert.throws(() => run('verify-builds'), /allowlist is stale/);
    await writeFile(webPath, styles); run('verify-builds');
  } finally {
    assert(directory.startsWith(base + sep) && directory !== base, 'Temporary cleanup must stay below the OS temp directory.');
    await rm(directory, { recursive: true, force: true });
  }
});
