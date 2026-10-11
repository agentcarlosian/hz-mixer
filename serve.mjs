import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 5173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
  ".mp3": "audio/mpeg",
};

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }
  let target;
  try {
    const path = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    target = resolve(root, `.${path === "/" ? "/index.html" : path}`);
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (!target.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end();
    return;
  }
  const relative = target.slice(root.length + 1).split(sep);
  if (relative.some((part) => part.startsWith('.') || ['node_modules', 'output', 'dist'].includes(part))) {
    response.writeHead(403).end();
    return;
  }
  try {
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
  console.log(`Hz Mixer running at http://127.0.0.1:${server.address().port}/`);
});
