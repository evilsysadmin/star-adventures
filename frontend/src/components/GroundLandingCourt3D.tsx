import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import world from '../../../content/scenes/meridian.json';
import {ARCHIVE_RENDER_HEIGHT,ARCHIVE_RENDER_WIDTH,
  makeGroundArchiveCamera} from '../groundArchiveCamera';
import {
  addK47AuthoredEnvironment,eligiblePublishedK47ArtIds,
  k47ArtManifestForRendering,
} from './GroundK47AuthoredEnvironment';
import {southIndustrialSpans,southIndustrialCoveredColumns} from '../groundSouthIndustrialSpans';
import {compileGroundVisualScene} from '../groundVisual/compileGroundVisualScene';
import {addGroundVisualScene3D} from '../groundVisual/GroundVisualScene3D';

// PBR industrial landing court: one authored, contiguous environment slice.
// The THREE scene and SVG game use the *same exact* grid projection/camera.
// No WebGL mesh can change canonical pathfinding, fog, objectives or picking.
type Vision={explored:ReadonlySet<string>;visible:ReadonlySet<string>};
const surface=world.scenes.surface;
const id=(x:number,z:number)=>x+','+z;
const occupied=new Set([...surface.walls,...surface.objects].map(p=>id(p.x,p.y)));
const courtCells=Array.from({length:4},(_,row)=>row+3).flatMap(z=>
  Array.from({length:6},(_,column)=>({x:column+2,z})))
 .filter(cell=>!occupied.has(id(cell.x,cell.z)));
const topologyValid=surface.width===18&&surface.height===12&&
  surface.objects.some(p=>p.id==='beam-out'&&p.x===4&&p.y===6)&&
  courtCells.length>=14;

function courtTexture(){
  // Original deterministic texture: irregular concrete, dust, oil wear,
  // chips and long cracks rather than tiles or licensed art.
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=512;
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  let seed=0x47c05291;
  const random=()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
  ctx.fillStyle='#817d70';ctx.fillRect(0,0,512,512);
  for(let i=0;i<2900;i++){
    const x=random()*512,y=random()*512;
    const size=1+random()*7;
    const dark=random()>.48;
    ctx.fillStyle=dark?'rgba(31,46,46,.14)':'rgba(220,201,166,.14)';
    ctx.fillRect(x,y,size,1+random()*3);
  }
  for(let i=0;i<85;i++){
    const x=random()*512,y=random()*512;
    const rx=7+random()*31,ry=3+random()*11;
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,random()*Math.PI,0,Math.PI*2);
    ctx.fillStyle=i%3===0?'rgba(54,57,49,.15)':'rgba(126,91,62,.16)';
    ctx.fill();
  }
  for(let i=0;i<46;i++){
    let x=random()*512,y=random()*512;
    ctx.beginPath();ctx.moveTo(x,y);
    for(let segment=0;segment<3+Math.floor(random()*5);segment++){
      x+=random()*32-12;y+=random()*25-7;
      ctx.lineTo(x,y);
    }
    ctx.strokeStyle=i%3===0?'rgba(196,166,124,.24)':'rgba(22,42,47,.33)';
    ctx.lineWidth=.65+random()*1.8;ctx.stroke();
  }
  // Large, asymmetric wear sweeps must span multiple ground cells.
  for(let i=0;i<9;i++){
    ctx.beginPath();
    const y=45+i*56+random()*17;
    ctx.moveTo(-20,y);
    ctx.bezierCurveTo(90,y-15,260,y+25,532,y+random()*36-18);
    ctx.strokeStyle=i%2===0?'rgba(34,51,52,.20)':'rgba(206,174,137,.17)';
    ctx.lineWidth=3+random()*7;ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  texture.wrapS=THREE.ClampToEdgeWrapping;
  texture.wrapT=THREE.ClampToEdgeWrapping;
  return texture;
}

function makeCourtSurface(replaced:ReadonlySet<string>){
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  const corners=(x:number,z:number)=>[
    [x-.5,z-.5],[x-.5,z+.5],[x+.5,z+.5],[x+.5,z-.5]
  ];
  for(const cell of courtCells){
    if(replaced.has(id(cell.x,cell.z)))continue;
    const n=positions.length/3;
    for(const [x,z] of corners(cell.x,cell.z)){
      positions.push(x,.025,z);
      uv.push((x-1.5)/6,(z-2.5)/4);
    }
    indices.push(n,n+1,n+2,n,n+2,n+3);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',
    new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function buildCourt(scene:THREE.Scene,knownWallColumns:ReadonlySet<number>,
  replaced:ReadonlySet<string>){
  const resources:Array<{dispose:()=>void}>=[];
  const texture=courtTexture();
  if(texture)resources.push(texture);
  const material=new THREE.MeshStandardMaterial({
    color:0xcac7b5,metalness:.11,roughness:.99,
    ...(texture?{map:texture}:{})
  });
  resources.push(material);
  const geometry=makeCourtSurface(replaced);
  resources.push(geometry);
  const floor=new THREE.Mesh(geometry,material);
  floor.name='industrial-court-continuous-floor';
  floor.receiveShadow=true;
  scene.add(floor);
  const makeMat=(color:number,metalness=.55,roughness=.75)=>
    new THREE.MeshStandardMaterial({color,metalness,roughness});
  const metal=makeMat(0x596765,.72,.53);
  const shadow=makeMat(0x243941,.32,.88);
  const bronze=makeMat(0xb8a17c,.68,.52);
  const rubber=makeMat(0x263f42,.09,.95);
  resources.push(metal,shadow,bronze,rubber);
  const box=(name:string,x:number,y:number,z:number,
    w:number,h:number,d:number,mat:THREE.Material)=>{
    const geometry=new THREE.BoxGeometry(w,h,d);
    resources.push(geometry);
    const mesh=new THREE.Mesh(geometry,mat);
    mesh.name=name;mesh.position.set(x,y,z);
    mesh.receiveShadow=true;mesh.castShadow=true;scene.add(mesh);
  };
  // Substantial industrial foundation behind the yard, on real blocked wall
  // cells only. It casts physically coherent shadow onto the public court.
  for(const x of [3,4,5,6,7]){
    if(!occupied.has(id(x,7))||!knownWallColumns.has(x))continue;
    box('court-wall-base-'+x,x,.26,7,.94,.52,.93,shadow);
    box('court-wall-cap-'+x,x,.57,7,.96,.11,.94,metal);
    box('court-wall-conduit-'+x,x,.38,6.58,.93,.07,.095,bronze);
  }
  // Industrial seams and embedded service conduits are flush with the
  // original *walkable* floor. They never form new collision geometry.
  for(const [x,z] of [[3,4],[4,4],[5,5],[6,5],[3,6],[5,6]]){
    if(occupied.has(id(x,z)))continue;
    box('court-drain-'+x+'-'+z,x,.031,z,.63,.015,.08,rubber);
    box('court-drain-edge-'+x+'-'+z,x,.041,z-.067,.66,.017,.02,bronze);
  }
  // Only authentic blocked wall cells receive tall utility housings.
  for(const x of [3,6]){
    if(!occupied.has(id(x,7))||!knownWallColumns.has(x))continue;
    box('court-service-unit-'+x,x,.84,7,.48,.45,.37,metal);
    box('court-service-cap-'+x,x,1.11,7,.54,.09,.43,bronze);
  }
  scene.add(new THREE.HemisphereLight(0xbed0d0,0x21363b,2.05));
  const sun=new THREE.DirectionalLight(0xffd3a3,3.1);
  sun.position.set(2,8,0);sun.castShadow=true;
  sun.shadow.mapSize.set(512,512);
  sun.shadow.camera.left=-9;sun.shadow.camera.right=9;
  sun.shadow.camera.top=9;sun.shadow.camera.bottom=-9;
  sun.shadow.camera.near=.5;sun.shadow.camera.far=30;
  sun.shadow.bias=-.001;
  scene.add(sun);
  const amber=new THREE.PointLight(0xffbf82,4,7,2);
  amber.position.set(3.2,2,5.1);scene.add(amber);
  const teal=new THREE.PointLight(0x9cdbd6,2.5,6,2);
  teal.position.set(6.1,1.8,3.3);scene.add(teal);
  return ()=>resources.forEach(resource=>resource.dispose());
}

export function GroundLandingCourt3D({explored}:Vision){
  const canvas=useRef<HTMLCanvasElement>(null);
  const [state,setState]=useState<'idle'|'ready'|'fallback'>('idle');
  const [artState,setArtState]=useState<'unpublished'|'loading'|'ready'|'fallback'>('unpublished');
  const [loadedArtIds,setLoadedArtIds]=useState('');
  const active=topologyValid&&courtCells.some(p=>explored.has(id(p.x,p.z)));
  // Roofs and utility boxes project ABOVE their ground cell's fog silhouette.
  // Only real discovered walls may ever enter the Three scene. Rebuild the
  // one-shot renderer when the actual explored frontier advances.
  const knownWalls=[3,4,5,6,7].filter(x=>explored.has(id(x,7))).join(',');
  // The continuous SVG hangar owns the discovered connected south wall.
  // Keep these tiny PBR block foundations as fallback for isolated wall
  // cells only: drawing both is what gave the previous GLB study its
  // double-building silhouette. Gameplay, floor and fog remain untouched.
  const authoredSouth=southIndustrialCoveredColumns(
    southIndustrialSpans(explored,surface.walls));
  const pbrWallColumns=knownWalls.split(',').filter(Boolean)
    .map(Number).filter(x=>!authoredSouth.has(x)).join(',');
  // Adding an entirely discovered authored building triggers a repaint, but
  // unrelated set churn never causes a redundant GLTF/CDN request.
  // Pilot one small authored zone in the EXISTING WebGL scene. The compiler
  // consumes only real walkability and explored cells, never renders hidden
  // geometry and cannot affect gameplay picking or movement.
  const modulePlan=compileGroundVisualScene({
    width:surface.width,height:surface.height,
    walls:surface.walls,objects:surface.objects,explored,
  },{x:0,y:0,width:12,height:10},{
    id:'prefab.recessed-service-trench-2x1',anchor:{x:3,y:5},
  });
  const moduleKey=[
    modulePlan.tiles.map(p=>p.assetId+':'+p.cellId).join(' '),
    modulePlan.edges.map(p=>p.assetId+':'+p.cellId+':'+p.side+':'+p.blockedNeighbor).join(' '),
    modulePlan.rocks.map(p=>p.cellId+':'+p.material+':'+p.variation).join(' '),
    modulePlan.prefabs.map(p=>p.assetId+':'+p.footprint.join('+')).join(' '),
  ].join('|');
  const artManifest=k47ArtManifestForRendering();
  const authoredKey=eligiblePublishedK47ArtIds(explored,artManifest).join(' ');
  useEffect(()=>{
    if(!active||!canvas.current)return;
    let renderer:THREE.WebGLRenderer|undefined;
    let disposeCourt:(()=>void)|undefined;
    let disposeModular:(()=>void)|undefined;
    let disposeAuthored:(()=>void)|undefined;
    const abortArt=new AbortController();
    try{
      renderer=new THREE.WebGLRenderer({canvas:canvas.current,alpha:true,
        antialias:true,powerPreference:'low-power'});
      renderer.setPixelRatio(1);
      renderer.setSize(ARCHIVE_RENDER_WIDTH,ARCHIVE_RENDER_HEIGHT,false);
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure=1.18;
      renderer.setClearColor(0x000000,0);
      renderer.shadowMap.enabled=true;
      renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      const scene=new THREE.Scene();
      disposeCourt=buildCourt(scene,
        new Set(pbrWallColumns.split(',').filter(Boolean).map(Number)),
        new Set(modulePlan.tiles.map(p=>p.cellId)));
      disposeModular=addGroundVisualScene3D(scene,modulePlan);
      const camera=makeGroundArchiveCamera();
      renderer.render(scene,camera);
      setState('ready');
      // This fetches NOTHING until an R2 object is explicitly published and
      // all of the asset's actual blocked cells are known to the squad.
      if(authoredKey){
        setArtState('loading');
        void addK47AuthoredEnvironment(scene,explored,abortArt.signal,artManifest).then(result=>{
          if(abortArt.signal.aborted){
            result.dispose();return;
          }
          disposeAuthored=result.dispose;
          if(result.loadedIds.length)renderer?.render(scene,camera);
          setLoadedArtIds(result.loadedIds.join(' '));
          setArtState(result.failedIds.length?'fallback':
            result.loadedIds.length?'ready':'unpublished');
        }).catch(()=>{
          if(!abortArt.signal.aborted)setArtState('fallback');
        });
      }else{
        setArtState('unpublished');
        setLoadedArtIds('');
      }
    }catch{
      // The original SVG remains fully playable on phones, WebGL-disabled
      // browsers or software-renderer failure. No faux "successful" art.
      abortArt.abort();
      disposeAuthored?.();
      disposeModular?.();
      disposeCourt?.();
      renderer?.dispose();
      setArtState('fallback');
      setState('fallback');
      return;
    }
    return ()=>{
      abortArt.abort();
      disposeAuthored?.();
      disposeModular?.();
      disposeCourt?.();
      renderer?.dispose();
    };
  },[active,knownWalls,pbrWallColumns,moduleKey,authoredKey,artManifest]);
  return <foreignObject data-testid="ground-landing-court-3d"
    data-topology-valid={topologyValid?'true':'false'}
    data-painted-cells={courtCells.length}
    data-modular-region="0,0:12x10"
    data-modular-tiles={modulePlan.tiles.length}
    data-modular-edges={modulePlan.edges.length}
    data-modular-rocks={modulePlan.rocks.length}
    data-modular-rock-cell-ids={modulePlan.rocks.map(p=>p.cellId).join(' ')}
    data-modular-prefabs={modulePlan.prefabs.length}
    data-modular-cell-ids={modulePlan.tiles.map(p=>p.cellId).join(' ')}
    data-discovered-wall-columns={knownWalls}
    data-pbr-wall-fallback-columns={pbrWallColumns}
    data-authored-art-slots={artManifest.slots.length}
    data-published-art-slots={artManifest.slots.filter(slot=>slot.status==='published').length}
    data-authored-art-state={artState}
    data-authored-art-ready={loadedArtIds}
    data-renderer-state={state}
    x="0" y="0" width={ARCHIVE_RENDER_WIDTH} height={ARCHIVE_RENDER_HEIGHT}
    aria-hidden="true" pointerEvents="none"
    visibility={active?'visible':'hidden'}
    style={{pointerEvents:'none'}}>
      <canvas ref={canvas}
        width={ARCHIVE_RENDER_WIDTH} height={ARCHIVE_RENDER_HEIGHT}
        aria-hidden="true" style={{display:'block',
          width:ARCHIVE_RENDER_WIDTH,height:ARCHIVE_RENDER_HEIGHT,
          pointerEvents:'none'}} />
    </foreignObject>;
}
