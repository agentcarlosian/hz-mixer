import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { read } from '../scripts/build-lib.mjs';
import { renderGuideContent, guideMarkup, guidePage } from '../scripts/guide-lib.mjs';
import { releaseFiles } from '../scripts/release-lib.mjs';

test('the same complete guide is rendered in the web page and embedded portable view', async () => {
  const source = await read('docs/mixer-guide.md');
  const { content, headings } = renderGuideContent(source);
  assert(headings.length >= 16);
  assert.equal(new Set(headings.map((heading) => heading.id)).size, headings.length);
  const web = await guidePage(), portable = await read('Hz Mixer.html'), app = await read('_site/index.html');
  assert(web.includes(content)); assert(portable.includes(content)); assert(app.includes(content));
  for (const html of [web, portable, app]) assert(!/reading or studying|less alert|activity takes concentration/i.test(html));
  for (const html of [web, portable, app]) assert(!/take listening breaks/i.test(html));
  assert(app.includes('id="guide-link" class="button primary" href="#guide"'));
  assert(portable.includes('<main id="guide-page" class="guide-shell" aria-labelledby="guide-title" hidden>'));
  assert(portable.includes('id="guide-link" class="button primary" href="#guide"'));
  assert(!portable.includes('href="./guide.html"'));
  for (const { id } of headings) {
    assert(web.includes('href="#' + id + '"'));
    assert(web.includes('id="' + id + '" tabindex="-1"'));
  }
  assert((await guideMarkup()).includes('href="./index.html"'));
  assert((await guideMarkup(true)).includes('href="#mixer"'));
  assert(!web.includes('audio-engine.js'), 'Reading the standalone web guide does not initialize an audio engine.');
  for (const [, script] of web.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new Script(script));
});

test('the build-only guide renderer rejects executable markup and unsafe links', () => {
  for (const extra of ['<script>alert(1)</script>', '[unsafe](javascript:alert)', '[unsafe](data:text/html,unsafe)', '![remote](https://example.com/image.png)']) {
    assert.throws(() => renderGuideContent('# Guide\n\n## Section\n\n' + extra));
  }
  assert.throws(() => renderGuideContent('# Guide\n\n## Duplicate\n\n## Duplicate'), /Duplicate guide heading/);
  const safe = renderGuideContent('# Guide\n\n## Section\n\n`<script>`\n\n[WHO](https://www.who.int/)');
  assert(safe.content.includes('&lt;script&gt;'));
  assert(safe.content.includes('rel="noopener noreferrer"'));
});

test('listening safety and information are present without the removed footer claim', async () => {
  for (const path of ['index.html', 'README.md', 'docs/mixer-guide.md', 'docs/release-readme.txt', 'docs/releases/v0.1.0.md']) {
    const text = await read(path);
    const normalized = text.replace(/\s+/g, ' ');
    assert(/sitting or lying down/.test(text), path);
    assert(/driving, operating machinery/.test(normalized), path);
    assert(normalized.includes('reduced alertness or altered awareness could cause injury'), path);
    assert(!/reading or studying|less alert|activity takes concentration/i.test(normalized), path);
    assert(!/full attention/i.test(text), path);
    assert(!/take listening breaks/i.test(normalized), path);
    assert(!text.includes('not a guaranteed mental state'), path);
  }
  const html = await read('index.html');
  assert(html.indexOf('aria-label="Listening safety"') < html.indexOf('id="play-button"'));
  assert(html.includes('id="info-dialog" class="info-dialog" aria-labelledby="info-heading"'));
  const readme = await read('README.md');
  assert(!readme.includes('## Use Online'));
  assert(!readme.includes('This address is not a live-app claim'));
});

test('private diagnostics stay outside release allowlists and the ignore boundary remains explicit', async () => {
  assert((await read('.gitignore')).split('\n').includes('output/'));
  assert(releaseFiles.every((path) => !/output|investigation|diagnostic|plan\.md/i.test(path)));
});
