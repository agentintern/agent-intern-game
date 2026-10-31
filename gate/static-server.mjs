import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
};

// Parses the same _headers file the host serves, so tests run under the production CSP.
function parseHeaders(text) {
  const headers = {};
  for (const line of text.split('\n')) {
    const match = line.match(/^\s+([A-Za-z-]+):\s*(.+)$/);
    if (match) headers[match[1]] = match[2].trim();
  }
  return headers;
}

export async function serveDist(dist, { port = 0, frameAncestors } = {}) {
  const root = resolve(dist);
  const headers = parseHeaders(await readFile(join(root, '_headers'), 'utf8'));
  if (frameAncestors && headers['Content-Security-Policy']) {
    headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace(
      /frame-ancestors [^;]+/,
      `frame-ancestors ${frameAncestors}`,
    );
  }
  const server = createServer(async (req, res) => {
    const path = normalize(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = resolve(root, path);
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { ...headers, 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, headers).end('not found');
    }
  });
  await new Promise((done) => server.listen(port, '127.0.0.1', done));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((done) => server.close(done)) };
}
