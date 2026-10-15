import { posix } from 'node:path';

export function relativeLinkErrors(entries) {
  const errors = [];
  for (const [path, bytes] of Object.entries(entries)) {
    if (!path.endsWith('.md')) continue;
    const text = Buffer.from(bytes).toString('utf8');
    for (const [, raw] of text.matchAll(/\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      const href = raw.replace(/^<|>$/g, '');
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(href)) continue;
      let target;
      try { target = posix.normalize(posix.join(posix.dirname(path), decodeURIComponent(href.split(/[?#]/)[0]))); }
      catch { errors.push(path + ': invalid link ' + href); continue; }
      if (!(target in entries)) errors.push(path + ': missing ' + target);
    }
  }
  return errors;
}
