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
  // Inspect real Three.js world-space bounding boxes without exposing debug APIs
  // in production JavaScript. Only this local test request is instrumented.
  await page.route('**/app.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const instrument = "\nwindow.__atlasGeometryProbe = {\n  inspect() {\n    const bounds = id => {\n      const box = new THREE.Box3().setFromObject(groups[id]);\n      return {min:box.min.toArray(), max:box.max.toArray(), meshes:groups[id].children.filter(o=>o.isMesh).length};\n    };\n    const plate = groups.aux.children.find(o=>o.isMesh\n      && Math.abs(o.geometry.parameters?.width - 1.54)<.0001\n      && Math.abs(o.geometry.parameters?.height - 1.44)<.0001);\n    if(!plate) throw new Error('Marshalling enclosure backplate missing');\n    return {\n      panel: {x:-2.44,y:2.32,z:1.76,width:plate.geometry.parameters.width,height:plate.geometry.parameters.height},\n      cooling: bounds('coolctrl'),\n      terminals: bounds('terminal'),\n      hingedDoor: groups.aux.children.some(o=>o.isGroup && Math.abs(o.rotation.y)>1.5),\n      totalParts: parts.length\n    };\n  },\n  focus() {\n    camera.position.set(-2.46,2.62,7.8);\n    controls.target.set(-2.46,2.35,1.95);\n    controls.update();\n  },\n  point(id) {\n    const target = groups[id].children.find(o=>o.isMesh && Math.abs(o.geometry.parameters?.width-.185)<.0001);\n    if(!target) throw new Error('clickable equipment mesh missing: '+id);\n    const v = target.getWorldPosition(new THREE.Vector3()).project(camera);\n    const rect=host.getBoundingClientRect();\n    return {x:rect.left+(v.x+1)*rect.width*.5,y:rect.top+(1-v.y)*rect.height*.5};\n  }\n};"
    await route.fulfill({ response, body: source + '\n' + instrument });
  });
  page.on('pageerror', e => errors.push(e.stack || String(e)));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForSelector('#viewport canvas', { timeout: 35000 });
  assert.equal(await page.locator('#parts button.part').count(), 41, 'parts list failed to initialize');
  assert.equal(await page.locator('#loading').count(), 0, 'WebGL renderer failed');
  const gl = await page.locator('#viewport canvas').evaluate(el => !!(el.getContext('webgl2') || el.getContext('webgl')));
  assert(gl, 'WebGL context unavailable');
  // The real, assembled geometry must place BOTH distinct assemblies inside
  // the marshalling enclosure, not outside on the tank wall.
  const physical = await page.evaluate(() => window.__atlasGeometryProbe.inspect());
  assert.equal(physical.totalParts, 41);
  assert(physical.hingedDoor, 'marshalling door should be visibly open');
  const left=physical.panel.x-physical.panel.width/2;
  const right=physical.panel.x+physical.panel.width/2;
  const bottom=physical.panel.y-physical.panel.height/2;
  const top=physical.panel.y+physical.panel.height/2;
  for(const [label,part] of [['cooling',physical.cooling],['terminal',physical.terminals]]) {
    assert(part.meshes>6, label+' lacks detailed selectable objects');
    assert(part.min[0]>=left-.01 && part.max[0]<=right+.01,label+' is outside cabinet horizontally: '+JSON.stringify(part));
    assert(part.min[1]>=bottom-.04 && part.max[1]<=top+.01,label+' is outside cabinet vertically: '+JSON.stringify(part));
    assert(part.min[2]>=physical.panel.z && part.max[2]<=2.18,label+' is not mounted behind the cabinet door: '+JSON.stringify(part));
  }
  assert(physical.cooling.max[0]<physical.terminals.min[0],
     'cooling controls and DIN terminal board must occupy distinct cabinet regions');
  await page.evaluate(() => window.__atlasGeometryProbe.focus());
  await page.waitForTimeout(250);
  await page.screenshot({ path:'marshalling-cabinet-smoke.png', fullPage:true });
  for(const [id,label] of [['coolctrl','تجهیزات کنترل خنک‌کاری'],['terminal','ترمینال‌ها']]) {
    const pt = await page.evaluate(id => window.__atlasGeometryProbe.point(id), id);
    await page.mouse.click(pt.x,pt.y);
    assert(await page.locator('#detail').evaluate(el=>el.open), '3D equipment click did not open detail: '+id);
    assert((await page.locator('#detailContent').innerText()).includes(label), '3D click selected wrong assembly: '+id);
    await page.locator('#close').click();
  }
  await page.evaluate(() => { window.__atlasGeometryProbe.focus = undefined; });
  await page.unroute('**/app.js');
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
  console.log('PASS: marshalling cabinet placement, 3D selection, 41 groups, 41 detail dialogs, Persian search, WebGL, x-ray, cutaway, opacity, exploded view, reset, offline PWA, iPhone emulation.');
} finally {
  await browser.close();
}
