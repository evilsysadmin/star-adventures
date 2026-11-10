// Browser-only Playwright fixture: imports actual production Three and GLTF
// code through Vite, never bundled in the production application.
import * as THREE from 'three';
import {addK47AuthoredEnvironment} from '../../src/components/GroundK47AuthoredEnvironment';
import type {ArtManifest} from '../../src/k47EnvironmentAssets';

type Input={manifest:ArtManifest;explored:string[]};
type Result={loaded:string[];failed:string[];meshCount:number;
  names:string[];disposeWorked:boolean;error?:string};
declare global {
  interface Window{
    __k47AssetProbeInput?:Input;
    __k47AssetProbe?:Result;
  }
}
async function probe(){
  const input=window.__k47AssetProbeInput;
  if(!input){window.__k47AssetProbe={
    loaded:[],failed:[],meshCount:0,names:[],disposeWorked:false,
    error:'fixture input missing'};return;}
  const scene=new THREE.Scene();
  try{
    const result=await addK47AuthoredEnvironment(
      scene,new Set(input.explored),new AbortController().signal,
      input.manifest);
    const names:string[]=[];
    let meshCount=0;
    scene.traverse(node=>{
      if(node instanceof THREE.Mesh){meshCount++;names.push(node.name);}
    });
    const answer:Result={
      loaded:result.loadedIds,failed:result.failedIds,meshCount,names,
      disposeWorked:false,
    };
    result.dispose();
    answer.disposeWorked=scene.children.length===0;
    window.__k47AssetProbe=answer;
  }catch(error){
    window.__k47AssetProbe={
      loaded:[],failed:[],meshCount:0,names:[],disposeWorked:false,
      error:String(error),
    };
  }
}
void probe();
