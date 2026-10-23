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
    const instrument = "\nwindow.__atlasGeometryProbe = {\n  inspect() {\n    const bounds = id => {\n      const box = new THREE.Box3().setFromObject(groups[id]);\n      return {min:box.min.toArray(), max:box.max.toArray(), meshes:groups[id].children.filter(o=>o.isMesh).length};\n    };\n    const plate = groups.aux.children.find(o=>o.isMesh\n      && Math.abs(o.geometry.parameters?.width - 1.54)<.0001\n      && Math.abs(o.geometry.parameters?.height - 1.44)<.0001);\n    if(!plate) throw new Error('Marshalling enclosure backplate missing');\n    return {\n      panel: (()=>{const b=new THREE.Box3().setFromObject(plate);return {min:b.min.toArray(),max:b.max.toArray()};})(), cabinetAtEnd: groups.aux.parent===groups.coolctrl.parent && groups.coolctrl.parent===groups.terminal.parent && Math.abs(groups.aux.parent.position.x+3.62)<.01,\n      cooling: bounds('coolctrl'),\n      terminals: bounds('terminal'),\n      hingedDoor: groups.aux.children.some(o=>o.isGroup && Math.abs(o.rotation.y)>1.5),\n      totalParts: parts.length\n    };\n  },\n  focus() {\n    camera.position.set(-9,2.8,0);\n    controls.target.set(-3.65,2.32,0);\n    controls.update();\n  },\n  point(id) {\n    const target = groups[id].children.find(o=>o.isMesh && Math.abs(o.geometry.parameters?.width-.185)<.0001);\n    if(!target) throw new Error('clickable equipment mesh missing: '+id);\n    const v = target.getWorldPosition(new THREE.Vector3()).project(camera);\n    const rect=host.getBoundingClientRect();\n    return {x:rect.left+(v.x+1)*rect.width*.5,y:rect.top+(1-v.y)*rect.height*.5};\n  }\n};"
    await route.fulfill({ response, body: source + '\n' + instrument });
  });
  page.on('pageerror', e => errors.push(e.stack || String(e)));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForSelector('#viewport canvas', { timeout: 35000 });
  assert.equal(await page.locator('#parts button.part').count(), 41, 'parts list failed to initialize');
  const credit = page.locator('footer.site-credit');
  assert.equal(await credit.count(),1,'project credit footer missing');
  assert((await credit.innerText()).includes('سید حمیدرضا ملک نیا'),'credit name mismatch');
  assert((await credit.innerText()).includes('طراحی و توسعه'),'credit attribution missing');
  const footerLayout=await credit.evaluate(el=>({bottom:el.getBoundingClientRect().bottom,doc:document.documentElement.scrollHeight}));
  assert(footerLayout.bottom>=window.innerHeight-1,'credit should sit at the document end');
  assert.equal(await page.locator('#loading').count(), 0, 'WebGL renderer failed');
  const gl = await page.locator('#viewport canvas').evaluate(el => !!(el.getContext('webgl2') || el.getContext('webgl')));
  assert(gl, 'WebGL context unavailable');
  // The real, assembled geometry must place BOTH distinct assemblies inside
  // the marshalling enclosure, not outside on the tank wall.
  const physical = await page.evaluate(() => window.__atlasGeometryProbe.inspect());
  assert.equal(physical.totalParts, 41);
  assert(physical.hingedDoor, 'marshalling door should be visibly open');
  assert(physical.cabinetAtEnd, 'cabinet must mount on accessible end face, not behind radiator bank');
  const panel=physical.panel;
  for(const [label,part] of [['cooling',physical.cooling],['terminal',physical.terminals]]) {
    assert(part.meshes>6, label+' lacks detailed selectable objects');
    assert(part.min[0]>=panel.min[0]-.45 && part.max[0]<=panel.max[0]+.02,
      label+' should be recessed into end-mounted cabinet: '+JSON.stringify(part));
    assert(part.min[1]>=panel.min[1]-.05 && part.max[1]<=panel.max[1]+.02,
      label+' falls outside cabinet vertically: '+JSON.stringify(part));
    assert(part.min[2]>=panel.min[2]-.02 && part.max[2]<=panel.max[2]+.02,
      label+' falls outside cabinet along its width: '+JSON.stringify(part));
  }
  assert(physical.cooling.max[2]<physical.terminals.min[2]+.04,
     'cooling controls and terminal rail must occupy separate zones inside cabinet');
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
  assert.equal(await phone.locator('footer.site-credit').count(),1,'mobile footer missing');
  await phone.locator('footer.site-credit').scrollIntoViewIfNeeded();
  assert(await phone.locator('footer.site-credit').isVisible(),'credit is not visible at the end on mobile');
  assert((await phone.locator('footer.site-credit').innerText()).includes('سید حمیدرضا ملک نیا'),'mobile attribution mismatch');
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
