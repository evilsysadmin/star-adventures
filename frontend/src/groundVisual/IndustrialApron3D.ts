import * as THREE from 'three';

// Reusable original six-cell 3D industrial apron. All geometry is low, opaque,
// passive art: the compiler has already validated ALL six cells as existing,
// free and explored. An apron cannot add an actual door, wall or pick target.
export function addIndustrialApron3D(parent:THREE.Group,x:number,z:number){
 const root=new THREE.Group();
 root.name='modular-prefab.industrial-apron-3x2';
 root.position.set(x+1,0,z+.5);
 const disposables:Array<{dispose:()=>void}>=[];
 const material=(color:number,metalness:number,roughness:number)=>{
  const value=new THREE.MeshStandardMaterial({color,metalness,roughness});
  disposables.push(value);return value;
 };
 const steel=material(0x435c5b,.62,.69);
 const border=material(0x99a79a,.45,.63);
 const bronze=material(0xc1aa7c,.66,.58);
 const shadow=material(0x152e36,.29,.93);
 const glass=material(0x386e70,.26,.56);
 const amber=material(0xe8bc79,.32,.47);
 const box=(name:string,w:number,h:number,d:number,
  x0:number,y0:number,z0:number,mat:THREE.Material)=>{
  const geo=new THREE.BoxGeometry(w,h,d);disposables.push(geo);
  const mesh=new THREE.Mesh(geo,mat);
  mesh.name=name;mesh.position.set(x0,y0,z0);
  mesh.castShadow=false;mesh.receiveShadow=true;
  root.add(mesh);
 };
 // A single plate, not six independent tile cubes. Its physical silhouette
 // is one fabricated assembly, aligned with real 3x2 world-space cells.
 box('apron-shared-foundation',2.96,.027,1.96,0,.068,0,steel);
 box('apron-deep-recess',2.61,.014,.72,0,.088,.08,shadow);
 box('apron-service-channel',2.43,.014,.40,0,.101,.08,glass);
 // Two unbroken longitudinal structural stiffeners bind the assembly.
 for(const z0 of [-.84,.83]){
  box('apron-recessed-frame',2.85,.047,.065,0,.106,z0,border);
  box('apron-brass-inlay',2.70,.016,.021,0,.136,z0,bronze);
 }
 for(const x0 of [-1.42,1.42]){
  box('apron-end-cap',.063,.044,1.69,x0,.106,0,border);
 }
 // A single 3x2 grid of lower-height large textured service panels:
 // material changes are structural rather than a chessboard of six boxes.
 for(const x0 of [-1.01,0,1.01]){
  box('apron-service-bay',.84,.012,.52,x0,.094,-.45,glass);
  box('apron-service-bay-step',.83,.018,.038,x0,.113,-.72,bronze);
 }
 // Long industrial grating across the channel, with a true recess visible
 // between cross bars; this is the visual scale of equipment, not tile grid.
 for(let i=0;i<11;i++){
  const x0=-1.19+i*.238;
  box('apron-cross-grate',.038,.018,.54,x0,.117,.08,border);
 }
 box('apron-trench-spine',2.64,.019,.048,0,.129,.08,shadow);
 // Six integrated low approach lights: no floating UI, clickable pins or
 // tall geometry crossing the officer silhouettes.
 for(const x0 of [-1.12,0,1.12])
  for(const z0 of [-.92,.92]){
   box('apron-safety-lamp',.10,.024,.055,x0,.134,z0,amber);
  }
 box('apron-utility-cable',2.48,.016,.046,0,.107,.59,shadow);
 box('apron-utility-wire',2.35,.014,.019,0,.127,.59,bronze);
 parent.add(root);
 return ()=>{
  parent.remove(root);
  for(const resource of disposables)resource.dispose();
 };
}
