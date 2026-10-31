// Drives a real browser through a real game. Used on the branch before it ships and again on the
// live site after it does.
export const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 } },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};

const FRAME_SAMPLER = `(() => {
  const deltas = [];
  let last = performance.now();
  const tick = (now) => { deltas.push(now - last); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  window.__frameDeltas = deltas;
})()`;

const CANVAS_SAMPLE = `(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const seen = new Set();
  let hash = 0;
  for (let i = 0; i < data.length; i += 4 * 37) {
    const pixel = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    seen.add(pixel);
    hash = (hash * 31 + pixel) | 0;
  }
  return { colors: seen.size, hash, width: canvas.width, height: canvas.height };
})()`;

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
}

async function mash(page, profile, seconds) {
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  const end = Date.now() + seconds * 1000;
  let i = 0;
  const box = profile.hasTouch ? profile.viewport : null;
  while (Date.now() < end) {
    const state = await page.evaluate(() => window.__intern.screen);
    if (state !== 'playing') {
      if (box) await page.touchscreen.tap(box.width / 2, box.height / 2);
      else await page.keyboard.press('Enter');
      await page.waitForTimeout(1100);
      continue;
    }
    if (box) {
      await page.touchscreen.tap(box.width - 58, box.height - 74);
      await page.waitForTimeout(700);
    } else {
      const key = keys[i++ % keys.length];
      await page.keyboard.down(key);
      await page.waitForTimeout(500);
      await page.keyboard.up(key);
      if (i % 4 === 0) await page.keyboard.press('Space');
    }
  }
}

export async function playSession(browser, url, { name, seconds, throttle = 1, screenshot }) {
  const profile = VIEWPORTS[name];
  const context = await browser.newContext(profile);
  const page = await context.newPage();
  const errors = [];
  const foreign = [];
  const origin = new URL(url).origin;

  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => errors.push(`page error: ${String(e).slice(0, 200)}`));
  page.on('request', (r) => {
    const target = r.url();
    if (!target.startsWith(origin) && !target.startsWith('data:')) foreign.push(target.slice(0, 120));
  });

  if (throttle > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }

  await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
  try {
    await page.waitForFunction(() => window.__intern?.frames > 5, null, { timeout: 15_000 });
  } catch {
    await context.close();
    return { metrics: { name, frames: 0, steps: 0, medianFps: 0, errors: errors.length, foreign: foreign.length }, problems: ['the game never started', ...errors] };
  }
  await page.evaluate(FRAME_SAMPLER);

  const titleShot = await page.evaluate(CANVAS_SAMPLE);
  if (profile.hasTouch) await page.touchscreen.tap(profile.viewport.width / 2, profile.viewport.height / 2);
  else await page.keyboard.press('Space');
  await page.waitForTimeout(400);

  const early = await page.evaluate(() => ({ ...window.__intern }));
  const first = await page.evaluate(CANVAS_SAMPLE);
  await mash(page, profile, seconds);
  const last = await page.evaluate(CANVAS_SAMPLE);
  const late = await page.evaluate(() => ({ ...window.__intern }));
  const deltas = await page.evaluate(() => window.__frameDeltas.slice(30));
  if (screenshot) await page.screenshot({ path: screenshot });
  await context.close();

  const sorted = [...deltas].sort((a, b) => a - b);
  const medianMs = percentile(sorted, 0.5);
  const metrics = {
    name,
    frames: late.frames - early.frames,
    steps: late.steps - early.steps,
    medianFps: medianMs ? Math.round(1000 / medianMs) : 0,
    p95Ms: Math.round(percentile(sorted, 0.95) * 10) / 10,
    colors: last.colors,
    errors: errors.length,
    foreign: foreign.length,
  };

  const problems = [...errors];
  if (foreign.length) problems.push(`the game tried to reach ${foreign[0]}`);
  if (titleShot.colors < 8 || first.colors < 8 || last.colors < 8) problems.push('the canvas is blank');
  if (first.hash === last.hash) problems.push('the canvas never changed');
  if (first.width < 200 || first.height < 150) problems.push('the canvas has the wrong size');
  if (metrics.frames < seconds * 20) problems.push(`the game loop stalled: ${metrics.frames} frames in ${seconds} s`);
  if (metrics.steps < seconds * 25) problems.push(`the simulation stalled: ${metrics.steps} steps in ${seconds} s`);
  return { metrics, problems };
}
