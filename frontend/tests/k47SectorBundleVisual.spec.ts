import {expect,test,type Page} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
test.use({storageState:{cookies:[],origins:[]}});
const root=fileURLToPath(new URL('./fixtures/',import.meta.url));
const base='https://assets.chess-studio.shadowops.dpdns.org/star-adventures/environment/';
const configs=[
 {id:'south-industrial-shell',file:'k47-south-candidate.glb',footprint:[[3,7],[4,7],[5,7],[6,7],[7,7]],anchor:[5,0,7]},
 {id:'west-archive-shell',file:'k47-archive-candidate.glb',footprint:[[0,3],[0,4],[0,5]],anchor:[0,0,4]},
 {id:'east-utilities-shell',file:'k47-east-candidate.glb',footprint:[[8,1],[8,2],[8,3]],anchor:[8,0,2]},
] as const;
test.skip(!configs.every(x=>existsSync(root+x.file)),
 'The dedicated art workflow generates original GLBs; main CI never publishes them');
async function openGame(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click({timeout:25000});
 await page.getByTestId('transport-confirm').click();
 const court=page.getByTestId('ground-landing-court-3d');
 await expect(court).toHaveAttribute('data-renderer-state','ready',{timeout:25000});
 return page.getByTestId('ground-squad-board');
}
async function walk(page:Page,cell:string){
 const board=page.getByTestId('ground-squad-board');
 const [x,y]=cell.split(',');
 if(Number(x)>=7){
  // Real accessible keyboard move avoids the on-screen mission transmission
  // panel that can cover the eastern click target in both tested viewports.
  // The same normal selected officer must actually walk the saved map.
  const venn=page.getByTestId('ground-unit-venn');
  const fromX=Number(await venn.getAttribute('data-grid-x'));
  const fromY=Number(await venn.getAttribute('data-grid-y'));
  await page.getByTestId('ground-move-mode').click();
  await board.focus();
  for(let i=fromX;i<Number(x);i++)await page.keyboard.press('ArrowRight');
  for(let i=fromX;i>Number(x);i--)await page.keyboard.press('ArrowLeft');
  for(let i=fromY;i<Number(y);i++)await page.keyboard.press('ArrowDown');
  for(let i=fromY;i>Number(y);i--)await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
 }else{
  await board.locator('[data-cell-id="'+cell+'"]').click({button:'right'});
 }
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x',x,{timeout:35000});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y',y,{timeout:35000});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-walk-phase','idle',{timeout:30000});
}
for(const width of [390,1280])test('three original GLBs after authentic K-47 exploration '+width,async({page,browser})=>{
 test.setTimeout(210000);
 await page.setViewportSize({width,height:850});
 const payload=configs.map(item=>{
  const body=readFileSync(root+item.file),hash=createHash('sha256').update(body).digest('hex');
  return {...item,body,hash,url:base+item.id+'-'+hash.slice(0,16)+'.glb'};
 });
 const manifest={schemaVersion:1,scene:'meridian.surface',slots:payload.map(item=>({
  id:item.id,footprint:item.footprint,anchor:item.anchor,status:'published',
  asset:{url:item.url,bytes:item.body.length,sha256:item.hash,license:'original',
   source:'Original ShadowOps K-47 coherent research colony preview'}
 }))};
 await page.addInitScript(value=>{
  (window as typeof window&{__k47ArtPreviewManifest?:unknown}).__k47ArtPreviewManifest=value;
 },manifest);
 const count=new Map<string,number>();
 for(const asset of payload){
  count.set(asset.id,0);
  await page.route(asset.url,route=>{
   count.set(asset.id,(count.get(asset.id)??0)+1);
   return route.fulfill({status:200,body:asset.body,contentType:'model/gltf-binary',
    headers:{'access-control-allow-origin':'*'}});
  });
 }
 const board=await openGame(page),court=page.getByTestId('ground-landing-court-3d');
 await expect(court).toHaveAttribute('data-published-art-slots','3');
 // No test-only fog reveal: all facilities unlock via actual squad movement.
 for(const target of ['1,4','5,6','7,3','7,2','7,1','7,3'])await walk(page,target);
 await expect(court).toHaveAttribute('data-authored-art-ready',
  'south-industrial-shell west-archive-shell east-utilities-shell',{timeout:40000});
 await expect(court).toHaveAttribute('data-authored-art-state','ready');
 for(const asset of payload)expect(count.get(asset.id)).toBeGreaterThanOrEqual(1);
 await expect(page.getByTestId('ground-archive-volume-3d')).toHaveCSS('visibility','hidden');
 await expect(page.getByTestId('ground-south-industrial-wing')).toHaveCSS('opacity','0');
 await expect(board.getByTestId('ground-architecture-wall-8,2')).toHaveCSS('opacity','0');
 await expect(board.locator('[data-cell-id]')).toHaveCount(216);
 await board.screenshot({path:'test-results/k47-full-sector-after-follow-'+width+'.png'});
 await page.getByTestId('ground-camera-toggle').click();
 if(width<=520){
  await page.getByTestId('ground-map-sector').selectOption('west');
  await board.screenshot({path:'test-results/k47-full-sector-after-west-'+width+'.png'});
  await page.getByTestId('ground-map-sector').selectOption('all');
 }
 await expect(board).toHaveAttribute('viewBox','-72 0 1280 640');
 await board.screenshot({path:'test-results/k47-full-sector-after-overview-'+width+'.png'});
 await page.reload();
 await expect(court).toHaveAttribute('data-authored-art-ready',
  'south-industrial-shell west-archive-shell east-utilities-shell',{timeout:40000});
 const original=await browser.newContext({viewport:{width,height:850}});
 try{
  const baseline=await original.newPage(),oldBoard=await openGame(baseline);
  for(const target of ['1,4','5,6','7,3','7,2','7,1','7,3'])await walk(baseline,target);
  await expect(baseline.getByTestId('ground-landing-court-3d'))
   .toHaveAttribute('data-authored-art-state','unpublished');
  await oldBoard.screenshot({path:'test-results/k47-full-sector-before-follow-'+width+'.png'});
  await baseline.getByTestId('ground-camera-toggle').click();
   if(width<=520){
    await baseline.getByTestId('ground-map-sector').selectOption('west');
    await oldBoard.screenshot({path:'test-results/k47-full-sector-before-west-'+width+'.png'});
    await baseline.getByTestId('ground-map-sector').selectOption('all');
   }
   await expect(oldBoard).toHaveAttribute('viewBox','-72 0 1280 640');
  await oldBoard.screenshot({path:'test-results/k47-full-sector-before-overview-'+width+'.png'});
  await expect(oldBoard.locator('[data-cell-id]')).toHaveCount(216);
 }finally{await original.close();}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
