import { chromium } from 'playwright';
import { playSession } from './play.mjs';

// After a deploy: is the live game actually the new one, and does it actually run? A failure here
// is what triggers the rollback.
const url = process.argv[2];
const version = process.argv[3];
const problems = [];

async function waitForVersion() {
  let seen = null;
  for (let i = 0; i < 24; i++) {
    try {
      const response = await fetch(`${url}/health.json?check=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        seen = (await response.json()).version;
        if (seen === version) return true;
      }
    } catch {
      seen = 'unreachable';
    }
    await new Promise((done) => setTimeout(done, 5000));
  }
  problems.push(`health.json says ${seen}, expected ${version}`);
  return false;
}

if (await waitForVersion()) {
  const browser = await chromium.launch();
  for (const name of ['desktop', 'phone']) {
    const result = await playSession(browser, url, { name, seconds: 15 });
    console.log(JSON.stringify(result.metrics));
    for (const problem of result.problems) problems.push(`${name}: ${problem}`);
  }
  await browser.close();
}

for (const problem of problems) console.log(`FAIL ${problem}`);
console.log(problems.length ? `live check failed: ${problems[0]}` : 'live check passed');
process.exit(problems.length ? 1 : 0);
