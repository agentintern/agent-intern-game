import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

// Runs the installed vitest directly, because a test run must never download anything.
const VITEST = 'node_modules/.bin/vitest';

// npm test also leaves a small marker and a result file in .shift/, which the watcher outside
// the container reads to show test progress on the live page.
mkdirSync('.shift', { recursive: true });
writeFileSync('.shift/state.json', JSON.stringify({ state: 'testing' }));
if (!existsSync(VITEST)) {
  console.error('node_modules is missing. Run npm ci.');
  writeFileSync('.shift/state.json', JSON.stringify({ state: 'tested', ok: false }));
  process.exit(1);
}
const result = spawnSync(
  VITEST,
  ['run', '--reporter=default', '--reporter=json', '--outputFile.json=.shift/test-results.json'],
  { stdio: 'inherit' },
);
writeFileSync('.shift/state.json', JSON.stringify({ state: 'tested', ok: result.status === 0 }));
process.exit(result.status ?? 1);
