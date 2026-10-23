import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { parts } from '../data.js';

assert.equal(parts.length, 41, 'expected 41 selectable transformer groups');
assert.equal(new Set(parts.map(p => p.id)).size, 41, 'duplicate part identifiers');
for (const part of parts) {
  assert(part.id && part.fa && part.en && part.description && part.location && part.inspection && part.faults);
  assert([part.normal,part.diagnosis,part.response,part.record].every(v=>typeof v==='string'&&v.length>50), 'incomplete maintenance guidance: '+part.id);
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
    const instrument = "\nwindow.__atlasGeometryProbe = {\n  inspect() {\n    const bounds = id => {\n      const box = new THREE.Box3().setFromObject(groups[id]);\n      return {min:box.min.toArray(), max:box.max.toArray(), meshes:groups[id].children.filter(o=>o.isMesh).length};\n    };\n    const plate = groups.aux.children.find(o=>o.isMesh\n      && Math.abs(o.geometry.parameters?.width - 1.54)<.0001\n      && Math.abs(o.geometry.parameters?.height - 1.44)<.0001);\n    if(!plate) throw new Error('Marshalling enclosure backplate missing');\n    return {\n      panel: (()=>{const b=new THREE.Box3().setFromObject(plate);return {min:b.min.toArray(),max:b.max.toArray()};})(), cabinetAtEnd: groups.aux.parent===groups.coolctrl.parent && groups.coolctrl.parent===groups.terminal.parent && Math.abs(groups.aux.parent.position.x+3.62)<.01,\n      cooling: bounds('coolctrl'),\n      terminals: bounds('terminal'),\n      hingedDoor: groups.aux.children.some(o=>o.isGroup && Math.abs(o.rotation.y)>1.5),\n      totalParts: parts.length\n    };\n  },\n  focus() {\n    camera.position.set(-9,2.8,0);\n    controls.target.set(-3.65,2.32,0);\n    controls.update();\n  },\n  point(id) {\n    const target = groups[id].children.find(o=>o.isMesh && Math.abs(o.geometry.parameters?.width-.185)<.0001);\n    if(!target) throw new Error('clickable equipment mesh missing: '+id);\n    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); const v = target.getWorldPosition(new THREE.Vector3()).project(camera);\n    const rect=host.getBoundingClientRect();\n    return {x:rect.left+(v.x+1)*rect.width*.5,y:rect.top+(1-v.y)*rect.height*.5};\n  }\n};\nwindow.__atlasEngineeringProbe = {\n  gaugeBounds() {\n    const bounds = id => {\n      const b = new THREE.Box3().setFromObject(groups[id]);\n      return {min:b.min.toArray(),max:b.max.toArray(),count:groups[id].children.filter(o=>o.isMesh).length};\n    };\n    return {\n      oti:bounds('oti'), wti:bounds('wti'),\n      radiator:bounds('cooling'), tank:bounds('tank')\n    };\n  },\n  jansen() {\n    const bounds = id=>{\n      const b=new THREE.Box3().setFromObject(groups[id]);\n      return {min:b.min.toArray(),max:b.max.toArray()};\n    };\n    return {\n      relay:bounds('osr'),\n      buchholz:bounds('buchholz'),\n      sharedShell:groups.conservator.children.some(o=>o.isMesh && Math.abs(o.geometry.parameters?.radiusTop-.48)<.001 && o.position.y>5.5),\n      partition:groups.conservator.children.some(o=>o.isMesh && Math.abs(o.position.x-1.88)<.01 && o.position.y>5.5),\n      noDuplicateVessel:!groups.oltcoil.children.some(o=>o.isMesh && o.position.y>5.5 && o.position.x>3),\n      outletToSharedChamber:groups.osr.children.some(o=>o.isMesh && o.geometry.type==='TubeGeometry' && o.geometry.parameters.path.points.some(p=>Math.abs(p.x-2.28)<.02 && Math.abs(p.z+1.72)<.02)),\n      modelParts:parts.length,\n      name:parts.find(p=>p.id==='osr')?.fa,\n      location:parts.find(p=>p.id==='osr')?.location\n    };\n  },\n  xrayVisualState() {\n    const selection = id=>meshes.filter(o=>o.userData.id===id);\n    const front=selection('tank').filter(o=>o.position.z>1.5);\n    const rear=selection('tank').filter(o=>o.position.z< -1.5);\n    const radiators=selection('cooling');\n    const windings=selection('highcoil');\n    return {\n      frontHidden:front.length>1&&front.every(o=>!o.visible),\n      shellHidden:selection('tank').concat(selection('lid')).every(o=>!o.visible),\n      radiatorsVisible:radiators.length>100&&radiators.every(o=>o.visible),\n      windingsOpaque:windings.length>25&&windings.every(o=>o.visible&&!o.material.transparent),\n      coolingCount:radiators.length,\n      nearSkinCount:front.length,\n      wireVisible:selection('leads').some(o=>o.visible),\n      curtainOpacity:rear[0]?.material.opacity,\n      solidRestored:front.every(o=>o.visible)&&radiators.every(o=>o.visible),\n    };\n  },\n  endView(y=3.2,z=-.5) {\n    camera.position.set(10,5,0);\n    controls.target.set(3.32,y,z);\n    controls.update();\n  },\n  trace(pt) {\n    const el=document.elementFromPoint(pt.x,pt.y);\n    const first=hit({clientX:pt.x,clientY:pt.y});\n    return {pt, element:el?.tagName, elementId:el?.id,\n      elementClass:typeof el?.className==='string'?el.className:'',\n      hit:first?.object?.userData?.id, camera:camera.position.toArray(),\n      target:controls.target.toArray(), viewport:host.getBoundingClientRect().toJSON()};\n  },\n  point(id) {\n    const g=groups[id];\n    let target;\n    if(id==='oti'||id==='wti') target=g.children.find(o=>o.isMesh&&Math.abs(o.geometry.parameters?.radiusTop-.177)<.001);\n    else if(id==='osr') target=g.children.find(o=>o.isMesh&&Math.abs(o.geometry.parameters?.radiusTop-.16)<.001);\n    if(!target)throw new Error('Missing gauge/relay face: '+id);\n    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); const world=target.getWorldPosition(new THREE.Vector3());\n    if(id==='oti'||id==='wti')world.x+=.045;\n    const clip=world.project(camera);\n    const rect=host.getBoundingClientRect();\n    return {x:rect.left+(clip.x+1)*rect.width/2,y:rect.top+(1-clip.y)*rect.height/2};\n  }\n};\n";
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
  const footerLayout=await credit.evaluate(el=>({bottom:el.getBoundingClientRect().bottom,viewportHeight:window.innerHeight,doc:document.documentElement.scrollHeight}));
  assert(footerLayout.bottom>=footerLayout.viewportHeight-1,'credit should sit at the document end');
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
  // Instruments must sit clear of the radiator bank on the accessible +X tank end.
  const located = await page.evaluate(() => window.__atlasEngineeringProbe.gaugeBounds());
  assert(located.oti.max[0]>3.58 && located.wti.max[0]>3.58,
    'OTI/WTI dial faces must protrude beyond end-wall x=3.28: '+JSON.stringify(located));
  assert(located.oti.count>10 && located.wti.count>10, 'dial face or ticks missing');
  assert(located.oti.max[2] < located.wti.min[2],
    'OTI and WTI dial faces intersect');
  // Verify actual canvas raycast selection from the accessible tank end.
  await page.evaluate(()=>window.__atlasEngineeringProbe.endView());
  await page.waitForTimeout(300);
  for (const [id,label] of [['oti','نشانگر دمای روغن'],['wti','نشانگر دمای سیم‌پیچ']]) {
    const point=await page.evaluate(id=>window.__atlasEngineeringProbe.point(id),id);
    const trace=await page.evaluate(pt=>window.__atlasEngineeringProbe.trace(pt),point);
    console.log('GAUGE_RAYCAST',id,JSON.stringify(trace));
    await page.mouse.click(point.x,point.y);
    assert(await page.locator('#detail').evaluate(el=>el.open),'end-wall gauge not clickable: '+id+' '+JSON.stringify(trace));
    assert((await page.locator('#detailContent').innerText()).includes(label),'wrong dial selected: '+id);
    await page.locator('#close').click();
  }
  const jansen=await page.evaluate(()=>window.__atlasEngineeringProbe.jansen());
  assert(jansen.sharedShell&&jansen.partition&&jansen.noDuplicateVessel&&jansen.outletToSharedChamber,
    'Jansen line must terminate at partitioned chamber of ONE shared conservator: '+JSON.stringify(jansen));
  assert(jansen.name.includes('جانسون')&&jansen.location.includes('R')&&jansen.location.includes('همان بدنه'),
    'Jansen details must describe one conservator with an isolated OLTC chamber');
  assert(jansen.relay.min[0]>2.0 && jansen.relay.min[1]>4.1 && jansen.relay.max[0]>3.5,
    'Jansen assembly must run from OLTC head to shared conservator: '+JSON.stringify(jansen.relay));
  assert(Math.abs(jansen.relay.max[2]-jansen.buchholz.max[2])>.4,'Jansen relay tied to main Buchholz piping');
  await page.locator('#search').fill('جانسون');
  assert.equal(await page.locator('#parts button.part').count(),1,'Persian Jansen relay discovery');
  await page.locator('#search').fill('');
  await page.evaluate(()=>window.__atlasEngineeringProbe.endView(4.9,-.35));
  await page.waitForTimeout(250);
  const jpoint=await page.evaluate(()=>window.__atlasEngineeringProbe.point('osr'));
  await page.mouse.click(jpoint.x,jpoint.y);
  assert(await page.locator('#detail').evaluate(el=>el.open),'Jansen 3D relay not clickable');
  assert((await page.locator('#detailContent').innerText()).includes('جانسون'),'Jansen modal showed wrong part');
  await page.locator('#close').click();
  await page.screenshot({path:'end-wall-gauges-jansen.png',fullPage:true});
  // Regression: X-ray removes the full tank and cover, preserves other parts,
  // and restores the shell when returning to Solid mode.
  await page.locator('[data-mode="xray"]').click();
  const inspected=await page.evaluate(()=>window.__atlasEngineeringProbe.xrayVisualState());
  assert(inspected.frontHidden,'X-ray leaves the near-side metal tank wall visible');
  assert(inspected.radiatorsVisible,'X-ray must preserve the radiator assembly');
  assert(inspected.shellHidden,'X-ray must remove the entire tank and cover: '+JSON.stringify(inspected));
  assert(inspected.windingsOpaque&&inspected.wireVisible,'X-ray hides or fades winding/core internals');
  await page.screenshot({path:'xray-internals.png',fullPage:true});
  await page.locator('[data-mode="solid"]').click();
  const restored=await page.evaluate(()=>window.__atlasEngineeringProbe.xrayVisualState());
  assert(restored.solidRestored,'switching back to Solid does not restore radiator and tank geometry');
  // Test all 41 detail dialogs and return to the full parts list.
  for (let i = 0; i < 41; i++) {
    await page.locator('#parts button.part').nth(i).click();
    assert(await page.locator('#detail').evaluate(el => el.open), 'details not shown for component ' + i);
    const content=await page.locator('#detailContent').innerText();
    for(const field of ['normal','diagnosis','response','record'])assert(content.includes(parts[i][field]),'missing rendered '+field+' for '+parts[i].id);
    await page.locator('#close').click();
  }
  await page.locator('#search').fill('محرک موتوری');
  assert.equal(await page.locator('#parts button.part').count(), 1, 'Persian component search');
  await page.locator('#search').fill('');
  const canvas = page.locator('#viewport canvas');
  const assembled = await canvas.screenshot();
  await page.locator('[data-mode="xray"]').click();
  assert.equal(await page.locator('#modeLabel').innerText(), 'X-RAY VIEW');
  assert.equal(await page.locator('#opacityBox, #opacity').count(), 0, 'transparency control must be removed');
  await page.waitForTimeout(500);
  const xrayed = await canvas.screenshot();
  assert(!assembled.equals(xrayed), 'x-ray produced no visible change');
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
  console.log('PASS: marshalling cabinet placement, 3D selection, 41 groups, 41 detail dialogs, Persian search, WebGL, x-ray, cutaway, expanded maintenance content, exploded view, reset, offline PWA, iPhone emulation.');
} finally {
  await browser.close();
}

