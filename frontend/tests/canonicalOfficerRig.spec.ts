import { test, expect } from '@playwright/test';

test('canonical officer has real articulated walk, fire, hit and continuous 3D facing', async ({page}) => {
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {createTacticalOfficerRig}=await import('/src/tacticalOfficerRig.ts');
  const rig=createTacticalOfficerRig('#e7c47d');
  const limbs=rig.root.getObjectByName('canonical-security-officer')?.children[0]?.children
   .filter(child=>child.type==='Group')??[];
  const foot=rig.root.position.y;
  rig.face(Math.PI/2);
  rig.pose('walk',Math.PI/22);
  const walk=limbs.map(limb=>limb.rotation.x);
  rig.pose('fire',0);
  const fire=limbs.map(limb=>limb.rotation.x);
  rig.pose('hit',0);
  const hit=rig.root.children[0].rotation.z;
  rig.pose('idle',0);
  const idle=limbs.map(limb=>limb.rotation.x);
  return {foot,heading:rig.root.rotation.y,walk,fire,hit,idle,parts:rig.root.children[0].children.length};
 });
 expect(result.foot).toBe(0);
 expect(result.heading).toBeCloseTo(Math.PI/2,6);
 expect(result.parts).toBeGreaterThan(8);
 expect(result.walk.some(value=>Math.abs(value)>.1)).toBe(true);
 expect(result.fire.some(value=>value< -1)).toBe(true);
 expect(result.hit).toBeGreaterThan(.1);
 expect(result.idle.every(value=>value===0)).toBe(true);
});

for(const width of [390,1280]){
 test(`security officer is a genuine 3D actor during a playable move at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-tab-relay').click();
  const canvas=page.getByTestId('scenario-render-canvas');
  await expect(canvas).toHaveAttribute('data-security-rig','articulated-3d');
  await page.getByTestId('scenario-unit-security').click();
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();
  await page.getByRole('button',{name:'Casilla 2:4'}).click();
  await expect(page.getByTestId('scenario-move')).toBeEnabled();
  await page.getByTestId('scenario-move').click();
  await expect(page.getByTestId('scenario-unit-security')).toContainText('2:4');
  await expect(canvas).toHaveAttribute('data-squad-moving','0',{timeout:6000});
  await expect(canvas).toHaveAttribute('data-security-heading',/^[0-9.\-]+$/);
  await canvas.screenshot({path:`test-results/canonical-security-3d-${width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
