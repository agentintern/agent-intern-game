import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { playSession } from './play.mjs';
import { serveDist } from './static-server.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { seconds: { type: 'string', default: '60' }, out: { type: 'string', default: 'screens' }, name: { type: 'string', default: 'after' } },
});
const dist = positionals[0] ?? 'dist';
const seconds = Number(values.seconds);

// Well below 60 means this: a mid-range phone at 4x CPU throttle must still hold about 45 fps.
const MIN_FPS = { desktop: 45, phone: 45 };
const THROTTLE = { desktop: 1, phone: 4 };

mkdirSync(values.out, { recursive: true });
const server = await serveDist(dist);
const browser = await chromium.launch();
const problems = [];
const metrics = [];

for (const name of ['desktop', 'phone']) {
  const result = await playSession(browser, server.url, {
    name,
    seconds,
    throttle: THROTTLE[name],
    screenshot: name === 'desktop' ? join(values.out, `${values.name}.png`) : join(values.out, `${values.name}-phone.png`),
  });
  metrics.push(result.metrics);
  console.log(JSON.stringify(result.metrics));
  for (const problem of result.problems) problems.push(`${name}: ${problem}`);
  if (result.metrics.medianFps < MIN_FPS[name]) {
    problems.push(`${name}: ${result.metrics.medianFps} fps, the floor is ${MIN_FPS[name]}`);
  }
}

await browser.close();
await server.close();
writeFileSync(join(values.out, 'browser.json'), JSON.stringify({ metrics, problems }, null, 2));
for (const problem of problems) console.log(`FAIL ${problem}`);
console.log(`${problems.length} problems in ${seconds} s on each screen`);
process.exit(problems.length ? 1 : 0);
