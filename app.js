import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {parts} from './data.js';
const $=id=>document.getElementById(id), fa=n=>Number(n).toLocaleString('fa-IR');
const host=$('viewport');
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch(e){$('loading').textContent='نمایش سه‌بعدی به WebGL نیاز دارد. مرورگر را به‌روزرسانی کنید؛ فهرست قطعات همچنان قابل استفاده است.';}
const cutPlane=new THREE.Plane(new THREE.Vector3(0,0,-1),0);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,150);camera.position.set(13,9,15);
const controls=renderer?new OrbitControls(camera,renderer.domElement):null;
if(renderer){renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setClearColor(0,0);renderer.localClippingEnabled=true;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;host.appendChild(renderer.domElement);$('loading').remove();controls.target.set(0,3,0);controls.enableDamping=true;controls.minDistance=6;controls.maxDistance=70;controls.maxPolarAngle=Math.PI;controls.autoRotateSpeed=.6;}
scene.add(new THREE.HemisphereLight(0xd9ece8,0x3b4b37,2.7));
function light(color,intensity,pos){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...pos);scene.add(l);return l;}
const key=light(0xfff1d4,3.8,[6,14,9]);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.5,far:45});key.shadow.bias=-.001;
light(0xa1cee1,2.7,[-10,6,-5]);light(0xe1eac4,2,[-3,10,10]);
const mat=(color,metalness=.3,roughness=.4)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const steel=mat('#7c9390',.65,.35),dark=mat('#344747',.6,.42),edge=mat('#a4b6ad',.7,.3),copper=mat('#c9874e',.78,.28),copper2=mat('#e4ad6b',.7,.32),ceramic=mat('#a9b5a4',.12,.32),paper=mat('#c4aa76',.05,.78),black=mat('#172522',.3,.6),silver=mat('#b8c8c2',.85,.25),blue=mat('#68acb2',.55,.28);
const groups={},meshes=[],shell=[],guides=[];let explosion=0,mode='solid',selected=null;
// Scale component travel without altering assembled (0%) positions.
const EXPLODE_SPREAD=2.25;
// X-ray hides complete exterior cooling assemblies, not just the tagged meshes.
const XRAY_HIDDEN_GROUPS=new Set(['tank','lid','cooling','headers','pumps','valves']);
const motion={tank:[0,-4,0],lid:[0,6.5,0],hv:[0,7.5,-.7],lv:[0,7,1.2],core:[0,-.7,0],lowcoil:[0,1.4,0],highcoil:[0,2.8,0],insulation:[0,2.1,0],leads:[0,6,0],cooling:[0,.25,0],conservator:[0,4,-.5],buchholz:[0,3,-.5],oltc:[3.5,.5,0],aux:[.8,0,3.5],breather:[-2,0,-2],prv:[1,4,1],oti:[1.3,1,-.7],wti:[1.3,1,.5],ct:[0,2.4,0],valves:[0,0,2],earth:[-1,0,1]};
Object.assign(motion,{"mog":[2,3,-1],"spr":[-2,3,1],"osr":[1.1,3,-.3],"drive":[4,0,1],"selector":[3,2,0],"oltcoil":[4,1,0],"bladder":[0,4,-2],"sample":[2,-1,2],"drain":[-2,-1,2],"neutral":[3,4,1],"headers":[0,0,3],"pumps":[3,-1,3],"coolctrl":[.45,.12,4.1],"terminal":[1.2,-.12,4.5],"coreearth":[-3,-1,0],"clamps":[0,2,0],"wrings":[0,3,0],"shields":[0,4,0],"lifting":[0,3,2],"plates":[2,0,3]});
parts.forEach(p=>{let g=new THREE.Group();g.userData.id=p.id;g.userData.manualVisible=true;g.userData.vector=new THREE.Vector3(...(motion[p.id]??[0,0,0]));groups[p.id]=g;scene.add(g);});
function mesh(geo,m,pos,g){const o=new THREE.Mesh(geo,m.clone());o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;g.add(o);o.userData.id=g.userData.id;meshes.push(o);if(['tank','lid'].includes(o.userData.id))shell.push(o);return o;}
function box(w,h,d,x,y,z,m,g){return mesh(new THREE.BoxGeometry(w,h,d),m,[x,y,z],g);}
function cyl(r,h,x,y,z,m,g,r2=r){return mesh(new THREE.CylinderGeometry(r2,r,h,40),m,[x,y,z],g);}
function torus(r,t,x,y,z,m,g){let o=mesh(new THREE.TorusGeometry(r,t,8,48),m,[x,y,z],g);o.rotation.x=Math.PI/2;return o;}
function pipe(points,r,m,g){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.15),32,r,10,false),m,[0,0,0],g);}
function bolts(w,d,y,g){for(let x=-w/2;x<=w/2;x+=.4)for(let z of [-d/2,d/2])cyl(.035,.06,x,y,z,silver,g);for(let z=-d/2;z<=d/2;z+=.4)for(let x of [-w/2,w/2])cyl(.035,.06,x,y,z,silver,g);}
// Hollow tank: six independent structural faces, never a solid box.
let g=groups.tank;box(6.9,.22,3.25,0,.68,0,dark,g);box(6.65,3.05,.1,0,2.28,-1.57,steel,g);box(6.65,3.05,.1,0,2.28,1.57,steel,g);box(.1,3.05,3.1,-3.28,2.28,0,steel,g);box(.1,3.05,3.1,3.28,2.28,0,steel,g);
for(let x=-3;x<=3;x+=.5){box(.075,2.9,.12,x,2.2,1.66,dark,g);box(.075,2.9,.12,x,2.2,-1.66,dark,g);}
for(let x of [-2.3,2.3]){box(.3,.4,4,x,.45,0,dark,g);for(let z of [-1.2,1.2]){let w=cyl(.23,.22,x,.22,z,black,g);w.rotation.z=Math.PI/2;}}
box(6.8,.12,3.35,0,3.84,0,edge,g);bolts(6.6,3.2,3.94,g);
g=groups.lid;box(6.8,.14,3.35,0,3.96,0,steel,g);bolts(6.6,3.2,4.07,g);for(let x of [-2.6,2.6]){torus(.15,.045,x,4.15,0,silver,g).rotation.x=0;}cyl(.3,.09,2.45,4.1,.75,silver,groups.prv);cyl(.16,.18,2.45,4.2,.75,dark,groups.prv);cyl(.25,.06,2.45,4.32,.75,copper,groups.prv);box(.04,.14,.04,2.45,4.43,.75,copper2,groups.prv);
// Laminated, three-limb core and visible upper/lower yokes.
g=groups.core;for(let z=-.38;z<.4;z+=.045){box(5.25,.48,.028,-.35,1.04,z,dark,g);box(5.25,.48,.028,-.35,3.42,z,dark,g);for(let x of [-2.1,-.35,1.4])box(.55,2.4,.028,x,2.2,z,edge,g);}for(let y of [1,3.48]){box(5.45,.13,.9,-.35,y,0,steel,g);for(let x of [-2.55,-1.5,-.35,.7,1.9])cyl(.055,.18,x,y+.1,.3,silver,g);}
// Nested, physically separate windings; annular discs allow core visibility.
function ring(outer,inner,height,x,y,z,m,g){const s=new THREE.Shape();s.absarc(0,0,outer,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);s.holes.push(hole);const geo=new THREE.ExtrudeGeometry(s,{depth:height,bevelEnabled:false,curveSegments:48});geo.rotateX(-Math.PI/2);return mesh(geo,m,[x,y,z],g);}
for(let x of [-2.1,-.35,1.4]){for(let i=0;i<26;i++){ring(.49,.36,.045,x,1.35+i*.069,0,copper2,groups.lowcoil);ring(.74,.60,.044,x,1.35+i*.069,0,copper,groups.highcoil);}for(let y of [1.27,3.16]){ring(.78,.34,.08,x,y,0,paper,groups.insulation);}for(let a=0;a<8;a++){let t=a*Math.PI/4;box(.06,1.86,.06,x+Math.sin(t)*.56,2.24,Math.cos(t)*.56,paper,groups.insulation);}for(let y of [1.5,2.2,2.9])ring(.585,.55,.025,x,y,0,paper,groups.insulation);
pipe([[x+.65,3.12,0],[x+.7,3.55,-.2],[x,3.7,-.9],[x,4.1,-.9]],.045,copper,groups.leads);pipe([[x+.43,3.1,.05],[x+.45,3.6,.55],[x,3.75,.9],[x,4.1,.9]],.055,paper,groups.leads);}
function bushing(x,z,h,g){cyl(.26,.15,x,4.1,z,silver,g);for(let a=0;a<6;a++){let t=a*Math.PI/3;cyl(.025,.08,x+Math.sin(t)*.21,4.2,z+Math.cos(t)*.21,silver,g);}cyl(.12,h,x,4.2+h/2,z,ceramic,g,.075);let n=Math.round(h/.115);for(let i=0;i<n;i++){let r=.21-.055*(i/n);cyl(r,.045,x,4.24+i*.115,z,ceramic,g,r*.75);}cyl(.06,.23,x,4.28+h,z,silver,g);box(.23,.06,.12,x,4.42+h,z,copper,g);torus(.26,.018,x,4.17+h,z,silver,g);}
for(let x of [-2.1,-.35,1.4]){bushing(x,-.9,1.8,groups.hv);bushing(x,.9,1.25,groups.lv);}
// Radiator banks with separate fins, headers, guard rings, and fan blades.
g=groups.cooling;for(let side of [-1,1]){let bank=new THREE.Group();bank.userData.id='cooling';bank.userData.offset=new THREE.Vector3(0,0,side*2.8);g.add(bank);for(let x=-2.75;x<2.8;x+=.19){box(.055,2.25,.72,x,2.17,side*2.25,steel,bank);box(.085,.09,.68,x,3.3,side*2.25,edge,bank);box(.085,.09,.68,x,1.03,side*2.25,edge,bank);}for(let y of [1.03,3.3]){pipe([[-2.8,y,side*2.25],[2.8,y,side*2.25]],.105,steel,bank);for(let x of [-2.7,2.7])pipe([[x,y,side*1.55],[x,y,side*2.25]],.095,steel,bank);}for(let x of [-1.9,0,1.9]){const fanStart=meshes.length;let z=side*2.73;let o=cyl(.48,.16,x,1.75,z,dark,bank);o.rotation.x=Math.PI/2;for(let rad of [.15,.28,.4,.49]){let q=torus(rad,.012,x,1.75,z+side*.11,silver,bank);q.rotation.x=0;}for(let a=0;a<8;a++){let blade=box(.035,.96,.02,x,1.75,z+side*.12,silver,bank);blade.rotation.z=a*Math.PI/4;}let hub=cyl(.12,.22,x,1.75,z,steel,bank);hub.rotation.x=Math.PI/2;for(let a=0;a<5;a++){let t=a*Math.PI*2/5;let b=box(.15,.29,.04,x+Math.sin(t)*.23,1.75+Math.cos(t)*.23,z,copper2,bank);b.rotation.z=-t+.5;}for(const fanMesh of meshes.slice(fanStart))fanMesh.userData.isFan=true;}}
// Conservator geometry uses a shared local frame, mounted at the right tank end below.
g=groups.conservator;let con=cyl(.48,4.9,-.1,5.65,-1.72,steel,g);con.rotation.z=Math.PI/2;for(let x of [-2.55,2.35]){let end=cyl(.49,.06,x,5.65,-1.72,edge,g);end.rotation.z=Math.PI/2;}
// A single conservator shell can contain two OIL-ISOLATED chambers. The OLTC
// compartment occupies the right end; no second external reservoir is drawn.
let separator=cyl(.46,.045,1.88,5.65,-1.72,dark,g);separator.rotation.z=Math.PI/2;
let chamberBand=torus(.49,.032,1.88,5.65,-1.72,copper,g);chamberBand.rotation.set(0,Math.PI/2,0);for(let x of [-1.8,1.6]){box(.12,1.4,.14,x,4.65,-1.72,dark,g);let t=torus(.49,.025,x,5.65,-1.72,silver,g);t.rotation.y=Math.PI/2;t.rotation.x=0;}let gauge=cyl(.17,.07,2.4,5.65,-1.72,black,g);gauge.rotation.z=Math.PI/2;// Main-oil inlet starts on the cover; the inclined run passes through Buchholz.
pipe([[-.7,4.05,-2.97],[1.5,4.65,-2.97],[2,4.8,-1.72],[-1.8,5.07,-1.72],[-1.8,5.19,-1.72]],.075,steel,g);
// Cantilever feet and diagonal braces carry the vessel back to the tank cover.
for(let x of [-1.8,1.6]){
  box(.32,.12,1.2,x,4.1,-2.22,dark,g);
  pipe([[x,4.16,-2.77],[x,5.13,-1.72]],.055,dark,g);
}
g=groups.buchholz;box(.45,.42,.28,.3,4.92,-1.72,blue,g);for(let x of [.04,.56]){let f=cyl(.19,.04,x,4.92,-1.72,silver,g);f.rotation.z=Math.PI/2;}let sight=cyl(.09,.03,.3,4.99,-1.56,black,g);sight.rotation.x=Math.PI/2;box(.65,.035,.5,.3,5.27,-1.72,steel,g);for(let x of [.05,.55])box(.02,.3,.02,x,5.12,-1.9,silver,g);cyl(.035,.12,.3,5.18,-1.72,copper,g);
for(let x of [-.5,1.1]){let v=cyl(.15,.18,x,4.94,-1.72,dark,g);v.rotation.z=Math.PI/2;cyl(.025,.22,x,5.1,-1.72,silver,g);torus(.12,.018,x,5.22,-1.72,dark,g);}
g=groups.oltc;cyl(.35,2.6,2.72,2.42,0,dark,g);for(let y of [1.2,2.2,3.5])torus(.36,.03,2.72,y,0,silver,g);cyl(.44,.14,2.72,4.12,0,steel,g);box(.7,.9,.35,3.55,2.2,.1,steel,g);box(.5,.65,.02,3.55,2.2,.29,dark,g);box(.25,.13,.025,3.55,2.4,.31,black,g);pipe([[2.72,4.2,0],[3.55,4.2,0],[3.55,2.7,0]],.035,silver,g);
// Tank-mounted marshalling enclosure. The hinged door is open to reveal the two
// distinct internal assemblies. Cooling control and terminals are NOT mounted
// separately on the exterior wall of the transformer.
g=groups.aux;
box(1.54,1.44,.065,-2.44,2.32,1.76,dark,g); // rear mounting plate
for(let x of [-3.19,-1.69])box(.055,1.42,.42,x,2.32,1.955,steel,g); // weatherproof side walls
for(let y of [1.60,3.04])box(1.55,.055,.42,-2.44,y,1.955,steel,g); // cabinet frame
box(1.70,.07,.50,-2.44,3.08,1.95,steel,g); // rain hood
for(let x of [-2.97,-2.62,-2.28,-1.94]){ // cable entry glands underneath
  cyl(.065,.10,x,1.52,1.98,dark,g);
  cyl(.045,.025,x,1.47,1.98,silver,g);
}
const marshallingDoor=new THREE.Group();
marshallingDoor.userData.id='aux';
marshallingDoor.position.set(-3.205,2.32,2.17);
marshallingDoor.rotation.y=-Math.PI*.61; // hinged outward: unobstructed internal equipment
g.add(marshallingDoor);
box(1.5,1.39,.055,.75,0,0,steel,marshallingDoor);
box(1.30,1.18,.018,.75,0,.037,dark,marshallingDoor);
box(.045,.18,.045,1.32,0,.067,silver,marshallingDoor);
for(let y of [-.58,.58])cyl(.045,.08,0,y,0,silver,marshallingDoor);
// OTI and WTI are accessible end-wall instruments, NOT hidden behind radiator banks.
// The dial faces are normal to +X, on the opposite end from the marshalling box.
function addTemperatureDial(id,z,index){
  const group=groups[id],x=3.48,y=3.25;
  const caseBody=cyl(.235,.115,x,y,z,dark,group);caseBody.rotation.z=Math.PI/2;
  const ringFace=cyl(.215,.045,x+.082,y,z,silver,group);ringFace.rotation.z=Math.PI/2;
  const dialFace=cyl(.177,.013,x+.115,y,z,paper,group);dialFace.rotation.z=Math.PI/2;
  const bezel=torus(.184,.016,x+.129,y,z,silver,group);bezel.rotation.set(0,Math.PI/2,0);
  for(let i=0;i<11;i++){
    const angle=(-.78+i*.156)*Math.PI;
    box(.013,.023,.015,x+.131,y+Math.sin(angle)*.14,z+Math.cos(angle)*.14,dark,group);
  }
  const needle=box(.015,.128,.014,x+.145,y+.043,z+.025,copper,group);
  needle.rotation.x=-.47;
  const hub=cyl(.023,.02,x+.155,y,z,blue,group);hub.rotation.z=Math.PI/2;
  box(.13,.18,.21,3.35,y,z,dark,group); // tank-end mounting bracket
  // Independent capillary probes travel up the end wall to oil-sensor pockets on the cover.
  pipe([[3.37,y-.14,z],[3.38,3.59,z],[3.30,3.88,z],[2.91,4.03,z],[2.78,4.08,z]],.012,copper,group);
  cyl(.06,.15,2.78,4.12,z,silver,group);
}
addTemperatureDial('oti',-.92,0);
addTemperatureDial('wti',-.12,1);
g=groups.breather;pipe([[-2.2,5.4,-1.75],[-3.7,5.35,-1.75],[-3.7,2.6,-1.75]],.035,steel,g);cyl(.13,.4,-3.7,2.35,-1.75,copper2,g);cyl(.16,.07,-3.7,2.6,-1.75,silver,g);cyl(.16,.1,-3.7,2.08,-1.75,black,g);
// Service fittings identified in the supplied Raychem RPG manual.
g=groups.ct;ring(.28,.16,.17,-2.1,3.65,.9,dark,g);torus(.28,.018,-2.1,3.7,.9,paper,g);
// Temperature capillary tubes and immersed bulbs are created with the end-wall dials above.
g=groups.valves;for(let x of [-2.7,2.7])for(let side of [-1,1])for(let y of [1.03,3.3]){let f=cyl(.16,.07,x,y,side*1.82,silver,g);f.rotation.x=Math.PI/2;box(.04,.21,.035,x,y+.16,side*1.82,dark,g);}pipe([[2.8,.85,1.57],[2.8,.85,1.98]],.055,steel,g);torus(.11,.018,2.8,1.01,1.93,dark,g);for(let x of [-2.7,2.7])cyl(.035,.1,x,3.45,2.25,copper,g);
g=groups.earth;for(let x of [-3,3]){box(.19,.12,.06,x,.85,1.7,copper,g);pipe([[x,.85,1.73],[x,.45,1.73],[x,.06,2]],.025,copper,g);}

// Extended component groups: interactive 3D educational geometry (not manufacturer CAD).
const extraIds=["mog","spr","osr","drive","selector","oltcoil","bladder","sample","drain","neutral","headers","pumps","coolctrl","terminal","coreearth","clamps","wrings","shields","lifting","plates"];
extraIds.forEach(id=>{if(!groups[id])throw new Error('Missing transformer group: '+id);});
function accessory(id,x,y,z,r=.12){const g=groups[id];cyl(r,.13,x,y,z,steel,g);cyl(r*.72,.04,x,y+.09,z,blue,g);return g;}
accessory('mog',2.52,5.65,-1.72,.19);
accessory('spr',-2.5,3.97,-.2,.16);
// Jansen/Johnson relay (the existing OLTC oil-surge device), in its OWN oil circuit.
// R connection on the OLTC head -> flow relay -> ISOLATED OLTC CHAMBER
// within the single shared conservator vessel (not a separate external tank).
// The normal tank Buchholz relay remains in the independent main-oil circuit.
g=groups.osr;
pipe([[2.72,4.20,0],[3.25,4.50,-1.5],[3.76,4.92,-1.5]],.08,steel,g);
let jbody=cyl(.16,.52,4.03,4.94,-1.5,steel,g);jbody.rotation.z=Math.PI/2;
for(let x of [3.75,4.31]){let flange=cyl(.22,.065,x,4.94,-1.5,silver,g);flange.rotation.z=Math.PI/2;}
box(.35,.28,.33,4.03,5.13,-1.5,blue,g);
box(.28,.18,.06,4.03,5.16,-1.305,dark,g);
let viewport=cyl(.095,.024,4.03,5.16,-1.266,silver,g);viewport.rotation.x=Math.PI/2;
let glass=cyl(.072,.026,4.03,5.16,-1.248,black,g);glass.rotation.x=Math.PI/2;
box(.15,.12,.18,4.03,5.34,-1.5,dark,g);
pipe([[4.31,4.94,-1.5],[4.65,5.04,-1.5],[4.65,5.45,-2.38],[4.15,5.65,-2.38]],.077,steel,g); // isolated OLTC chamber nozzle

g=groups.drive;box(.62,.82,.32,3.67,2.2,.6,steel,g);box(.4,.12,.04,3.67,2.42,.78,blue,g);cyl(.13,.25,3.67,1.78,.6,dark,g);
g=groups.selector;for(let y of [1.55,1.9,2.25,2.6,2.95]){torus(.26,.025,2.72,y,0,copper,g);box(.35,.045,.06,2.72,y,.25,silver,g);}
g=groups.oltcoil;cyl(.42,2.35,2.72,2.4,0,blue,g);
// OLTC oil is stored in the partitioned right-end chamber of groups.conservator.
// No duplicate tank geometry: oil separation is inside the one vessel.

g=groups.bladder;let b=cyl(.36,4.4,-.1,5.65,-1.72,paper,g);b.rotation.z=Math.PI/2;
accessory('sample',2.3,.8,1.82,.09);pipe([[2.3,.8,1.82],[2.3,.65,2.08]],.04,steel,groups.sample);
accessory('drain',-2.5,.75,1.85,.12);pipe([[-2.5,.75,1.85],[-2.5,.55,2.1]],.06,steel,groups.drain);
g=groups.neutral;bushing(2.48,.65,.85,g);pipe([[2.48,5.05,.65],[3.15,5.05,.65],[3.15,4.4,1.3]],.035,copper,g);
g=groups.headers;for(let side of [-1,1])for(let y of [1.05,3.3])pipe([[-2.85,y,side*2.25],[2.85,y,side*2.25]],.13,blue,g);
g=groups.pumps;for(let side of [-1,1]){let p=cyl(.22,.46,2.9,1.1,side*2.35,dark,g);p.rotation.z=Math.PI/2;box(.35,.18,.35,2.9,.78,side*2.35,steel,g);}
// Cooling control contactors, overload relays, manual/auto selector and miniature
// circuit breakers are panel-mounted INSIDE the marshalling enclosure.
g=groups.coolctrl;
box(.76,1.01,.035,-2.70,2.38,1.84,dark,g);
for(let y of [2.66,2.19])box(.70,.045,.06,-2.70,y,1.92,silver,g); // DIN rails
for(let i=0;i<3;i++){
  const x=-2.95+i*.25;
  box(.185,.30,.11,x,2.49,1.965,steel,g); // cooling-stage contactors
  box(.16,.065,.014,x,2.56,2.03,blue,g);
  box(.17,.14,.085,x,2.13,1.96,dark,g); // individual motor protection
  cyl(.035,.022,x,2.12,2.013,silver,g).rotation.x=Math.PI/2;
}
box(.18,.18,.07,-2.71,1.98,1.95,silver,g); // auto/manual selector
cyl(.063,.044,-2.71,1.98,2.009,black,g).rotation.x=Math.PI/2;
box(.22,.055,.02,-2.71,1.98,2.044,blue,g);

// Vertical DIN terminal strip and routed, insulated control leads within the
// RIGHT-HAND compartment. Wiring remains schematic, not a wiring diagram.
g=groups.terminal;
box(.25,1.02,.045,-1.955,2.38,1.85,dark,g);
box(.205,.91,.055,-1.955,2.38,1.90,silver,g);
for(let i=0;i<9;i++){
  const y=1.98+i*.091;
  box(.185,.076,.105,-1.955,y,1.983,paper,g); // isolated terminal blocks
  for(let x of [-2.014,-1.895]) {
    let screw=cyl(.024,.018,x,y,2.047,silver,g);
    screw.rotation.x=Math.PI/2;
  }
  const tint=i%3===0?blue:i%3===1?copper:paper;
  pipe([[-2.07,y,2.038],[-2.18,y,2.051],[-2.29,2.04+i*.075,2.051]],.009,tint,g);
}
for(let i=0;i<3;i++){
  const x=-2.02+i*.057;
  pipe([[x,1.99,2.045],[x,1.78,2.045],[x-.1,1.66,1.985]],.012,i===1?copper:blue,g);
}

g=groups.coreearth;pipe([[-2.1,1.15,0],[-2.85,.85,.4],[-3.35,.45,1.5]],.03,copper,g);
g=groups.clamps;for(let y of [1.02,3.52]){box(5.4,.13,.17,-.35,y,.54,dark,g);box(5.4,.13,.17,-.35,y,-.54,dark,g);}
g=groups.wrings;for(let x of [-2.1,-.35,1.4])for(let y of [1.25,3.23])ring(.83,.32,.07,x,y,0,paper,g);
g=groups.shields;for(let x of [-2.1,-.35,1.4])ring(.81,.76,.045,x,3.31,0,silver,g);
g=groups.lifting;for(let x of [-2.65,2.65])for(let z of [-1.15,1.15]){let t=torus(.16,.045,x,4.2,z,steel,g);t.rotation.x=0;box(.3,.1,.3,x,.38,z,steel,g);}
g=groups.plates;box(.68,.42,.025,1.8,2.1,1.73,silver,g);for(let y of [1.98,2.09,2.2])box(.48,.012,.028,1.8,y,1.75,dark,g);


// Rotate the entire conservator assembly onto the +X (right-hand) tank end.
// Separate selectable groups share one frame, including the bladder and breather.
// Rest positions are retained by update(), including after explode/reset.
const conservatorMount=new THREE.Group();
conservatorMount.position.set(4.15,0,0);
conservatorMount.rotation.y=Math.PI/2;
scene.add(conservatorMount);
for(const id of ['conservator','buchholz','breather','mog','bladder']){
  const group=groups[id];
  group.userData.rest=new THREE.Vector3(.1,0,1.72);
  group.position.copy(group.userData.rest);
  conservatorMount.add(group);
}
// Explosion vectors are world-space directions. Convert them into the rotated
// mounting frame, and spread the right-end accessories away from the bushings.
const conservatorTravel={
  conservator:[2,4,0], buchholz:[3,2,1], breather:[3,0,2],
  mog:[3,3,-2], bladder:[1,6,0]
};
const inverseMountRotation=conservatorMount.quaternion.clone().invert();
for(const [id,travel] of Object.entries(conservatorTravel)){
  groups[id].userData.vector.set(...travel).applyQuaternion(inverseMountRotation);
}
groups.osr.userData.vector.set(3,2,-2);

// Place the marshalling cabinet on the accessible END wall rather than
// behind the radiator bank. All three separately selectable groups share
// this rigid mounting frame, so their assembled world positions stay aligned.
const marshallingMount=new THREE.Group();
marshallingMount.position.set(-3.62,0,0);
marshallingMount.rotation.y=-Math.PI/2; // cabinet front faces outward, away from tank
scene.add(marshallingMount);
for(const id of ['aux','coolctrl','terminal']){
  const enclosureGroup=groups[id];
  enclosureGroup.userData.rest=new THREE.Vector3(2.44,0,-1.95);
  enclosureGroup.position.copy(enclosureGroup.userData.rest);
  marshallingMount.add(enclosureGroup);
}

// Paired upper/lower hardware cannot share an upward explosion vector:
// the lower members would sweep through the winding discs. Store local rest
// positions once and give each member its own absolute travel direction.
const splitMotion=[];
for(const id of ['core','clamps','wrings','insulation','lifting','tank','headers','pumps','valves']) {
  for(const o of groups[id].children) {
    if(!o.isMesh)continue;
    const y=o.position.y;
    let travel;
    if(id==='tank') {if(y<3.8)continue;travel=[0,6.5,0];}
    if(['headers','pumps','valves'].includes(id)) {
      o.geometry.computeBoundingBox();
      const center=o.geometry.boundingBox.getCenter(new THREE.Vector3()).add(o.position);
      travel=[0,0,Math.sign(center.z)*2.8];
    }
    if(id==='core') travel=y>3 ? [0,3.3,0] : [0,-.7,0];
    if(id==='clamps') travel=y>2 ? [0,3.6,0] : [0,-1.2,0];
    if(id==='wrings') travel=y>2 ? [0,3.9,0] : [0,-.8,0];
    if(id==='insulation') travel=y<1.3 ? [0,-.5,0] : y>3 ? [0,3.4,0] : [0,2.1,0];
    if(id==='lifting') travel=y>2 ? [0,6.8,0] : [0,-4.3,0];
    splitMotion.push({mesh:o,rest:o.position.clone(),travel:new THREE.Vector3(...travel)});
  }
}

// Ground reference, fine engineering grid and orientation ring.
const floor=new THREE.Mesh(new THREE.CircleGeometry(12,96),new THREE.MeshStandardMaterial({color:0x23312c,roughness:.92,transparent:true,opacity:.55}));floor.rotation.x=-Math.PI/2;floor.position.y=-.08;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(22,44,0x46584c,0x34463c);grid.position.y=-.06;grid.material.transparent=true;grid.material.opacity=.3;scene.add(grid);
for(let r of [5.3,5.38]){let o=new THREE.Mesh(new THREE.TorusGeometry(r,.008,4,160),new THREE.MeshBasicMaterial({color:0x71836b,transparent:true,opacity:.35}));o.rotation.x=Math.PI/2;o.position.y=-.04;scene.add(o);}
Object.values(groups).forEach(g=>{let geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);let line=new THREE.Line(geo,new THREE.LineDashedMaterial({color:0xb6d69b,dashSize:.1,gapSize:.09,transparent:true,opacity:.3}));line.visible=false;scene.add(line);guides.push({line,g});});
// X-ray removes the full tank, cover, radiator banks, fans, and their
// external headers/pumps so the internal core and windings remain unobstructed.
// It never modifies group visibility: manually hidden/isolated components persist.
function update(){
  const xray=mode==='xray',cut=mode==='cut';
  for(const o of meshes){
    const id=o.userData.id;
    const frontSkin=id==='tank' && o.position.z>1.5;
    const xrayHidden=xray&&XRAY_HIDDEN_GROUPS.has(id);
    const cutHidden=cut&&(frontSkin||id==='lid');
    o.visible=!(xrayHidden||cutHidden);
    o.material.opacity=1;
    o.material.transparent=false;
    o.material.depthWrite=true;
    o.material.clippingPlanes=cut&&['tank','lid','lowcoil','highcoil','insulation','cooling'].includes(id)?[cutPlane]:[];
  }
  for(const g of Object.values(groups)){
    g.visible=g.userData.manualVisible!==false&&!(xray&&XRAY_HIDDEN_GROUPS.has(g.userData.id));
    g.position.copy(g.userData.rest||new THREE.Vector3()).addScaledVector(g.userData.vector,explosion*EXPLODE_SPREAD);
  }
  for(const {mesh:o,rest,travel} of splitMotion){
    o.position.copy(rest).addScaledVector(travel,explosion*EXPLODE_SPREAD)
      .addScaledVector(o.parent.userData.vector,-explosion*EXPLODE_SPREAD);
  }
  // Keep winding axes fixed: lateral spreading while the nested cylinders
  // still overlap vertically makes one phase cut through its neighbour.
  floor.visible=explosion===0;
  groups.cooling.children.forEach(b=>b.position.copy(b.userData.offset).multiplyScalar(explosion*EXPLODE_SPREAD));
  // Fans pull away from their radiator banks in exploded view; restore on reset.
  for(const o of meshes)if(o.userData.isFan===true){
    if(o.userData.assembledZ===undefined)o.userData.assembledZ=o.position.z;
    o.position.z=o.userData.assembledZ+Math.sign(o.userData.assembledZ)*explosion*1.6;
  }
  for(const {line,g} of guides){
    const center=new THREE.Vector3(0,2,0);
    const p=line.geometry.attributes.position;
    p.setXYZ(0,center.x,center.y,center.z);
    const dest=g.getWorldPosition(new THREE.Vector3());
    p.setXYZ(1,dest.x,dest.y+2,dest.z);
    p.needsUpdate=true;line.computeLineDistances();
    line.visible=explosion>.08&&g.visible;
  }
  $('explodeValue').textContent=fa(Math.round(explosion*100))+'٪';
}
function select(id){selected=id;const p=parts.find(p=>p.id===id);document.querySelectorAll('.part').forEach(el=>el.classList.toggle('selected',el.dataset.id===id));meshes.forEach(o=>{o.material.emissive.set(o.userData.id===id?0x4b632e:0x000000);o.material.emissiveIntensity=.3;});$('detailContent').innerHTML=`<span class="detail-tag">${p.category}</span><h2>${p.fa}</h2><div class="en">${p.en.toUpperCase()}</div><p>${p.description}</p><div class="detail-actions"><button id="isolate">نمایش فقط این مجموعه</button><button id="showAll">نمایش همه قطعات</button></div><h3>جایگاه در مجموعه</h3><p>${p.location}</p><h3>وضعیت عادی و مبنای مقایسه</h3><p>${p.normal}</p><h3>نقاط توجه در نگهداری</h3><p>${p.inspection}</p><h3>نشانه‌های قابل بررسی</h3><p>${p.faults}</p><h3>بررسی تکمیلی و تفسیر</h3><p>${p.diagnosis}</p><h3>اقدام پس از مشاهده عیب</h3><p>${p.response}</p><h3>اطلاعات قابل ثبت</h3><p>${p.record}</p><p class="note">این مدل، مرجع آموزشی است. بازکردن، آزمون و هرگونه مداخله فقط توسط افراد مجاز، پس از ایزولاسیون، قفل‌گذاری، تأیید بی‌برقی و زمین‌کردن طبق دستورالعمل سایت انجام شود. حدود مجاز و دوره‌های سرویس را از سازنده بگیرید.</p><div class="manual-ref"><strong>مرجع این قطعه</strong><p>${p.manual[0]?`Raychem RPG · بخش ${p.manual[1]} · صفحه چاپی ${fa(p.manual[0])}<br><a href="reference-manual.pdf#page=${p.manual[0]+1}" target="_blank" rel="noopener">باز کردن صفحه مرجع ↗</a>`:p.manual[1]}</p></div><details><summary>منابع فنی و محدوده مدل</summary><p>این راهنما مرجع عمومی نصب و نگهداری است، نه نقشه ابعادی ترانس ۲۳۰/۱۳۲. حدود عددی آزمون، گشتاور و زمان‌ها به این مدل تعمیم داده نشده‌اند. مدل سه‌فاز دو سیم‌پیچه است؛ گروه برداری، توان نامی و ابعاد سازنده مشخص نشده‌اند. تعداد دورها، مسیر هادی‌ها و فاصله‌های عایقی شماتیک‌اند.</p><p><a href="https://www.usbr.gov/tsc/techreferences/mands/mands-pdfs/Trnsfrmr.pdf" target="_blank" rel="noopener">US Bureau of Reclamation — Transformer diagnostics</a><br><a href="https://www.reinhausen.com/fileadmin/downloadcenter/products/protective_devices/safety_relays/rs2001/rs/bal_1800059_11_001_en.pdf" target="_blank" rel="noopener">Reinhausen — RS protective relay instructions</a><br><a href="https://www.hitachienergy.com/products-and-solutions/transformers/transformer-service/upgrade-repair-and-extend/transformer-refurbishment" target="_blank" rel="noopener">Hitachi Energy — Transformer components & service</a><br><a href="https://www.reinhausen.com/servicedetail/oltc-services/maintenance-and-inspection" target="_blank" rel="noopener">Reinhausen — OLTC maintenance</a></p></details>`;$('isolate').onclick=()=>{Object.entries(groups).forEach(([key,g])=>g.userData.manualVisible=key===id);update();list();$('detail').close();};$('showAll').onclick=()=>{Object.values(groups).forEach(g=>g.userData.manualVisible=true);update();list();$('detail').close();};if(!$('detail').open)$('detail').showModal();}
function list(){let q=$('search').value.trim().toLowerCase();$('parts').innerHTML='';parts.filter(p=>(p.fa+' '+p.en).toLowerCase().includes(q)).forEach(p=>{let row=document.createElement('div');row.className='part';row.dataset.id=p.id;let btn=document.createElement('button');btn.className='part';btn.style.margin='0';btn.innerHTML=`<span class="num">${String(parts.indexOf(p)+1).padStart(2,'0')}</span><span class="names"><strong>${p.fa}</strong><small>${p.en}</small></span>`;btn.onclick=()=>select(p.id);let eye=document.createElement('button');eye.className='eye';eye.textContent=groups[p.id].userData.manualVisible?'◉':'○';eye.title='نمایش / پنهان کردن '+p.fa;eye.setAttribute('aria-label',eye.title);eye.setAttribute('aria-pressed',groups[p.id].userData.manualVisible);eye.onclick=()=>{groups[p.id].userData.manualVisible=!groups[p.id].userData.manualVisible;update();list();};row.append(btn,eye);$('parts').append(row);});if(!$('parts').children.length)$('parts').innerHTML='<p class="empty">قطعه‌ای یافت نشد.</p>';}
$('search').oninput=list;list();$('close').onclick=()=>$('detail').close();$('detail').addEventListener('close',()=>{meshes.forEach(o=>o.material.emissive.set(0));});document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){let b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}}));
$('explode').oninput=e=>{const old=explosion;explosion=+e.target.value/100;if(controls){const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar((1+explosion*1.6)/(1+old*1.6));controls.target.y=3+explosion*3.2;camera.position.copy(controls.target).add(offset);}update();};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));$('modeLabel').textContent={solid:'ASSEMBLED VIEW',xray:'X-RAY VIEW',cut:'CUTAWAY VIEW'}[mode];update();});
function view(pos){if(!controls)return;camera.position.set(...pos);controls.target.set(0,3,0);controls.update();} $('home').onclick=()=>{explosion=0;$('explode').value=0;Object.values(groups).forEach(g=>g.userData.manualVisible=true);update();list();view([13,9,15]);controls&&(controls.autoRotate=false);$('rotate').classList.remove('active');};$('back').onclick=()=>view([-12,8,-14]);$('top').onclick=()=>view([0,20,.01]);$('rotate').onclick=()=>{if(controls){controls.autoRotate=!controls.autoRotate;$('rotate').classList.toggle('active',controls.autoRotate);}};$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.workspace').requestFullscreen();}catch(e){$('full').title='تمام صفحه در این مرورگر پشتیبانی نمی‌شود';}};
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();function hit(e){const rect=host.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(meshes,false).find(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return !(mode==='xray'&&XRAY_HIDDEN_GROUPS.has(h.object.userData.id))&&!(mode==='cut'&&h.object.material.clippingPlanes.length&&h.point.z>0);});}
if(renderer){let down=null;renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];$('tooltip').style.display='none';});renderer.domElement.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<6){const h=hit(e);if(h)select(h.object.userData.id);}down=null;});renderer.domElement.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch')return;const h=hit(e);$('tooltip').style.display=h?'block':'none';renderer.domElement.style.cursor=h?'pointer':'grab';if(h){const p=parts.find(p=>p.id===h.object.userData.id);$('tooltip').textContent=`${p.en} (${p.fa})`;$('tooltip').style.left=Math.min(e.clientX+15,innerWidth-280)+'px';$('tooltip').style.top=e.clientY+17+'px';}});renderer.domElement.addEventListener('pointerleave',()=>$('tooltip').style.display='none');new ResizeObserver(()=>{let w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(host);function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}animate();}
let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});$('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;}else $('installHelp').showModal();};if('serviceWorker'in navigator){
  let reloading=false;
  if(navigator.serviceWorker.controller)navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading){reloading=true;location.reload();}});
  navigator.serviceWorker.register('./sw.js?v=14',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});
}update();
