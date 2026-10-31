import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

// npm test also leaves a small marker and a result file in .shift/, which the watcher outside
// the container reads to show test progress on the live page.
mkdirSync('.shift', { recursive: true });
writeFileSync('.shift/state.json', JSON.stringify({ state: 'testing' }));
const result = spawnSync(
  'npx',
  ['vitest', 'run', '--reporter=default', '--reporter=json', '--outputFile.json=.shift/test-results.json'],
  { stdio: 'inherit' },
);
writeFileSync('.shift/state.json', JSON.stringify({ state: 'tested', ok: result.status === 0 }));
process.exit(result.status ?? 1);
