import { Marked } from 'marked';
import { read, metadata, escapeHtml } from './build-lib.mjs';

export function renderGuideContent(markdown) {
  const headings = [], ids = new Set();
  const parser = new Marked({ renderer: {
    heading({ text, tokens, depth }) {
      const id = depth === 1 ? 'guide-title' : 'guide-' + text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (ids.has(id)) throw new Error('Duplicate guide heading: ' + id);
      ids.add(id);
      if (depth === 2) headings.push({ id, text });
      return '<h' + depth + ' id="' + id + '" tabindex="-1">' + this.parser.parseInline(tokens) + '</h' + depth + '>\n';
    },
    html() { throw new Error('Raw HTML is not permitted in the guide Markdown.'); },
    image() { throw new Error('Guide images need an explicit offline embedding path.'); },
    link({ href, tokens }) {
      if (href.startsWith('#')) {
        const target = href.slice(1);
        return '<a href="#' + escapeHtml(target.startsWith('guide-') ? target : 'guide-' + target) + '">' + this.parser.parseInline(tokens) + '</a>';
      }
      if (new URL(href).protocol !== 'https:') throw new Error('Guide links must use HTTPS or a section anchor.');
      return '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + this.parser.parseInline(tokens) + '</a>';
    },
  } });
  const content = parser.parse(markdown);
  if (!ids.has('guide-title') || !headings.length) throw new Error('The guide needs a title and sections.');
  return { content, headings };
}

export async function guideMarkup(portable = false) {
  const { content, headings } = renderGuideContent(await read('docs/mixer-guide.md'));
  const back = portable ? '#mixer' : './index.html';
  return '<main id="guide-page" class="guide-shell" aria-labelledby="guide-title"' + (portable ? ' hidden' : '') + '>'
    + '<header class="guide-header"><a class="brand guide-brand" href="' + back + '"><span class="brand-mark"><img src="./assets/icons/mixer-waves.svg" alt="" /></span><span>Hz Mixer</span></a><a class="button secondary" href="' + back + '" title="Return to mixer"><img class="icon" src="./assets/icons/arrow-left.svg" alt="" />Mixer</a></header>'
    + '<div class="guide-layout"><nav class="guide-toc" aria-label="Guide sections"><h2>Contents</h2><ol>'
    + headings.map(({ id, text }) => '<li><a href="#' + id + '">' + escapeHtml(text) + '</a></li>').join('')
    + '</ol></nav><article class="guide-content">' + content + '</article></div>'
    + '<footer><span>Hz Mixer ' + escapeHtml(metadata.version) + '</span><a href="' + back + '">Return to mixer</a></footer></main>';
}

export async function guidePage() {
  const source = await read('index.html');
  const bootstrap = source.match(/<script id="theme-bootstrap">[\s\S]*?<\/script>/)?.[0];
  if (!bootstrap) throw new Error('Missing shared theme bootstrap.');
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="theme-color" content="#f5f7f6" /><meta name="application-version" content="' + metadata.version + '" /><meta name="description" content="The complete Hz Mixer guide: listening safety, audio controls, programs, mixing, backups and export." /><title>Hz Mixer Guide</title>'
    + bootstrap + '<link rel="icon" href="./assets/icons/mixer-waves.svg" /><link rel="stylesheet" href="./styles.css" /></head><body>' + await guideMarkup()
    + '<script id="guide-theme">const media = matchMedia("(prefers-color-scheme: dark)"); media.addEventListener("change", () => window.hzMixerTheme.apply(document.documentElement.dataset.themePreference, media.matches));</script></body></html>\n';
}
