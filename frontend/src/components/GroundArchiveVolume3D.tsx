import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import world from '../../../content/scenes/meridian.json';
import {ARCHIVE_RENDER_HEIGHT,ARCHIVE_RENDER_WIDTH,makeGroundArchiveCamera} from '../groundArchiveCamera';

// A measurable volumetric art experiment, NOT a replacement interaction map.
// The entire building sits on the canonical western blocked perimeter and
// non-playable exterior. Its exterior controls remain the real sensor-vault
// station at 2,2. No walkable grid square, mission or save is changed.
type Vision={explored:ReadonlySet<string>;visible:ReadonlySet<string>};
const surface=world.scenes.surface;
const wallKeys=new Set(surface.walls.map(p=>p.x+','+p.y));
const archive=surface.objects.find(o=>o.id==='sensor-vault');
const anchorIsReal=archive?.x===2&&archive?.y===2&&
  ['0,3','0,4','0,5'].every(k=>wallKeys.has(k));

function weatheredMetal(){
  const c=document.createElement('canvas');
  c.width=256;c.height=256;
  const context=c.getContext('2d');
  if(!context)return null;
  const pixels=context.createImageData(256,256);
  let seed=0x4b475f35;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<pixels.data.length;i+=4){
    const v=155+Math.floor(random()*50);
    pixels.data[i]=v;pixels.data[i+1]=Math.min(255,v+3);
    pixels.data[i+2]=Math.min(255,v+2);pixels.data[i+3]=255;
  }
  context.putImageData(pixels,0,0);
  for(let i=0;i<135;i++){
    const x=random()*256,y=random()*256;
    context.strokeStyle=i%3===0?'rgba(85,54,43,.26)':'rgba(22,39,47,.18)';
    context.lineWidth=.6+random()*2.2;
    context.beginPath();context.moveTo(x,y);
    context.lineTo(x+random()*17-8,y+random()*46+5);context.stroke();
  }
  const texture=new THREE.CanvasTexture(c);
  texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(1.6,2.4);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

// Pure presentation ownership: mission entities/terrain are never inferred
// from these meshes, and WebGL availability can only affect visual quality.
function buildArchive(scene:THREE.Scene){
  const resources:Array<{dispose:()=>void}>=[];
  const texture=weatheredMetal();
  if(texture)resources.push(texture);
  const material=(color:number,metalness=.35,roughness=.78)=>
    new THREE.MeshStandardMaterial({color,metalness,roughness});
  const cladding=new THREE.MeshStandardMaterial({
    color:0x9ca9a2,metalness:.35,roughness:.9,...(texture?{map:texture}:{})
  });
  const stone=material(0x475354,.03,1);
  const roof=material(0x3c5358,.67,.5);
  const dark=material(0x182b35,.65,.6);
  const frame=material(0x9c9e8e,.72,.46);
  const brass=material(0xb79d72,.7,.39);
  const rust=material(0x76594c,.32,.88);
  const window=new THREE.MeshStandardMaterial({
    color:0x74b4b6,metalness:.2,roughness:.28,
    emissive:0x1b777f,emissiveIntensity:1.25,
  });
  const amber=new THREE.MeshStandardMaterial({
    color:0xffd9a1,emissive:0xffa45c,emissiveIntensity:2.8,
    metalness:0,roughness:.4,
  });
  const mats=[cladding,stone,roof,dark,frame,brass,rust,window,amber];
  resources.push(...mats);

  const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,
    mat:THREE.Material)=>{
    const geo=new THREE.BoxGeometry(w,h,d);
    resources.push(geo);
    const mesh=new THREE.Mesh(geo,mat);
    mesh.name=name;mesh.position.set(x,y,z);
    mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
    return mesh;
  };
  const cylinder=(name:string,x:number,y:number,z:number,r:number,h:number,
    mat:THREE.Material)=>{
    const geo=new THREE.CylinderGeometry(r,r,h,10);
    resources.push(geo);
    const mesh=new THREE.Mesh(geo,mat);
    mesh.name=name;mesh.position.set(x,y,z);
    mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
    return mesh;
  };

  // Archive occupies x <= 0 (the blocked edge), z=2.45..5.55. Every
  // traversable x >= 1 is outside the building's physical envelope.
  // This is one authored volume, not one decorative cube per grid tile.
  box('archive-foundation',-1.36,.17,4,2.85,.34,3.38,stone);
  box('archive-slab-rim',-1.36,.38,4,2.97,.13,3.56,brass);
  box('archive-main-volume',-1.43,1.42,4,2.72,2.14,3.12,cladding);
  box('archive-east-bulkhead',-.055,1.44,4,.16,2.1,3.1,dark);
  box('archive-roof',-1.43,2.62,4,3.16,.24,3.52,roof);
  box('archive-roof-cap',-1.43,2.79,4,2.8,.10,3.17,frame);
  box('archive-upper-band',-.008,2.38,4,.24,.15,3.42,brass);
  box('archive-lower-band',-.006,.53,4,.21,.19,3.35,rust);

  // A sealed exterior archive hatch: access remains through the actual
  // sensor-vault mission interaction, never through a fake 3D doorway.
  box('archive-sealed-hatch',.063,1.34,2.92,.14,1.71,.87,frame);
  box('archive-hatch-inset',.145,1.33,2.92,.055,1.49,.69,dark);
  box('archive-hatch-status',.19,1.98,2.92,.04,.09,.58,window);
  for(const z of [3.72,4.38,5.04]){
    box('archive-window-frame-'+z,.041,1.57,z,.18,.96,.54,frame);
    box('archive-window-glass-'+z,.15,1.57,z,.052,.78,.4,window);
    box('archive-window-mullion-'+z,.185,1.57,z,.035,.8,.045,dark);
    box('archive-window-sill-'+z,.14,1.05,z,.13,.09,.62,brass);
    box('archive-window-shutter-'+z,.17,1.57,z-.31,.12,1.02,.07,dark);
  }

  // One coherent industrial shell: horizontal façade bands and roof ribs
  // share the same scale/materials, unlike independent per-cell decals.
  for(const y of [.68,1.14,2.03]){
    box('archive-facade-rail-'+y,.075,y,4,.11,.07,3.32,frame);
  }
  for(const z of [2.52,3.34,4.16,4.98,5.48]){
    box('archive-facade-rib-'+z,.082,1.38,z,.11,2,.075,roof);
  }
  for(const z of [2.57,3.13,3.69,4.25,4.81,5.37]){
    box('archive-roof-seam-'+z,-1.43,2.90,z,2.91,.045,.055,frame);
  }
  for(const x of [-2.79,-.07]){
    box('archive-eave-rail-'+x,x,2.85,4,.09,.19,3.42,brass);
  }
  // Non-walkable rooftop service equipment; no phantom ladders/platforms.
  box('archive-roof-generator',-1.92,3.17,3.24,.82,.52,.62,dark);
  box('archive-roof-generator-cap',-1.92,3.46,3.24,.92,.07,.68,frame);
  box('archive-vent',-.88,3.12,4.75,.67,.41,.58,roof);
  for(const x of [-1.08,-.88,-.68]){
    box('archive-vent-gill-'+x,x,3.35,4.75,.065,.055,.54,brass);
  }
  cylinder('archive-exhaust',-2.32,3.58,5.13,.14,1.49,rust);
  cylinder('archive-exhaust-cowl',-2.32,4.37,5.13,.22,.13,frame);
  cylinder('archive-floodlight-a',.23,2.24,2.62,.1,.16,amber);
  cylinder('archive-floodlight-b',.23,2.24,5.3,.1,.16,amber);

  // External pipework integrated with blocked frontage, plus a low-profile
  // signal conduit on a real passable approach. None has input/collision.
  for(const z of [3.49,5.4]){
    cylinder('archive-upright-pipe-'+z,.19,1.16,z,.07,1.48,brass);
    cylinder('archive-pipe-collar-'+z,.19,1.86,z,.095,.08,frame);
  }
  for(const z of [3.51,4.09,4.67,5.25]){
    box('archive-low-service-box-'+z,.23,.31,z,.26,.35,.32,roof);
  }
  const conduit=box('archive-exterior-data-conduit',.99,.06,2.92,1.83,.08,.09,brass);
  conduit.castShadow=false;
  const conduit2=box('archive-data-conduit-sleeve',1.02,.08,3.08,1.76,.11,.055,dark);
  conduit2.castShadow=false;
  // Subtle volumetric lights: readable teal windows, warm industrial lamps.
  const daylight=new THREE.HemisphereLight(0xacc2d0,0x111c26,2.2);
  scene.add(daylight);
  const sun=new THREE.DirectionalLight(0xffd2a2,3.1);
  sun.position.set(4,10,-3);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-10;sun.shadow.camera.right=10;
  sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;
  sun.shadow.camera.near=.5;sun.shadow.camera.far=30;
  sun.shadow.bias=-.0005;
  scene.add(sun);
  for(const z of [2.63,5.3]){
    const bulb=new THREE.PointLight(0xffbd77,6,4.7,2);
    bulb.position.set(.38,2.16,z);scene.add(bulb);
  }
  return ()=>resources.forEach(resource=>resource.dispose());
}

export function GroundArchiveVolume3D({explored,visible}:Vision){
  const canvas=useRef<HTMLCanvasElement>(null);
  const [status,setStatus]=useState<'idle'|'ready'|'fallback'>('idle');
  const known=anchorIsReal&&['0,3','0,4','0,5','2,2']
    .every(k=>explored.has(k));
  const bright=['0,3','0,4','0,5','2,2']
    .every(k=>visible.has(k));
  useEffect(()=>{
    if(!known||!canvas.current)return;
    let renderer:THREE.WebGLRenderer;
    try{
      renderer=new THREE.WebGLRenderer({canvas:canvas.current,alpha:true,
        antialias:true,powerPreference:'low-power'});
    }catch{
      setStatus('fallback');return;
    }
    renderer.setPixelRatio(1);
    renderer.setSize(ARCHIVE_RENDER_WIDTH,ARCHIVE_RENDER_HEIGHT,false);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.15;
    renderer.setClearColor(0x000000,0);
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const scene=new THREE.Scene();
    const disposeArt=buildArchive(scene);
    const camera=makeGroundArchiveCamera();
    renderer.render(scene,camera);
    setStatus('ready');
    return ()=>{
      disposeArt();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  },[known]);
  return <foreignObject data-testid="ground-archive-volume-3d"
    data-topology-valid={anchorIsReal?'true':'false'}
    data-renderer-state={status}
    data-fog={bright?'visible':known?'remembered':'unknown'}
    x="0" y="0" width={ARCHIVE_RENDER_WIDTH} height={ARCHIVE_RENDER_HEIGHT}
    aria-hidden="true" pointerEvents="none"
    visibility={known?'visible':'hidden'}
    style={{opacity:bright?1:.34,pointerEvents:'none'}}>
    <canvas ref={canvas} width={ARCHIVE_RENDER_WIDTH}
      height={ARCHIVE_RENDER_HEIGHT} aria-hidden="true"
      style={{display:'block',width:ARCHIVE_RENDER_WIDTH,
        height:ARCHIVE_RENDER_HEIGHT,pointerEvents:'none'}}/>
  </foreignObject>;
}
