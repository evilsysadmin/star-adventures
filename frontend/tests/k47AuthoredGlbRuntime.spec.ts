import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import type {Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

function testGLB(){
  // A complete valid glTF 2.0 GLB with one indexed triangle, embedded BIN,
  // no images, no external resources and no compression dependencies.
  const positions=[-.20,0,-.20, .20,0,-.20, 0,.30,.20];
  const bin=Buffer.alloc(44);
  positions.forEach((value,i)=>bin.writeFloatLE(value,i*4));
  [0,1,2].forEach((value,i)=>bin.writeUInt16LE(value,36+i*2));
  const json={
    asset:{version:'2.0',generator:'ShadowOps E2E authored art fixture'},
    buffers:[{byteLength:44}],
    bufferViews:[
      {buffer:0,byteOffset:0,byteLength:36,target:34962},
      {buffer:0,byteOffset:36,byteLength:6,target:34963},
    ],
    accessors:[
      {bufferView:0,componentType:5126,count:3,type:'VEC3',
        min:[-.2,0,-.2],max:[.2,.3,.2]},
      {bufferView:1,componentType:5123,count:3,type:'SCALAR',min:[0],max:[2]},
    ],
    meshes:[{name:'K47-Test-Triangle',primitives:[
      {attributes:{POSITION:0},indices:1}]}],
    nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0,
  };
  const raw=Buffer.from(JSON.stringify(json));
  const jsonPadded=Buffer.alloc(Math.ceil(raw.length/4)*4,32);
  raw.copy(jsonPadded);
  const length=12+8+jsonPadded.length+8+bin.length;
  const glb=Buffer.alloc(length);
  glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);
  glb.writeUInt32LE(length,8);
  glb.writeUInt32LE(jsonPadded.length,12);
  glb.writeUInt32LE(0x4e4f534a,16);
  jsonPadded.copy(glb,20);
  const offset=20+jsonPadded.length;
  glb.writeUInt32LE(bin.length,offset);
  glb.writeUInt32LE(0x004e4942,offset+4);
  bin.copy(glb,offset+8);
  return glb;
}
function publishedManifest(body:Buffer){
  const sha256=createHash('sha256').update(body).digest('hex');
  const url='https://assets.chess-studio.shadowops.dpdns.org/star-adventures/environment/south-industrial-shell-'+sha256.slice(0,16)+'.glb';
  const slot={
    id:'south-industrial-shell',
    footprint:[[3,7],[4,7],[5,7],[6,7],[7,7]],
    anchor:[5,0,7],
    status:'published',
    asset:{
      url,sha256,bytes:body.length,license:'original',
      source:'Original Playwright tiny embedded GLB verification model',
    },
  };
  return {manifest:{schemaVersion:1,scene:'meridian.surface',slots:[slot]},
    url,sha256};
}
async function runFixture(page:Page,input:unknown){
  await page.evaluate(value=>{
    (window as typeof window & {
      __k47AssetProbeInput?:unknown;__k47AssetProbe?:unknown
    }).__k47AssetProbeInput=value;
    delete (window as typeof window & {__k47AssetProbe?:unknown}).__k47AssetProbe;
  },input);
  await page.addScriptTag({type:'module',url:'/tests/fixtures/k47ArtBrowserProbe.ts'});
  await expect.poll(async()=>page.evaluate(()=>
    (window as typeof window & {__k47AssetProbe?:unknown}).__k47AssetProbe),
    {timeout:20000}).not.toBeUndefined();
  return page.evaluate(()=>
    (window as typeof window & {__k47AssetProbe?:unknown}).__k47AssetProbe);
}
for(const width of [390,1280]){
 test('actual authenticated R2 GLB is parsed and bounded by real blocked terrain '+width,
 async({page})=>{
  test.setTimeout(100_000);
  await page.setViewportSize({width,height:850});
  const body=testGLB();
  const {manifest,url}=publishedManifest(body);
  let requests=0;
  await page.route(url,route=>{
    requests++;
    return route.fulfill({status:200,contentType:'model/gltf-binary',
      headers:{'access-control-allow-origin':'*'},body});
  });
  await page.goto('/');
  const result=await runFixture(page,{
    manifest,explored:['3,7','4,7','5,7','6,7','7,7']
  }) as {loaded:string[];failed:string[];meshCount:number;
    disposeWorked:boolean;error?:string};
  expect(result.error).toBeUndefined();
  expect(result.loaded).toEqual(['south-industrial-shell']);
  expect(result.failed).toEqual([]);
  expect(result.meshCount).toBeGreaterThanOrEqual(1);
  expect(result.disposeWorked).toBe(true);
  expect(requests).toBe(1);
  // The test does not mutate the active episode. Normal gameplay remains
  // available after the isolated art probe.
  await expect(page.getByTestId('captain-controls')).toBeVisible();
 });
}
test('undiscovered art does not fetch, invalid CDN response is fallback',async({page})=>{
 test.setTimeout(100_000);
 const body=testGLB(),{manifest,url}=publishedManifest(body);
 let requests=0;
 await page.route(url,route=>{
   requests++;
   return route.fulfill({status:503,body:'unavailable'});
 });
 await page.goto('/');
 const hidden=await runFixture(page,{
   manifest,explored:['3,7','4,7','5,7','6,7']
 }) as {loaded:string[];failed:string[];meshCount:number;error?:string};
 expect(hidden.error).toBeUndefined();
 expect(hidden.loaded).toEqual([]);
 expect(hidden.failed).toEqual([]);
 expect(requests).toBe(0);
 // Reload is necessary because an ES-module script with the same URL only
 // executes once in a browser document; the new run is a distinct page.
 await page.reload();
 const failed=await runFixture(page,{
   manifest,explored:['3,7','4,7','5,7','6,7','7,7']
 }) as {loaded:string[];failed:string[];meshCount:number;error?:string};
 expect(failed.error).toBeUndefined();
 expect(failed.loaded).toEqual([]);
 expect(failed.failed).toEqual(['south-industrial-shell']);
 expect(requests).toBe(1);
});

for(const width of [390,1280]){
 test('dev art candidate renders in the REAL landing canvas before R2 publication '+width,
 async({page})=>{
  test.setTimeout(125_000);
  await page.setViewportSize({width,height:850});
  const body=testGLB(),{manifest,url}=publishedManifest(body);
  // Only the development server consumes this override. It must still pass
  // the exact production SHA, R2 origin, footprint and fog gates.
  await page.addInitScript(value=>{
    (window as typeof window & {__k47ArtPreviewManifest?:unknown})
      .__k47ArtPreviewManifest=value;
  },manifest);
  let requests=0;
  await page.route(url,route=>{
    requests++;
    return route.fulfill({status:200,contentType:'model/gltf-binary',
      headers:{'access-control-allow-origin':'*'},body});
  });
  await page.goto('/');
  await page.getByTestId('captain-transport').click();
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  const court=page.getByTestId('ground-landing-court-3d');
  await expect(court).toHaveAttribute('data-published-art-slots','1');
  await expect(court).toHaveAttribute('data-renderer-state','ready',{timeout:20000});
  // Actually explore the front of the south shell instead of inventing
  // exploration state or bypassing the normal fog.
  await board.locator('[data-cell-id="5,6"]').click({button:'right'});
  await expect(court).toHaveAttribute('data-authored-art-ready',
    'south-industrial-shell',{timeout:35000});
  await expect(court).toHaveAttribute('data-authored-art-state','ready');
  // The new contiguous SVG factory is the genuine visual fallback for
  // exactly these blocked wall cells. The verified GLB must REPLACE it,
  // never stack another opaque building on top.
  await expect(board.getByTestId('ground-south-industrial-wing'))
    .toHaveCSS('opacity','0');
  expect(requests).toBeGreaterThanOrEqual(1);
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  await board.screenshot({path:'test-results/k47-authored-preview-'+width+'.png'});
  await page.reload();
  await expect(court).toHaveAttribute('data-authored-art-ready',
    'south-industrial-shell',{timeout:35000});
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    .toBe(true);
 });
}

test('invalid dev art preview is ignored instead of blanking the landing',async({page})=>{
 const body=testGLB(),{manifest}=publishedManifest(body);
 manifest.slots[0].asset!.url='https://invalid.example/not-authorized.glb';
 await page.addInitScript(value=>{
   (window as typeof window & {__k47ArtPreviewManifest?:unknown})
     .__k47ArtPreviewManifest=value;
 },manifest);
 await page.route('**/star-adventures/environment/*.glb',route=>
   route.abort('failed'));
 await page.goto('/');
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 const court=page.getByTestId('ground-landing-court-3d');
 await expect(court).toHaveAttribute('data-published-art-slots','0');
 await expect(court).toHaveAttribute('data-authored-art-state','unpublished');
 // Invalid art must never blank the real connected industrial facility.
 await expect(page.getByTestId('ground-south-industrial-wing'))
   .toHaveCSS('opacity','1');
 await expect(page.getByTestId('ground-squad-board')
   .locator('[data-cell-id]')).toHaveCount(216);
});
