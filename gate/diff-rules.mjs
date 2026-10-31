import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { contentRules, LIMITS, pathRule, secretRules } from './rules.mjs';

const { values } = parseArgs({
  options: { repo: { type: 'string', default: '.' }, base: { type: 'string' }, head: { type: 'string' }, out: { type: 'string' } },
});

const git = (...args) =>
  execFileSync('git', ['-C', values.repo, '-c', 'core.hooksPath=/dev/null', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const rules = [];
const secrets = [];

// --no-renames so a rename shows as a delete and an add, and both sides get checked.
const raw = git('diff', '--raw', '--no-renames', '--no-abbrev', '-z', values.base, values.head).split('\0').filter(Boolean);
const changes = [];
for (let i = 0; i < raw.length; i += 2) {
  // Each entry is ":oldmode newmode oldsha newsha status", then the path.
  const [, newMode, , , status] = (raw[i] ?? '').split(/\s+/);
  changes.push({ path: raw[i + 1], newMode, status });
}

if (changes.length === 0) rules.push('the diff is empty');
if (changes.length > LIMITS.files) rules.push(`too many files: ${changes.length} (limit ${LIMITS.files})`);

const numstat = git('diff', '--numstat', '--no-renames', '-z', values.base, values.head).split('\0').filter(Boolean);
let changedLines = 0;
for (const line of numstat) {
  const [added, removed, path] = line.split('\t');
  if (added === '-' || removed === '-') rules.push(`${path}: binary files are not allowed`);
  else changedLines += Number(added) + Number(removed);
}
if (changedLines > LIMITS.changedLines) rules.push(`too large: ${changedLines} changed lines (limit ${LIMITS.changedLines})`);

for (const { path, newMode, status } of changes) {
  const reason = pathRule(path);
  if (reason) rules.push(`${path}: ${reason}`);
  if (status === 'D') continue;
  if (newMode === '120000') rules.push(`${path}: symbolic links are not allowed`);
  if (newMode === '160000') rules.push(`${path}: submodules are not allowed`);
  if (newMode === '100755') rules.push(`${path}: executable files are not allowed`);
  // Anything that isn't a plain file fails, so a parsing surprise can't skip the content check.
  if (newMode !== '100644') {
    rules.push(`${path}: is not a plain file`);
    continue;
  }
  // The whole file, not only the added lines, so a change can't split a pattern across commits.
  const text = git('show', `${values.head}:${path}`);
  for (const hit of contentRules(text)) rules.push(`${path}: adds ${hit}`);
}

const diff = git('diff', '--no-renames', '--unified=0', values.base, values.head);
for (const hit of secretRules(diff)) secrets.push(`the diff contains ${hit}`);

// Commit messages reach the public repo as well.
const messages = git('log', '--format=%B', `${values.base}..${values.head}`);
for (const hit of secretRules(messages)) secrets.push(`a commit message contains ${hit}`);

const report = { rules, secrets, files: changes.length, changedLines };
if (values.out) writeFileSync(values.out, JSON.stringify(report, null, 2));
for (const line of [...rules, ...secrets]) console.log(`FAIL ${line}`);
console.log(`${changes.length} files, ${changedLines} lines, ${rules.length + secrets.length} problems`);
process.exit(rules.length + secrets.length > 0 ? 1 : 0);
