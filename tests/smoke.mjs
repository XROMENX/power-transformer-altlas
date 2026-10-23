import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { parts } from '../data.js';

assert.equal(parts.length, 41, 'expected 41 selectable transformer groups');
assert.equal(new Set(parts.map(p => p.id)).size, 41, 'duplicate part identifiers');
for (const part of parts) {
  assert(part.id && part.fa && part.en && part.description && part.location && part.inspection && part.faults);
  assert(Array.isArray(part.manual), 'missing reference explanation for ' + part.id);
}
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--enable-webgl', '--disable-dev-shm-usage']
});
const errors = [];
const url = 'http://127.0.0.1:8765/';
try {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.stack || String(e)));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForSelector('#viewport canvas', { timeout: 35000 });
  assert.equal(await page.locator('#parts button.part').count(), 41, 'parts list failed to initialize');
  assert.equal(await page.locator('#loading').count(), 0, 'WebGL renderer failed');
  const gl = await page.locator('#viewport canvas').evaluate(el => !!(el.getContext('webgl2') || el.getContext('webgl')));
  assert(gl, 'WebGL context unavailable');
  // Test all 41 detail dialogs and return to the full parts list.
  for (let i = 0; i < 41; i++) {
    await page.locator('#parts button.part').nth(i).click();
    assert(await page.locator('#detail').evaluate(el => el.open), 'details not shown for component ' + i);
    await page.locator('#close').click();
  }
  await page.locator('#search').fill('محرک موتوری');
  assert.equal(await page.locator('#parts button.part').count(), 1, 'Persian component search');
  await page.locator('#search').fill('');
  const canvas = page.locator('#viewport canvas');
  const assembled = await canvas.screenshot();
  await page.locator('[data-mode="xray"]').click();
  assert.equal(await page.locator('#modeLabel').innerText(), 'X-RAY VIEW');
  assert(await page.locator('#opacityBox').isVisible(), 'x-ray opacity control hidden');
  await page.waitForTimeout(500);
  const xrayed = await canvas.screenshot();
  assert(!assembled.equals(xrayed), 'x-ray produced no visible change');
  await page.locator('#opacity').evaluate(el => { el.value = '50'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  assert((await page.locator('#opacityValue').innerText()).includes('۵۰'), 'opacity not responding');
  await page.locator('[data-mode="cut"]').click();
  assert.equal(await page.locator('#modeLabel').innerText(), 'CUTAWAY VIEW');
  await page.locator('#explode').evaluate(el => { el.value = '65'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  assert((await page.locator('#explodeValue').innerText()).includes('۶۵'), 'exploded view not responding');
  await page.locator('#home').click();
  assert((await page.locator('#explodeValue').innerText()).includes('۰'), 'reset not responding');
  await page.locator('[data-mode="solid"]').click();
  await page.screenshot({ path: 'atlas-smoke.png', fullPage: true });
  // PWA offline reload must work using a fully installed service worker cache.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 30000 });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#viewport canvas', { timeout: 30000 });
  assert.equal(await page.locator('#parts button.part').count(), 41, 'offline PWA reload failed');
  await context.close();
  const mobile = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  const phone = await mobile.newPage();
  phone.on('pageerror', e => errors.push(e.stack || String(e)));
  await phone.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await phone.waitForSelector('#viewport canvas', { timeout: 30000 });
  assert.equal(await phone.locator('#parts button.part').count(), 41, 'mobile component listing');
  await phone.locator('#search').fill('شیلد');
  assert.equal(await phone.locator('#parts button.part').count(), 1, 'mobile search');
  await phone.locator('#parts button.part').click();
  assert(await phone.locator('#detail').evaluate(el => el.open), 'mobile part modal');
  await mobile.close();
  assert.deepEqual(errors, [], 'uncaught browser errors: ' + errors.join('\n'));
  console.log('PASS: 41 groups, 41 detail dialogs, Persian search, WebGL, x-ray, cutaway, opacity, exploded view, reset, offline PWA, iPhone emulation.');
} finally {
  await browser.close();
}
