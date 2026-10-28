import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';
import {parts} from '../data.js';

// Run the production geometry and update function without a WebGL renderer.
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8')
  .split('function select(id)')[0]
  .replace(/^import .*;$/gm,'')
  .replace(/^let renderer;try.*$/m,'const renderer=null;');
const context={THREE,parts,document:{getElementById:()=>({})}};
vm.createContext(context);
vm.runInContext(source+`\nthis.probe={groups,meshes,splitMotion,set(t){explosion=t;update();scene.updateMatrixWorld(true);}};`,context);
const {probe}=context;
probe.set(0);
const rest=probe.meshes.map(o=>o.getWorldPosition(new THREE.Vector3()));
const box=o=>new THREE.Box3().setFromObject(o);
// Right-end placement must include every attached accessory and preserve both oil circuits.
for(const id of ['conservator','buchholz','breather','mog','bladder'])
  assert.equal(probe.groups[id].parent,probe.groups.conservator.parent,'accessory left behind: '+id);
for(const id of ['buchholz','breather','mog','bladder'])
  assert(box(probe.groups[id]).min.x>3.28,'accessory not on right tank end: '+id);
const vessel=probe.groups.conservator.children.find(o=>o.geometry?.parameters?.radiusTop===.48);
assert(box(vessel).min.x>3.28,'conservator overlaps tank footprint');
const tubes=id=>probe.groups[id].children.filter(o=>o.geometry?.type==='TubeGeometry');
const endpoint=(o,n)=>o.localToWorld(o.geometry.parameters.path.points[n].clone());
const main=tubes('conservator')[0],oltc=tubes('osr')[0],outlet=tubes('osr')[1];
assert(endpoint(main,0).distanceTo(new THREE.Vector3(2.9,4.05,.6))<1e-8,'main pipe detached from cover');
assert(endpoint(oltc,0).distanceTo(new THREE.Vector3(2.72,4.2,0))<1e-8,'OLTC pipe detached from head');
assert(endpoint(outlet,3).distanceTo(new THREE.Vector3(4.15,5.65,-2.38))<1e-8,'OLTC outlet misses isolated chamber');
const lower=probe.splitMotion.filter(p=>p.rest.y<1.3&&['clamps','wrings','insulation','lifting'].includes(p.mesh.userData.id));
const upper=probe.splitMotion.filter(p=>p.rest.y>3&&['core','clamps','wrings','insulation','tank'].includes(p.mesh.userData.id));
assert(lower.length>10&&upper.length>20,'missing paired support geometry');
for(let step=0;step<=100;step++){
  probe.set(step/100);
  const windings=['lowcoil','highcoil'].map(id=>box(probe.groups[id]));
  for(const p of lower)for(const coil of windings)
    assert(box(p.mesh).max.y<coil.min.y,`lower ${p.mesh.userData.id} enters winding at ${step}%`);
  for(const p of upper)for(const coil of windings)
    assert(box(p.mesh).min.y>coil.max.y,`upper ${p.mesh.userData.id} enters winding at ${step}%`);
  for(const id of ['lowcoil','highcoil'])for(const o of probe.groups[id].children){
    const i=probe.meshes.indexOf(o),v=o.getWorldPosition(new THREE.Vector3());
    assert(Math.abs(v.x-rest[i].x)<1e-9&&Math.abs(v.z-rest[i].z)<1e-9,'winding axis drifts');
  }
}
// Reverse slider movement and repeated resets must not accumulate offsets.
for(const t of [.8,.2,1,.45,0])probe.set(t);
probe.meshes.forEach((o,i)=>assert(o.getWorldPosition(new THREE.Vector3()).distanceTo(rest[i])<1e-9,'reset changed assembled geometry'));
console.log('PASS: lower/upper support clearance at 101 slider positions, fixed winding axes, exact reset');
