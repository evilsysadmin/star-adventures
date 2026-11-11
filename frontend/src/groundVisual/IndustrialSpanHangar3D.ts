import * as THREE from 'three';

// Reusable *architecture* prefab, not another grid cell decoration.
// A run represents consecutive, verified blocked cells supplied by the caller.
// It never owns collision, fog, picking, mission data or renderer lifecycle.
export type IndustrialSpanRun={
  readonly start:number;
  readonly end:number;
  readonly row:number;
};

export function addIndustrialSpanHangars(
  scene:THREE.Scene,
  runs:ReadonlyArray<IndustrialSpanRun>,
){
  const root=new THREE.Group();
  root.name='modular-industrial-span-hangars';
  const boxGeometry=new THREE.BoxGeometry(1,1,1);
  const material={
    foundation:new THREE.MeshStandardMaterial({color:0x273941,metalness:.35,roughness:.91}),
    shell:new THREE.MeshStandardMaterial({color:0x596b66,metalness:.53,roughness:.76}),
    roof:new THREE.MeshStandardMaterial({color:0x344b50,metalness:.64,roughness:.67}),
    support:new THREE.MeshStandardMaterial({color:0x182f39,metalness:.65,roughness:.7}),
    recess:new THREE.MeshStandardMaterial({color:0x102936,metalness:.36,roughness:.82}),
    glass:new THREE.MeshStandardMaterial({
      color:0x376c74,emissive:0x123b45,emissiveIntensity:.55,
      metalness:.25,roughness:.34,
    }),
    accent:new THREE.MeshStandardMaterial({
      color:0xbb9567,metalness:.65,roughness:.46,
    }),
    lamp:new THREE.MeshStandardMaterial({
      color:0xffc687,emissive:0xe59b55,emissiveIntensity:1.65,
      metalness:.15,roughness:.4,
    }),
  };
  const place=(group:THREE.Group,name:string,
    x:number,y:number,z:number,w:number,h:number,d:number,
    mat:THREE.Material,shadow=true)=>{
    const mesh=new THREE.Mesh(boxGeometry,mat);
    mesh.name=name;
    mesh.position.set(x,y,z);
    mesh.scale.set(w,h,d);
    mesh.castShadow=shadow;
    mesh.receiveShadow=true;
    group.add(mesh);
    return mesh;
  };

  for(const run of runs){
    if(!Number.isInteger(run.start)||!Number.isInteger(run.end)||
      !Number.isInteger(run.row)||run.end<run.start||run.end-run.start>17)continue;
    const count=run.end-run.start+1;
    const center=(run.start+run.end)/2;
    const width=count-.035;
    const group=new THREE.Group();
    group.name='industrial-hangar-'+run.start+'-'+run.end+'-'+run.row;
    // One continuous, proportioned building over the validated blocked row.
    // Everything stays between row +/- .48: no phantom walkable roof or door.
    place(group,'shared-plinth',center,.14,run.row,width,.28,.94,
      material.foundation);
    place(group,'continuous-shell',center,.68,run.row,width-.08,.94,.84,
      material.shell);
    place(group,'recessed-front-band',center,.83,run.row-.441,width-.13,.72,.028,
      material.recess);
    place(group,'lintel',center,1.13,run.row-.449,width-.05,.14,.063,
      material.support);
    // Twin low roof pitches make one silhouette. No per-cell roof slabs.
    const near=place(group,'roof-pitch-near',center,1.274,run.row-.224,
      width,.12,.51,material.roof);
    near.rotation.x=-.085;
    const far=place(group,'roof-pitch-far',center,1.274,run.row+.224,
      width,.12,.51,material.roof);
    far.rotation.x=.085;
    place(group,'roof-ridge',center,1.32,run.row,width,.11,.075,
      material.accent);
    place(group,'roof-front-eave',center,1.22,run.row-.46,
      width+.025,.065,.045,material.accent);
    place(group,'service-spine',center,1.365,run.row+.18,
      width-.18,.07,.095,material.support);
    for(let x=run.start;x<=run.end;x++){
      // These panels are deliberately *recessed* in a shared structure.
      // They are closed industrial bays, not fictional traversable doors.
      const outer=x===run.start||x===run.end;
      place(group,'bay-recess-'+x,x,.68,run.row-.468,.76,.64,.021,
        material.recess,false);
      place(group,'bay-panel-'+x,x,.675,run.row-.482,.64,.5,.014,
        outer?material.support:material.glass,false);
      place(group,'bay-horizontal-trim-'+x,x,.42,run.row-.493,.69,.045,.021,
        material.accent,false);
      place(group,'bay-light-'+x,x,1.045,run.row-.486,.13,.055,.025,
        material.lamp,false);
      if(x<run.end){
        place(group,'shared-pier-'+x,x+.5,.69,run.row-.466,.12,.97,.12,
          material.support);
      }
    }
    // One asymmetrical machinery cluster per complete hangar, not
    // a miniature box/vent repeated on each tile.
    if(count>=3){
      place(group,'roof-plant-base',run.start+count*.35,1.42,
        run.row+.12,.72,.16,.4,material.foundation);
      place(group,'roof-plant-housing',run.start+count*.35,1.57,
        run.row+.12,.59,.23,.31,material.support);
      place(group,'roof-plant-cap',run.start+count*.35,1.72,
        run.row+.12,.66,.08,.36,material.accent);
    }
    root.add(group);
  }
  root.userData.buildingCount=root.children.length;
  scene.add(root);
  return ()=>{
    scene.remove(root);
    boxGeometry.dispose();
    Object.values(material).forEach(item=>item.dispose());
  };
}
