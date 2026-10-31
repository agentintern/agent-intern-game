import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundleRules, secretRules } from './rules.mjs';

const dist = process.argv[2] ?? 'dist';
const expected = new Set(['_headers', 'game.js', 'health.json', 'index.html', 'style.css']);
const problems = [];

for (const entry of readdirSync(dist)) {
  if (!expected.has(entry)) problems.push(`unexpected file in the build: ${entry}`);
}
// The site origin is the target of the one postMessage, and the only URL allowed in the bundle.
const { siteOrigin } = JSON.parse(readFileSync('config/game.json', 'utf8'));
const bundle = readFileSync(join(dist, 'game.js'), 'utf8').replaceAll(siteOrigin, '');
for (const hit of bundleRules(bundle)) problems.push(`game.js: ${hit}`);
for (const hit of secretRules(bundle)) problems.push(`game.js: ${hit}`);

const html = readFileSync(join(dist, 'index.html'), 'utf8');
if ((html.match(/<script/g) ?? []).length !== 1 || !html.includes('<script src="game.js"></script>')) {
  problems.push('index.html: the script tag changed');
}
const headers = readFileSync(join(dist, '_headers'), 'utf8');
for (const directive of ["connect-src 'none'", "default-src 'none'", "script-src 'self'", 'frame-ancestors']) {
  if (!headers.includes(directive)) problems.push(`_headers: lost ${directive}`);
}

for (const problem of problems) console.log(`FAIL ${problem}`);
console.log(`${problems.length} problems in the build`);
process.exit(problems.length ? 1 : 0);
