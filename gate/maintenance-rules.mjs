import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { secretRules } from './rules.mjs';

// The rules for a shift/maintenance-* branch. The gate skips those branches, because they never deploy.
// Game code only changes through a shift, so a maintenance diff fails if it touches any of it.
const GAME_CODE = /^(src\/|tests\/|public\/|GAME\.md$)/;

// Hashes these files are meant to hold. A bare hash anywhere else still fails the secret scan.
const withoutKnownHashes = (text) => text
  .replace(/\buses:\s+[\w./-]+@[a-f0-9]{40}\b/g, 'uses: pinned')
  .replace(/"integrity":\s+"sha\d+-[A-Za-z0-9+/=]+"/g, '"integrity": "hash"');

const { values } = parseArgs({
  options: { repo: { type: 'string', default: '.' }, base: { type: 'string' }, head: { type: 'string' } },
});

const git = (...args) =>
  execFileSync('git', ['-C', values.repo, '-c', 'core.hooksPath=/dev/null', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const problems = [];
const base = git('merge-base', values.base, values.head).trim();

// --no-renames so a rename shows as a delete and an add, and both sides get checked.
const paths = git('diff', '--name-only', '--no-renames', '-z', base, values.head).split('\0').filter(Boolean);
if (paths.length === 0) problems.push('the diff is empty');
for (const path of paths) {
  if (GAME_CODE.test(path)) problems.push(`${path}: game code only changes through a shift`);
}

const diff = git('diff', '--no-renames', '--unified=0', base, values.head);
for (const hit of secretRules(withoutKnownHashes(diff))) problems.push(`the diff contains ${hit}`);

// Commit messages reach the public repo as well.
const messages = git('log', '--format=%B', `${base}..${values.head}`);
for (const hit of secretRules(messages)) problems.push(`a commit message contains ${hit}`);

for (const line of problems) console.log(`FAIL ${line}`);
console.log(`${paths.length} files, ${problems.length} problems`);
process.exit(problems.length > 0 ? 1 : 0);
