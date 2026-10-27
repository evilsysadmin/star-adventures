import * as THREE from 'three';

// Original articulated 3D actor. Unlike the camera-facing 3×2 atlases, this
// body really turns in world space and its limbs animate independently.
// Root origin is the officer's feet at the centre of the logical tile.
export type OfficerRigPose = 'idle' | 'walk' | 'fire' | 'hit';

export function createTacticalOfficerRig(accent: string) {
 const root = new THREE.Group();
 root.name = 'canonical-security-officer';
 const body = new THREE.Group();
 root.add(body);
 const fabric = new THREE.MeshStandardMaterial({color:'#263b48',roughness:.78,metalness:.08});
 const trousers = new THREE.MeshStandardMaterial({color:'#1a2834',roughness:.85});
 const boots = new THREE.MeshStandardMaterial({color:'#111b25',roughness:.82});
 const trim = new THREE.MeshStandardMaterial({color:accent,roughness:.45,metalness:.3});
 const skin = new THREE.MeshStandardMaterial({color:'#c58d70',roughness:.9});
 const hair = new THREE.MeshStandardMaterial({color:'#1c242a',roughness:.9});
 const put = (parent:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,
              x:number,y:number,z:number) => {
  const mesh = new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
 };
 // Readable original uniform silhouette, not a licensed character model.
 put(body,new THREE.BoxGeometry(.63,.78,.35),fabric,0,1.17,0);
 put(body,new THREE.BoxGeometry(.64,.10,.38),trim,0,1.46,0);
 put(body,new THREE.BoxGeometry(.19,.25,.025),trim,.13,1.18,.19);
 put(body,new THREE.CylinderGeometry(.18,.20,.32,10),skin,0,1.72,0);
 put(body,new THREE.SphereGeometry(.205,10,8),skin,0,1.87,0);
 put(body,new THREE.SphereGeometry(.208,10,8,0,Math.PI*2,0,Math.PI*.38),hair,0,1.94,0);
 const makeLimb=(side:-1|1,arm:boolean)=>{
  const pivot = new THREE.Group();
  pivot.position.set(side*(arm?.42:.18),arm?1.43:.78,0);
  body.add(pivot);
  if(arm){
   put(pivot,new THREE.BoxGeometry(.20,.58,.25),fabric,0,-.30,0);
   put(pivot,new THREE.BoxGeometry(.21,.11,.26),trim,0,-.05,0);
   put(pivot,new THREE.BoxGeometry(.18,.15,.20),skin,0,-.64,0);
  }else{
   put(pivot,new THREE.BoxGeometry(.25,.66,.30),trousers,0,-.34,0);
   put(pivot,new THREE.BoxGeometry(.28,.16,.42),boots,0,-.70,.07);
  }
  return pivot;
 };
 const leftLeg=makeLimb(-1,false),rightLeg=makeLimb(1,false);
 const leftArm=makeLimb(-1,true),rightArm=makeLimb(1,true);
 const face=(heading:number)=>{
  if(!Number.isFinite(heading))throw new RangeError('Invalid officer heading');
  root.rotation.y=heading;
 };
 const pose=(mode:OfficerRigPose,seconds:number)=>{
  const t=Number.isFinite(seconds)?seconds:0;
  leftLeg.rotation.x=0;rightLeg.rotation.x=0;
  leftArm.rotation.x=0;rightArm.rotation.x=0;
  body.rotation.z=0;body.rotation.x=0;body.position.y=0;
  if(mode==='walk'){
   const stride=Math.sin(t*11);
   leftLeg.rotation.x=.55*stride;rightLeg.rotation.x=-.55*stride;
   leftArm.rotation.x=-.32*stride;rightArm.rotation.x=.32*stride;
   body.position.y=.035*Math.abs(stride);
  }else if(mode==='fire'){
   rightArm.rotation.x=-1.35;
   leftArm.rotation.x=-.38;
   body.rotation.x=-.10;
  }else if(mode==='hit'){
   body.rotation.z=.25;body.rotation.x=.16;
   leftArm.rotation.x=.5;rightArm.rotation.x=.6;
  }else{
   body.position.y=.012*Math.sin(t*2.4);
  }
 };
 pose('idle',0);
 return {root,face,pose};
}
