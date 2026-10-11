import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('loopback preview serves source and blocks hidden/development paths and mutations', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../serve.mjs', import.meta.url)), '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const url = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => { child.kill(); reject(new Error('Preview startup timeout')); }, 10000);
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error('Preview exited: ' + code)); });
      child.stdout.on('data', (chunk) => { output += chunk; const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//); if (match) { clearTimeout(timer); resolve(match[0]); } });
    });
    assert((await (await fetch(url)).text()).includes('<title>Hz Mixer</title>'));
    for (const path of ['.git/config', '.env', '.github/workflows/ci.yml', 'node_modules/playwright/package.json', 'output/private.txt', 'dist/release-manifest.json', '%2e%2e%5coutside']) assert.equal((await fetch(url + path)).status, 403, path);
    assert.equal((await fetch(url, { method: 'POST' })).status, 405);
    const head = await fetch(url, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
    assert.equal((await fetch(url + 'unknown.txt')).status, 404);
  } finally {
    if (child.exitCode === null) { const closed = new Promise((resolve) => child.once('close', resolve)); child.kill(); await closed; }
  }
});
