// The rules every shift has to pass. They run from main, so the branch under test can't edit them.

// Allowlist: a shift may touch these and nothing else. Workflows, lockfiles, config, CLAUDE.md,
// .claude/, .mcp.json, the gate and the build scripts are all covered by not being on it.
const ALLOWED_PATH = /^(src\/[A-Za-z0-9_./-]+\.ts|tests\/[A-Za-z0-9_./-]+\.ts|GAME\.md)$/;
const PROTECTED_FILES = new Set(['src/ui/bridge.ts', 'src/version.ts']);

export const LIMITS = { files: 30, changedLines: 1200 };

export const NAMED_PATHS = [
  [/^\.github\//, 'touches a workflow'],
  [/(^|\/)package-lock\.json$|(^|\/)pnpm-lock\.yaml$|(^|\/)yarn\.lock$/, 'touches a lockfile'],
  [/(^|\/)package\.json$/, 'adds or changes a dependency'],
  [/^CLAUDE\.md$/, "touches the intern's instructions"],
  [/^\.claude\//, 'touches .claude/'],
  [/^\.mcp\.json$/, 'touches .mcp.json'],
  [/^(config|public|scripts|gate)\//, 'touches config or the gate'],
  [/(^|\/)(\.env|\.npmrc|id_rsa|id_ed25519)/, 'touches a secret file'],
];

export function pathRule(path) {
  if (path.split('/').includes('..')) return 'touches a file a shift may not change';
  for (const [pattern, reason] of NAMED_PATHS) {
    if (pattern.test(path)) return reason;
  }
  if (PROTECTED_FILES.has(path)) return 'touches the bridge to the parent page';
  if (!ALLOWED_PATH.test(path)) return 'touches a file a shift may not change';
  return null;
}

const CONTENT_RULES = [
  ['a network call', /\b(fetch|XMLHttpRequest|WebSocket|EventSource|WebTransport|RTCPeerConnection|RTCDataChannel|sendBeacon|importScripts)\b/],
  ['a service worker', /\b(serviceWorker|ServiceWorkerContainer|SharedWorker|Worker)\b/],
  ['dynamic code', /\beval\b|\bnew\s+Function\b|\bFunction\s*\(|\bWebAssembly\b|\bimport\s*\(|\brequire\s*\(|\bsetTimeout\s*\(\s*['"`]|\bsetInterval\s*\(\s*['"`]/],
  ['obfuscated code', /\batob\b|\bbtoa\b|fromCharCode|fromCodePoint|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\}|\\x[0-9a-fA-F]{2}|\bReflect\b|\bnew\s+Proxy\b|\.constructor\b|\[\s*['"`]constructor/],
  ['computed access to the page', /\b(window|globalThis|self|document|navigator|top|parent)\b[^;\n]{0,24}\[/],
  ['computed access to the page', /(=|\(|,|:)\s*(window|globalThis|self|document)\s*(;|,|\)|$)/m],
  ['computed access to the page', /\bas\s+any\b|:\s*any\b|<any>|\bas\s+unknown\b|\bObject\s*\.\s*(keys|entries|values|getOwnProperty\w*|defineProperty|assign)\s*\(\s*(window|globalThis|self|document|navigator)\b/],
  ['computed access to the page', /\[\s*(['"`])[^\]\n]*\1\s*\+|\+\s*(['"`])[^\]\n]*\2\s*\]/],
  ['access outside the frame', /\b(window\.parent|window\.top|window\.opener|window\.frames|parent\.|top\.|opener\b|frameElement|postMessage)\b/],
  ['an external URL', /https?:\/\/(?!www\.w3\.org\/)|(['"`])\/\/[a-z0-9-]+\.|\bwss?:\/\/|\bjavascript:|\bdata:text\/html|\bblob:/i],
  ['a script or frame tag', /<\s*\/?\s*(script|iframe|object|embed|link|meta|base|form)\b/i],
  ['HTML injection', /\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write|\.srcdoc\b|createContextualFragment|DOMParser/],
  ['a new element that loads things', /createElement\s*\(\s*['"`](script|iframe|object|embed|link|img|video|audio|source|form|a)\b/i],
  ['navigation', /\blocation\s*[.=]|window\.open\b|\bhistory\.(push|replace)State\b/],
  ['reading the page address', /\bdocument\s*\.\s*(URL|documentURI|baseURI|referrer)\b/],
  ['storage or cookies', /\b(localStorage|sessionStorage|indexedDB|cookieStore)\b|document\.cookie|\bcaches\b/],
  ['a wallet call', /\b(solana|phantom|solflare|backpack|ethereum|metamask|xnft|signMessage|signTransaction|signAllTransactions|sendTransaction|connectWallet|wallet)\b/i],
  ['device access', /\b(geolocation|mediaDevices|getUserMedia|clipboard|credentials|bluetooth|serial|usb|hid)\b/],
];

export function contentRules(text) {
  const hits = [];
  for (const [label, pattern] of CONTENT_RULES) {
    if (pattern.test(text)) hits.push(label);
  }
  return hits;
}

const SECRET_RULES = [
  ['an Anthropic key', /sk-ant-[A-Za-z0-9_-]{8,}/],
  ['an API key', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['a GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/],
  ['an AWS key', /\bAKIA[0-9A-Z]{16}\b/],
  ['a Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['a private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['a JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['a wallet secret key', /\b[1-9A-HJ-NP-Za-km-z]{80,90}\b/],
  ['a seed phrase', /\b(?:[a-z]{3,8}\s+){11}[a-z]{3,8}\b(?=.{0,40}(seed|mnemonic|phrase))/i],
  ['a long secret-looking value', /\b[a-f0-9]{40,}\b/i],
  ['a long secret-looking value', /\b[A-Za-z0-9+/_-]{44,}={0,2}(?![A-Za-z0-9])/],
];

export function secretRules(text) {
  const hits = new Set();
  for (const [label, pattern] of SECRET_RULES) {
    if (pattern.test(text)) hits.add(label);
  }
  return [...hits];
}

// The built bundle is checked as well, because minifying can bring back what a source check missed.
const BUNDLE_RULES = CONTENT_RULES.filter(([label]) =>
  ['a network call', 'a service worker', 'dynamic code', 'an external URL', 'a script or frame tag', 'HTML injection', 'storage or cookies', 'a wallet call', 'navigation'].includes(label),
);

export function bundleRules(text) {
  const hits = [];
  for (const [label, pattern] of BUNDLE_RULES) {
    if (pattern.test(text)) hits.push(label);
  }
  if ((text.match(/postMessage/g) ?? []).length !== 1) hits.push('postMessage must appear exactly once');
  return hits;
}
