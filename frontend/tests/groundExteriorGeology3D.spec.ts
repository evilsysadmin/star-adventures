import {expect,test,type Page} from '@playwright/test';
import * as THREE from 'three';
import {addK47ExteriorGeology3D,OUTER_GEOMETRY_VERSION,
 isOutsideK47} from '../src/groundVisual/ExteriorGeology3D';
test.use({storageState:{cookies:[],origins:[]}});

test('all outside canyon geometry stays beyond canonical playable 18x12 grid',()=>{
 const scene=new THREE.Scene(),dispose=addK47ExteriorGeology3D(scene);
 const root=scene.getObjectByName(OUTER_GEOMETRY_VERSION) as THREE.Group;
 expect(root.userData.nonPlayable).toBe(true);
 expect(root.userData.terrainStrips).toBe(4);
 expect(root.userData.terrainVertices).toBeGreaterThan(2000);
 expect(root.userData.rockInstances).toBe(240);
 let triangles=0,checked=0;
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  if(object instanceof THREE.InstancedMesh){
   expect(object.count).toBe(240);
   const m=new THREE.Matrix4(),p=new THREE.Vector3();
   for(let i=0;i<object.count;i++){
    object.getMatrixAt(i,m);p.setFromMatrixPosition(m);
    expect(isOutsideK47(p.x,p.z)).toBe(true);
   }
   return;
  }
  const position=object.geometry.getAttribute('position');
  for(let k=0;k<position.count;k++){
   expect(isOutsideK47(position.getX(k),position.getZ(k))).toBe(true);
   checked++;
  }
  triangles+=(object.geometry.index?.count??0)/3;
 });
 expect(checked).toBeGreaterThan(2000);
 expect(triangles).toBeLessThan(8000);
 expect(scene.children).toHaveLength(1);
 dispose();expect(scene.children).toHaveLength(0);
});
async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click({timeout:25000});
 await page.getByTestId('transport-confirm').click();
 const board=page.getByTestId('ground-squad-board');
 const court=page.getByTestId('ground-landing-court-3d');
 await expect(court).toHaveAttribute('data-renderer-state','ready',{timeout:25000});
 await board.locator('[data-cell-id="5,6"]').click({button:'right'});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','6');
 await expect(page.getByTestId('ground-unit-venn'))
  .toHaveAttribute('data-walk-phase','idle',{timeout:30000});
 return board;
}
for(const width of [390,1280]){
 test('real K-47 outer canyon versus identical no-art baseline '+width,async({page,browser})=>{
  test.setTimeout(135000);
  await page.setViewportSize({width,height:850});
  const board=await land(page);
  await expect(page.getByTestId('ground-landing-court-3d'))
   .toHaveAttribute('data-exterior-geology-version',OUTER_GEOMETRY_VERSION);
  expect(await board.locator('[data-cell-id]').count()).toBe(216);
  const unknown=await board.locator('[data-fog-state="unknown"]').count();
  await board.screenshot({path:'test-results/k47-canyon-follow-after-'+width+'.png'});
  await page.getByTestId('ground-camera-toggle').click();
  await board.screenshot({path:'test-results/k47-canyon-overview-after-'+width+'.png'});
  await page.getByTestId('ground-camera-toggle').click();
  await page.reload();
  await expect(page.getByTestId('ground-landing-court-3d'))
   .toHaveAttribute('data-renderer-state','ready',{timeout:25000});
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','6');
  expect(await board.locator('[data-fog-state="unknown"]').count()).toBe(unknown);
  const original=await browser.newContext({viewport:{width,height:850}});
  try{
   await original.addInitScript(()=>{
    (window as typeof window & {__k47DisableExteriorArt?:boolean})
     .__k47DisableExteriorArt=true;
   });
   const before=await original.newPage();
   const originalBoard=await land(before);
   await originalBoard.screenshot({
    path:'test-results/k47-canyon-follow-before-'+width+'.png'});
   await before.getByTestId('ground-camera-toggle').click();
   await originalBoard.screenshot({
    path:'test-results/k47-canyon-overview-before-'+width+'.png'});
   expect(await originalBoard.locator('[data-fog-state="unknown"]').count())
    .toBe(unknown);
   expect(await originalBoard.locator('[data-cell-id]').count()).toBe(216);
  }finally{await original.close();}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   .toBe(true);
 });
}
test('WebGL rejection keeps complete SVG ground and valid squad movement',async({page})=>{
 test.setTimeout(110000);
 await page.setViewportSize({width:390,height:850});
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(kind,...args){
   if(String(kind).startsWith('webgl'))return null;
   return (original as (...items:unknown[])=>unknown).call(this,kind,...args);
  } as typeof original;
 });
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 await expect(page.getByTestId('ground-landing-court-3d'))
  .toHaveAttribute('data-renderer-state','fallback');
 const board=page.getByTestId('ground-squad-board');
 await expect(board.locator('[data-cell-id]')).toHaveCount(216);
 await board.locator('[data-cell-id="5,6"]').click({button:'right'});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','6');
 await expect(page.getByTestId('ground-planet-backdrop')).toHaveCount(1);
});
