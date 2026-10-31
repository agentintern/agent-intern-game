import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Runs from main, after everything else. It reads results as data and posts them to the one
// endpoint the gate's token can reach.
const { SITE_URL, GATE_TOKEN, RESULTS, RUN_URL, GITHUB_OUTPUT } = process.env;
const shiftId = Number(process.env.SHIFT);
const version = process.env.VERSION || undefined;
const commit = process.env.COMMIT || undefined;
const results = JSON.parse(RESULTS);
const artifacts = 'artifacts';

const result = (job) => results[job]?.result ?? 'skipped';

// One artifact lands straight in the folder and several land in named subfolders, so nothing here
// assumes which. Searching by file name works for both.
function find(name, dir = artifacts) {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (entry === name) return path;
    if (statSync(path).isDirectory()) {
      const nested = find(name, path);
      if (nested) return nested;
    }
  }
  return null;
}

function readJson(path) {
  try {
    return path ? JSON.parse(readFileSync(path, 'utf8')) : null;
  } catch {
    return null;
  }
}

async function post(path, init) {
  const response = await fetch(`${SITE_URL}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${GATE_TOKEN}`, ...init.headers },
  });
  if (!response.ok) console.log(`${path}: HTTP ${response.status}`);
  return response.ok ? response.json() : null;
}

const stage = (body) =>
  post('/api/gate/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ shiftId, runUrl: RUN_URL, ...body }),
  });

const rules = readJson(find('report.json'));
const browser = readJson(find('browser.json'));
const brief = (items) => (items ?? []).slice(0, 4).join('; ');

const passed = (job) => result(job) === 'success';
const stages = [];

const rulesFailed = (rules?.rules?.length ?? 0) > 0;
const secretsFailed = (rules?.secrets?.length ?? 0) > 0;
if (!rules && !passed('rules')) {
  stages.push({ stage: 'rules', status: 'fail', detail: 'the rules job did not finish' });
} else {
  stages.push({ stage: 'rules', status: rulesFailed ? 'fail' : 'pass', detail: brief(rules?.rules) });
  stages.push({ stage: 'secrets', status: secretsFailed ? 'fail' : 'pass', detail: brief(rules?.secrets) });
}

const job = (name, label, stageName, detail) => {
  const outcome = result(name);
  if (outcome === 'skipped' || outcome === 'cancelled') return;
  stages.push({ stage: stageName, status: outcome === 'success' ? 'pass' : 'fail', detail: outcome === 'success' ? '' : detail ?? `${label} failed` });
};

job('build', 'the build', 'build');
job('unit', 'unit tests', 'unit');
job('browser', 'the browser test', 'browser', brief(browser?.problems) || 'the browser test failed');
job('deploy', 'the deploy', 'ship');
job('verify', 'the live check', 'verify', 'the live game failed its health check');
if (result('rollback') !== 'skipped') {
  stages.push({
    stage: 'rollback',
    status: passed('rollback') ? 'pass' : 'fail',
    detail: passed('rollback') ? 'restored the last good version' : 'the rollback failed, a person has to look',
  });
}

const shipped = passed('verify') && passed('merge');
const failedStage = stages.find((s) => s.status === 'fail');
const finalStage = stages.at(-1);
if (shipped) finalStage.final = true;
else if (stages.some((s) => s.stage === 'rollback')) stages.find((s) => s.stage === 'rollback').final = true;
else (failedStage ?? finalStage).final = true;

let finalStatus = null;
for (const entry of stages) {
  if (entry.final) continue;
  await stage(entry);
}

if (shipped) {
  for (const kind of ['before', 'after']) {
    const path = find(`${kind}.png`);
    if (path) {
      await post(`/api/gate/shot/${shiftId}/${kind}`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: readFileSync(path) });
    }
  }
}

const last = stages.find((s) => s.final);
const response = await stage({ ...last, version: shipped ? version : undefined, commit: shipped ? commit : undefined });
finalStatus = response?.status ?? null;
console.log(`final: ${last.stage} ${last.status}, shift is ${finalStatus}`);

const over = ['failed', 'rolled-back'].includes(finalStatus);
if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `close=${over}\n`);
