import {test,expect} from '@playwright/test';
import {replayCombatCommands} from '../src/isoScenarioCombatReplay';
import {isoSpriteSideFromCells} from '../src/isoActorFacing';

// Reduced motion skips traversal, not orientation: the *displayed* atlas
// must retain the final accepted movement bearing.
for(const width of [390,1280]){
 test(`reduced-motion tactical sprites face their real movement at ${width}px`,async({page})=>{
  test.setTimeout(80000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-play-combat').click();
  const canvas=page.getByTestId('scenario-render-canvas');
  await expect(canvas).toBeVisible();
  const grid=page.getByTestId('scenario-accessible-grid');
  await grid.locator('summary').click();
  await page.getByRole('button',{name:'Casilla 0:1',exact:true}).click();
  await expect(page.getByTestId('scenario-move')).toBeEnabled();
  await page.getByTestId('scenario-move').click();
  await expect(page.getByTestId('scenario-unit-science')).toContainText('0:1');
  await expect(canvas).toHaveAttribute('data-sprite-facing-science','left');
  await expect(canvas).toHaveAttribute('data-sprite-idle-uv-science','-1',{timeout:25000});
  await canvas.screenshot({path:`test-results/reduced-motion-faces-left-${width}.png`});
  await page.getByRole('button',{name:'Casilla 1:1',exact:true}).click();
  await expect(page.getByTestId('scenario-move')).toBeEnabled();
  await page.getByTestId('scenario-move').click();
  await expect(page.getByTestId('scenario-unit-science')).toContainText('1:1');
  await expect(canvas).toHaveAttribute('data-sprite-facing-science','right');
  await expect(canvas).toHaveAttribute('data-sprite-idle-uv-science','1');
  // An authoritative enemy end-turn uses the same direction rule.
  const before=replayCombatCommands('relay',[
   {type:'move',officer:'science',cell:'0:1'},
   {type:'move',officer:'science',cell:'1:1'},
  ]).combat.encounter.positions;
  const after=replayCombatCommands('relay',[
   {type:'move',officer:'science',cell:'0:1'},
   {type:'move',officer:'science',cell:'1:1'},
   {type:'end-turn'},
  ]).combat.encounter.positions;
  const moved=(['aegis','veil'] as const).filter(id=>before[id]!==after[id]);
  expect(moved.length).toBeGreaterThan(0);
  await page.getByTestId('scenario-end-turn').click();
  for(const id of moved){
   const side=isoSpriteSideFromCells(before[id],after[id]);
   expect(side).not.toBeNull();
   await expect(canvas).toHaveAttribute('data-sprite-facing-'+id,side!);
   await expect(canvas).toHaveAttribute('data-hostile-idle-uv-'+id,
    String(side==='left'?-1/3:1/3),{timeout:25000});
  }
  await canvas.screenshot({path:`test-results/reduced-motion-hostile-facing-${width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
