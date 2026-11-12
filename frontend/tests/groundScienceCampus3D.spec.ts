import {expect,test} from '@playwright/test';
import * as THREE from 'three';
import {addScienceWing3D} from '../src/groundVisual/ScienceWing3D';
test.use({storageState:{cookies:[],origins:[]}});
test('replacement architecture fits the real three-cell blocked footprint',()=>{
 const scene=new THREE.Scene(),dispose=addScienceWing3D(scene);
 const root=scene.getObjectByName('modular-k47-science-wing') as THREE.Group;
 expect(root.userData.blockedFootprint).toBe('2,2 3,2 4,2');
 expect(root.userData.meshCount).toBeGreaterThan(45);
 const bounds=new THREE.Box3().setFromObject(root);
 expect(bounds.min.x).toBeGreaterThanOrEqual(1.5);
 expect(bounds.max.x).toBeLessThanOrEqual(4.5);
 expect(bounds.min.z).toBeGreaterThanOrEqual(1.5);
 expect(bounds.max.z).toBeLessThanOrEqual(2.5);
 dispose();expect(scene.children).toHaveLength(0);
});
for(const width of [390,1280]){
 test('real squad reveals replacement facility with full interaction rollback '+width,async({page})=>{
  test.setTimeout(125000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
  await page.getByTestId('captain-transport').click({timeout:25000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  const court=page.getByTestId('ground-landing-court-3d');
  await expect(court).toHaveAttribute('data-renderer-state','ready',{timeout:20000});
  await board.locator('[data-cell-id="2,4"]').click({button:'right'});
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-walk-phase','idle',{timeout:26000});
  await expect(court).toHaveAttribute('data-science-wing-ready','true',{timeout:20000});
  await expect(page.getByTestId('ground-science-campus')).toHaveCSS('visibility','hidden');
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  for(const cell of ['2,2','3,2','4,2'])
   await expect(board.locator('[data-fog-cell="'+cell+'"][data-fog-state="unknown"]')).toHaveCount(0);
  await expect(page.getByTestId('ground-landmark-sensor-vault')).toHaveCount(1);
  await expect(page.getByTestId('ground-landmark-probe')).toHaveCount(1);
  await board.screenshot({path:'test-results/k47-science-wing-'+width+'.png'});
  await page.reload();
  await expect(court).toHaveAttribute('data-science-wing-ready','true',{timeout:20000});
  await expect(page.getByTestId('ground-science-campus')).toHaveCSS('visibility','hidden');
 });
}
test('WebGL failure keeps original science campus and real movement',async({page})=>{
 test.setTimeout(110000);
 await page.setViewportSize({width:390,height:850});
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(id,...args){
   if(String(id).startsWith('webgl'))return null;
   return (original as (...values:unknown[])=>unknown).call(this,id,...args);
  } as typeof original;
 });
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 const board=page.getByTestId('ground-squad-board');
 await board.locator('[data-cell-id="2,4"]').click({button:'right'});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
 await expect(page.getByTestId('ground-landing-court-3d')).toHaveAttribute('data-science-wing-ready','false');
 await expect(page.getByTestId('ground-science-campus')).toHaveCSS('visibility','visible');
});
