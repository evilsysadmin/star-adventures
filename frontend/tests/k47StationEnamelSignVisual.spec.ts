import {expect,test,type Page} from '@playwright/test';

// Screenshot the actual K-47 scene, never a recreated mock. A single
// temporary CSS counterfactual restores the prior gold-card materials on
// the EXACT SAME mission/camera/frame; no teleport, fog reveal or state edits.
test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 const board=page.getByTestId('ground-squad-board');
 await expect(board).toBeVisible();
 await expect(board.locator('polygon[data-cell-id]')).toHaveCount(216);
 await expect(page.getByTestId('ground-landing-court-3d'))
  .toHaveAttribute('data-renderer-state','ready',{timeout:25000});
 return board;
}

const originalStyles=`
  [data-testid^="ground-waypoint-metal-face-"]{
    fill:#111c24!important;fill-opacity:.96!important;
    stroke:#ebc775!important;stroke-width:1.5px!important;rx:3px!important
  }
  [data-testid^="ground-waypoint-metal-finish-"]{display:none!important}
  .ground-landmark-name{fill:#ffe6a9!important;letter-spacing:.55px!important}
  [data-testid^="ground-waypoint-label-"] > path{
    fill:#111c24!important;stroke:#ebc775!important;stroke-width:1px!important
  }`;

async function compareSameFrame(page:Page,width:number,phase:string){
 // The original blocked station positions, fog and readable full captions
 // are authoritative. Nothing in this A/B changes real player state.
 const board=page.getByTestId('ground-squad-board');
 const camera=await board.getAttribute('viewBox');
 const names:{[key:string]:string}={
  'sensor-vault':'ARCHIVO',probe:'SONDA','relief-point':'SOCORRO',
  'perimeter-uplink':'BALIZA','beam-out':'EXTRACCIÓN',
 };
 for(const [id,name] of Object.entries(names)){
  const label=page.getByTestId('ground-waypoint-label-'+id);
  const face=page.getByTestId('ground-waypoint-metal-face-'+id);
  const finish=page.getByTestId('ground-waypoint-metal-finish-'+id);
  await expect(label).toHaveAttribute('pointer-events','none');
  await expect(label.locator('text.ground-landmark-name')).toHaveText(name);
  await expect(face).toHaveAttribute('fill','#1c343b');
  await expect(finish).toHaveCount(1);
 }
 const before=await board.evaluate(root=>
  [...root.querySelectorAll('polygon[data-cell-id]')].map(n=>n.getAttribute('data-cell-id')));
 await page.screenshot({path:'test-results/k47-station-enamel-'+phase+'-'+width+'.png'});
 const style=await page.addStyleTag({content:originalStyles});
 await expect(page.getByTestId('ground-waypoint-metal-finish-beam-out'))
  .toHaveCSS('display','none');
 await page.screenshot({path:'test-results/k47-station-gold-card-'+phase+'-'+width+'.png'});
 await style.evaluate(node=>node.remove());
 await expect(page.getByTestId('ground-waypoint-metal-finish-beam-out'))
  .not.toHaveCSS('display','none');
 await expect(board).toHaveAttribute('viewBox',camera!);
 const after=await board.evaluate(root=>
  [...root.querySelectorAll('polygon[data-cell-id]')].map(n=>n.getAttribute('data-cell-id')));
 expect(after).toEqual(before);
 await expect(page.getByTestId('ground-landmark-beam-out')).toHaveAttribute('pointer-events','none');
}

for(const width of [390,1280]){
 test('mounted mission wayfinding replaces gold HUD cards at '+width,async({page})=>{
  test.setTimeout(140000);
  await page.setViewportSize({width,height:850});
  const board=await land(page);
  await compareSameFrame(page,width,'landing');
  // Actual squad order, no injected explored cells or mocked positions.
  await board.locator('[data-cell-id="5,6"]').click({button:'right'});
  const venn=page.getByTestId('ground-unit-venn');
  await expect(venn).toHaveAttribute('data-grid-x','5',{timeout:30000});
  await expect(venn).toHaveAttribute('data-grid-y','6',{timeout:30000});
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:30000});
  await compareSameFrame(page,width,'follow');
  await page.reload();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','6');
  await expect(page.getByTestId('ground-squad-board')
   .locator('polygon[data-cell-id]')).toHaveCount(216);
  expect(await page.evaluate(()=>
   document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
