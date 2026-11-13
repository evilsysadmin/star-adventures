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
  // Small original repeatable metal-weathering texture; no external or copied art.
  // One shared atlas and geometry serve every span, with bounded GPU cleanup.
  const pixels=new Uint8Array(64*64*4);
  let seed=0x4b470123;
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const grain=(seed>>>26)-32;
    const wear=((x+y*3)%17===0?9:0);
    const value=Math.max(175,Math.min(251,223+grain+wear));
    const index=(y*64+x)*4;
    pixels[index]=value;
    pixels[index+1]=Math.min(255,value+3);
    pixels[index+2]=Math.min(255,value+1);
    pixels[index+3]=255;
  }
  const weather=new THREE.DataTexture(pixels,64,64,THREE.RGBAFormat);
  weather.colorSpace=THREE.SRGBColorSpace;
  weather.magFilter=THREE.LinearFilter;
  weather.minFilter=THREE.LinearFilter;
  weather.wrapS=THREE.RepeatWrapping;
  weather.wrapT=THREE.RepeatWrapping;
  weather.repeat.set(3,1);
  weather.needsUpdate=true;
  const material={
    foundation:new THREE.MeshStandardMaterial({color:0x526662,metalness:.31,roughness:.87}),
    shell:new THREE.MeshStandardMaterial({
      color:0x89968a,map:weather,metalness:.32,roughness:.84,
      emissive:0x102329,emissiveIntensity:.1,
    }),
    roof:new THREE.MeshStandardMaterial({
      color:0x59736f,map:weather,metalness:.45,roughness:.78,
    }),
    support:new THREE.MeshStandardMaterial({color:0x456269,metalness:.48,roughness:.74}),
    recess:new THREE.MeshStandardMaterial({color:0x3b5a60,metalness:.24,roughness:.88,
      emissive:0x19343a,emissiveIntensity:.14}),
    shutter:new THREE.MeshStandardMaterial({color:0x758e87,metalness:.34,roughness:.81}),
    glass:new THREE.MeshStandardMaterial({
      color:0x4b8990,emissive:0x18545e,emissiveIntensity:1.1,
      metalness:.24,roughness:.44,
    }),
    accent:new THREE.MeshStandardMaterial({
      color:0xc3a271,metalness:.58,roughness:.51,
    }),
    lamp:new THREE.MeshStandardMaterial({
      color:0xffd49c,emissive:0xf1ac62,emissiveIntensity:2.25,
      metalness:.08,roughness:.4,
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
    place(group,'recessed-front-band',center,.79,run.row+.447,width-.13,.69,.024,
      material.recess);
    place(group,'continuous-front-lintel',center,1.096,run.row+.462,
      width-.04,.13,.064,material.support);
    place(group,'front-light-rail',center,1.132,run.row+.489,
      width-.12,.028,.015,material.accent,false);
    // The dark uninterrupted fascia in the first pilot swallowed every bay.
    // Keep a visible shared structure, but make its three-dimensional frame
    // legible at gameplay zoom before adding microscopic detailing.
    // The fixed orthographic camera looks from +X/+Z: service bays face +Z,
    // toward the player. Keeping panels on the opposite side would leave
    // the foreground as a blank wall.
    // Twin low roof pitches make one silhouette. No per-cell roof slabs.
    const near=place(group,'roof-pitch-near',center,1.274,run.row-.224,
      width,.12,.51,material.roof);
    near.rotation.x=-.085;
    const far=place(group,'roof-pitch-far',center,1.274,run.row+.224,
      width,.12,.51,material.roof);
    far.rotation.x=.085;
    place(group,'roof-ridge',center,1.32,run.row,width,.11,.075,
      material.accent);
    place(group,'roof-front-eave',center,1.22,run.row+.449,
      width+.025,.065,.075,material.accent);
    place(group,'service-spine',center,1.365,run.row+.18,
      width-.18,.07,.095,material.support);
    // One continuous skylight and a few structural seams: the roof reads as
    // a single factory, not a checkerboard of individually raised cubes.
    place(group,'skylight-recess',center,1.349,run.row-.11,
      Math.max(.65,width-.9),.022,.19,material.support,false);
    place(group,'skylight-glazing',center,1.364,run.row-.11,
      Math.max(.58,width-1.04),.014,.13,material.glass,false);
    place(group,'end-cap-left',run.start-.446,.72,run.row+.01,
      .095,1.03,.88,material.support);
    place(group,'end-cap-right',run.end+.446,.72,run.row+.01,
      .095,1.03,.88,material.support);
    for(let x=run.start;x<=run.end;x++){
      // These panels are deliberately *recessed* in a shared structure.
      // They are closed industrial bays, not fictional traversable doors.
      const outer=x===run.start||x===run.end;
      place(group,'bay-recess-'+x,x,.68,run.row+.462,.79,.63,.015,
        material.recess,false);
      place(group,'bay-panel-'+x,x,.672,run.row+.473,.66,.48,.014,
        outer?material.shutter:material.glass,false);
      // The end bays are sealed cargo shutters, deliberately not entrances.
      // Horizontal relief and irregular glazing are visible at 390px too.
      if(outer){
        for(let level=0;level<5;level++){
          place(group,'shutter-rib-'+x+'-'+level,x,.47+level*.085,
            run.row+.484,.67,.016,.013,material.support,false);
        }
      }else{
        place(group,'window-divider-'+x,x,.674,run.row+.485,
          .048,.46,.012,material.support,false);
        place(group,'window-header-'+x,x,.901,run.row+.486,
          .69,.035,.012,material.accent,false);
      }
      place(group,'bay-horizontal-trim-'+x,x,.402,run.row+.487,
        .76,.044,.018,material.accent,false);
      place(group,'bay-light-'+x,x,1.035,run.row+.488,
        .27,.058,.018,material.lamp,false);
      if(x<run.end){
        place(group,'shared-pier-'+x,x+.5,.689,run.row+.461,
          .115,1.00,.07,material.support);
        place(group,'pier-highlight-'+x,x+.5,.643,run.row+.493,
          .036,.73,.012,material.accent,false);
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
    weather.dispose();
    Object.values(material).forEach(item=>item.dispose());
  };
}
