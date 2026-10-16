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
    for (const path of ['.git/config', '.env', '.github/workflows/ci.yml', 'node_modules/playwright/package.json', 'output/private.txt', 'dist/release-manifest.json', '%2e%2e%5coutside', 'NODE_MODULES/playwright/package.json', '%4eODE_MODULES/playwright/package.json', 'OUTPUT/browser/roadmap-evidence.json', 'DIST/release-manifest.json']) assert.equal((await fetch(url + path)).status, 403, path);
    if (process.platform === 'win32') {
      const { realpath } = await import('node:fs/promises');
      for (const path of ['NODE_M~1/playwright/package.json', 'GITHUB~1/workflows/ci.yml', 'GITIGN~1', 'node_modules::$INDEX_ALLOCATION/playwright/package.json', 'node_modules:$I30:$INDEX_ALLOCATION/playwright/package.json', 'NODE_M~1%5cplaywright%5cpackage.json']) {
        try { await realpath(new URL('../' + decodeURIComponent(path).replaceAll('\\', '/'), import.meta.url)); }
        catch (error) { if (['ENOENT', 'EINVAL'].includes(error.code)) continue; throw error; }
        assert.equal((await fetch(url + path)).status, 403, path);
      }
    }
    assert.equal((await fetch(url, { method: 'POST' })).status, 405);
    const head = await fetch(url, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
    assert.equal((await fetch(url + 'unknown.txt')).status, 404);
  } finally {
    if (child.exitCode === null) { const closed = new Promise((resolve) => child.once('close', resolve)); child.kill(); await closed; }
  }
});

test('built-site preview serves the project prefix and correct runtime MIME types', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../serve.mjs', import.meta.url)), '0', '--site', '--prefix'], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const url = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => { child.kill(); reject(new Error('Built preview startup timeout')); }, 10000);
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.stdout.on('data', (chunk) => { output += chunk; const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/hz-mixer\//); if (match) { clearTimeout(timer); resolve(match[0]); } });
    });
    for (const [path, type] of [['', 'text/html'], ['src/mp3-export.mjs','text/javascript'], ['styles.css','text/css'], ['assets/audio/stream.mp3','audio/mpeg'], ['vendor/lamejs/lamejs.iife.js','text/javascript'], ['vendor/lamejs/source.tar.gz','application/gzip']]) {
      const response = await fetch(url + path, { method: 'HEAD' }); assert.equal(response.status, 200, path); assert(response.headers.get('content-type').startsWith(type), path);
    }
    const origin = new URL(url).origin;
    for (const path of ['/src/app.js', '/index.html', '/.git/config', '/hz-mixer/package.json', '/hz-mixer/README.md', '/hz-mixer/Hz%20Mixer.html']) assert.notEqual((await fetch(origin + path)).status, 200, path);
    assert.equal((await fetch(url + 'index.html', { method: 'POST' })).status, 405);
  } finally {
    if (child.exitCode === null) { const closed = new Promise((resolve) => child.once('close', resolve)); child.kill(); await closed; }
  }
});
