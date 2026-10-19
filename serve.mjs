import { createServer } from "node:http";
import { readFile, stat, realpath } from "node:fs/promises";
import { dirname, extname, resolve, sep, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), process.argv.includes('--site') ? '_site' : '.'));
const port = Number(process.argv[2] || 5173);
const prefix = process.argv.includes('--prefix') ? '/hz-mixer/' : '/';
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".gz": "application/gzip",
  ".txt": "text/plain; charset=utf-8",
};

function blockedPath(target) {
  const path = relative(root, target);
  return !path || path === '..' || path.startsWith('..' + sep) || isAbsolute(path) || path.split(sep).some((part) => part.startsWith('.') || ['node_modules', 'output', 'dist'].includes(part.toLowerCase()));
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }
  let target;
  try {
    const path = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    if (!path.startsWith(prefix)) { response.writeHead(404).end(); return; }
    const mounted = '/' + path.slice(prefix.length);
    target = resolve(root, `.${mounted === "/" ? "/index.html" : mounted}`);
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (blockedPath(target)) {
    response.writeHead(403).end();
    return;
  }
  try {
    target = await realpath(target);
    if (blockedPath(target)) { response.writeHead(403).end(); return; }
    if (!(await stat(target)).isFile()) throw new Error("Not a file");
    const body = await readFile(target);
    response.writeHead(200, {
      "Content-Type": types[extname(target)] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Hz Mixer running at http://127.0.0.1:${server.address().port}${prefix}`);
});
