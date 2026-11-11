import * as THREE from 'three';

// Original 3x1 sci/archives prefab. It occupies exactly the existing physical
// 2,2(sensor-vault),3,2(wall),4,2(probe) footprint. All three blockers must
// already be discovered before this assembly can replace the SVG shell.
// No new objective, door, path, fog reveal, camera or interactive surface.
export function addScienceCampus3D(parent:THREE.Group,x:number,z:number){
 const root=new THREE.Group();
 root.name='modular-prefab.science-campus-3x1';
 root.position.set(x+1,0,z);
 const resources:Array<{dispose:()=>void}>=[];
 const mat=(hex:number,metalness=.38,roughness=.78,glow?:number)=>{
  const m=new THREE.MeshStandardMaterial({color:hex,metalness,roughness,
   ...(glow?{emissive:glow,emissiveIntensity:.42}:{})});
  resources.push(m);
  return m;
 };
 const cladding=mat(0x617c78,.22,.88);
 const dark=mat(0x213d48,.54,.67);
 const frame=mat(0xa2afa1,.58,.56);
 const brass=mat(0xb9a478,.63,.62);
 const roof=mat(0x7d9184,.38,.81);
 const roofShade=mat(0x405d61,.42,.78);
 const glass=mat(0x4f9294,.22,.34,0x1a747e);
 const glassDark=mat(0x204955,.21,.46,0x153e4b);
 const amber=mat(0xe4bb7c,.22,.54,0xa97131);
 const shadow=mat(0x182d38,.12,.96);
 const box=(name:string,w:number,h:number,d:number,
  xx:number,yy:number,zz:number,material:THREE.Material)=>{
  const geo=new THREE.BoxGeometry(w,h,d);
  resources.push(geo);
  const mesh=new THREE.Mesh(geo,material);
  mesh.name=name;
  mesh.position.set(xx,yy,zz);
  mesh.castShadow=false;
  mesh.receiveShadow=true;
  root.add(mesh);return mesh;
 };
 const cylinder=(name:string,r:number,h:number,
  xx:number,yy:number,zz:number,material:THREE.Material,segments=12)=>{
  const geo=new THREE.CylinderGeometry(r,r,h,segments);
  resources.push(geo);
  const mesh=new THREE.Mesh(geo,material);
  mesh.name=name;mesh.position.set(xx,yy,zz);
  mesh.castShadow=false;mesh.receiveShadow=true;
  root.add(mesh);return mesh;
 };
 // One long shaded plinth, then three distinct, connected volumes. Their
 // building envelope remains entirely on the three real blocked cells.
 box('science-continuous-foundation',2.98,.12,.94,0,.06,0,shadow);
 box('science-shared-cladding',2.90,.93,.80,0,.565,0,cladding);
 box('science-back-wall',2.94,1.01,.10,0,.605,-.405,dark);
 box('science-south-wall',2.88,.24,.09,0,.23,.435,dark);
 // Five recessed laboratory windows share a SINGLE uninterrupted facade,
 // bounded by exterior columns so it reads as a station, not five cubes.
 box('science-south-recess',2.67,.57,.06,0,.72,.46,shadow);
 for(let i=0;i<6;i++){
  const xx=-1.18+i*.47;
  box('science-south-glass',.40,.47,.033,xx,.73,.503,
   i===2||i===3?glass:glassDark);
  box('science-south-sill',.44,.037,.068,xx,.485,.506,brass);
  box('science-south-top-lintel',.44,.033,.072,xx,1.002,.506,frame);
 }
 for(const xx of [-1.445,-.975,-.505,-.035,.435,.905,1.445]){
  box('science-south-mullion',.035,.74,.10,xx,.70,.496,frame);
 }
 // Front overhang, a continuous roof terrace and a deliberately staggered
 // 3-cell machinery cluster with long service conduits.
 box('science-wide-canopy',3.12,.075,1.12,0,1.10,.04,roof);
 box('science-roof-dark-return',3.16,.08,.14,0,1.112,.55,dark);
 box('science-roof-brass-leading-edge',3.17,.024,.027,0,1.145,.624,brass);
 box('science-roof-rear-parapet',3.16,.18,.105,0,1.23,-.493,frame);
 box('science-roof-back-cap',3.19,.035,.14,0,1.34,-.49,roofShade);
 // Raised alternating roof panels, with no per-cell seam across the main
 // overhang. Scuffed steel ribs repeat at equipment scale, not map scale.
 for(let i=0;i<9;i++){
  const xx=-1.31+i*.33;
  box('science-roof-structural-rib',.035,.029,.82,xx,1.165,.005,roofShade);
 }
 box('science-roof-service-trunk',1.89,.085,.10,-.14,1.204,-.18,dark);
 box('science-roof-trunk-conduit',1.86,.026,.027,-.14,1.256,-.18,brass);
 // Two instrument stations and a large common optical receiver provide
 // readable rooftop machinery without making three identical roof sheds.
 box('science-equipment-podium',.88,.17,.38,-.80,1.23,-.10,dark);
 box('science-equipment-rack',.68,.13,.28,-.80,1.38,-.10,frame);
 for(const dx of [-.20,-.07,.07,.20]){
  box('science-equipment-fins',.022,.10,.21,-.80+dx,1.50,-.1,roofShade);
 }
 cylinder('science-optical-bearing',.23,.11,.57,1.24,-.04,dark);
 cylinder('science-optical-ring',.28,.05,.57,1.32,-.04,brass,16);
 cylinder('science-optical-housing',.16,.24,.57,1.47,-.04,roofShade);
 cylinder('science-optical-lens',.12,.022,.57,1.595,-.04,glass,16);
 // A short upper service pedestal at the opposite end breaks the squared
 // skyline while respecting the 1.8-world-unit science building budget.
 cylinder('science-diagnostic-antenna',.035,.44,1.04,1.35,-.28,frame,8);
 cylinder('science-diagnostic-beacon',.09,.07,1.04,1.61,-.28,amber,10);
 // East-facing end receives glazing and braced service ribs.
 box('science-end-recess',.065,.55,.57,1.457,.73,.01,shadow);
 box('science-end-glass',.036,.45,.49,1.494,.73,.01,glassDark);
 for(const z0 of [-.19,.19]){
  box('science-end-column',.09,.91,.04,1.488,.58,z0,frame);
 }
 for(const xx of [-1.27,-.71,.71,1.27]){
  box('science-facade-lamp',.13,.028,.05,xx,1.057,.54,amber);
 }
 // Collision truth stays with surface.walls and surface.objects; a scene
 // group never creates new interactive or semantic geometry.
 parent.add(root);
 return ()=>{
  parent.remove(root);
  for(const resource of resources)resource.dispose();
 };
}
