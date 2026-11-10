import {test,expect,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Render the actual original architecture, not the old single-triangle probe.
// No R2 mutation: Playwright serves local candidate bytes at their exact
// content-addressed URL to the game's production-verifying GLB loader.
test.use({storageState:{cookies:[],origins:[]}});
const script=fileURLToPath(new URL('../scripts/build_k47_south_facade.py',import.meta.url));
function buildCandidate(){
 const bytes=execFileSync('python3',[script],{maxBuffer:5*1024*1024});
 if(bytes.length<100_000||bytes.length>4*1024*1024)
   throw new Error('Original south facade is empty or over budget');
 return bytes;
}
const bytes=buildCandidate();
const sha256=createHash('sha256').update(bytes).digest('hex');
const url='https://assets.chess-studio.shadowops.dpdns.org/star-adventures/environment/south-industrial-shell-'+sha256.slice(0,16)+'.glb';
const manifest={schemaVersion:1,scene:'meridian.surface',slots:[{
 id:'south-industrial-shell',
 footprint:[[3,7],[4,7],[5,7],[6,7],[7,7]],
 anchor:[5,0,7],
 status:'published',asset:{url,sha256,bytes:bytes.length,license:'original',
   source:'ShadowOps original K-47 architecture study generator, no third-party material'},
}]};

test('original authored candidate is deterministic, glTF 2.0 and locally bounded',()=>{
 const next=buildCandidate();
 expect(next.equals(bytes)).toBe(true);
 expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
 expect(bytes.readUInt32LE(4)).toBe(2);
 expect(bytes.readUInt32LE(8)).toBe(bytes.length);
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 expect(json.asset.version).toBe('2.0');
 expect(json.images).toHaveLength(1);
 expect(json.images[0].uri).toBeUndefined();
 expect(json.meshes[0].primitives.length).toBeGreaterThanOrEqual(9);
 expect(json.nodes[0].name).toContain('K47');
 expect(json.accessors.some((entry:{max?:number[]})=>
   entry.max?.length===3&&entry.max[1]>3.5)).toBe(true);
});
for(const width of [390,1280]){
 test('real landing previews original south frontage with verified 3D art '+width,
 async({page})=>{
  test.setTimeout(115_000);
  await page.setViewportSize({width,height:850});
  await page.addInitScript(candidate=>{
    (window as typeof window & {__k47ArtPreviewManifest?:unknown})
      .__k47ArtPreviewManifest=candidate;
  },manifest);
  let requests=0;
  await page.route(url,route=>{
   requests++;
   return route.fulfill({status:200,contentType:'model/gltf-binary',
     headers:{'access-control-allow-origin':'*'},body:bytes});
  });
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible();
  await page.getByTestId('captain-transport').click();
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  const art=page.getByTestId('ground-landing-court-3d');
  await expect(art).toHaveAttribute('data-renderer-state','ready',{timeout:25_000});
  await board.locator('[data-cell-id="5,6"]').click({button:'right'});
  await expect(art).toHaveAttribute('data-authored-art-ready',
     'south-industrial-shell',{timeout:25_000});
  await expect(art).toHaveAttribute('data-authored-art-state','ready');
  await expect(board.getByTestId('ground-architecture-wall-3,7'))
    .toHaveCSS('opacity','0');
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  expect(requests).toBeGreaterThanOrEqual(1);
  await board.screenshot({path:'test-results/k47-south-authored-facade-'+width+'.png'});
  await page.reload();
  await expect(art).toHaveAttribute('data-authored-art-ready',
    'south-industrial-shell',{timeout:25_000});
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
