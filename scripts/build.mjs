import { build, context } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const serve = process.argv.includes('--serve');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const config = JSON.parse(await readFile('config/game.json', 'utf8'));

const version = process.env.GAME_VERSION || pkg.version;
const task = process.env.GAME_TASK || config.firstTask;
const siteOrigin = process.env.SITE_ORIGIN || config.siteOrigin;
const commit = process.env.GAME_COMMIT || 'local';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });

const headers = (await readFile('config/_headers', 'utf8')).replaceAll('__SITE_ORIGIN__', siteOrigin);
await writeFile('dist/_headers', headers);
await writeFile('dist/health.json', `${JSON.stringify({ ok: true, version, task, commit })}\n`);

const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: !serve,
  format: 'iife',
  target: 'es2021',
  outfile: 'dist/game.js',
  legalComments: 'none',
  define: {
    __GAME_VERSION__: JSON.stringify(version),
    __GAME_TASK__: JSON.stringify(task),
    __SITE_ORIGIN__: JSON.stringify(siteOrigin),
  },
};

if (!serve) {
  await build(options);
  console.log(`built v${version}`);
} else {
  const ctx = await context(options);
  await ctx.watch();
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  createServer(async (req, res) => {
    const path = normalize(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    try {
      const body = await readFile(join('dist', path));
      res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  }).listen(5180, () => console.log('http://localhost:5180'));
}
