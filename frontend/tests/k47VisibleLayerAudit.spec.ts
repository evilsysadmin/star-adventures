import {expect,test,type Page} from '@playwright/test';

// Isolate one authentic K-47 rendered layer at a time in the ACTUAL game.
// This is QA instrumentation only: it never invents terrain, mutates
// mission state, cheats fog, hides a real control or alters production art.
test.use({storageState:{cookies:[],origins:[]}});

async function followRealSquad(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 const board=page.getByTestId('ground-squad-board');
 await expect(board).toBeVisible();
 await expect(page.getByTestId('ground-landing-court-3d'))
   .toHaveAttribute('data-renderer-state','ready',{timeout:25000});
 await board.locator('[data-cell-id="5,6"]').click({button:'right'});
 const officer=page.getByTestId('ground-unit-venn');
 await expect(officer).toHaveAttribute('data-grid-x','5',{timeout:30000});
 await expect(officer).toHaveAttribute('data-grid-y','6',{timeout:30000});
 await expect(officer).toHaveAttribute('data-walk-phase','idle',{timeout:30000});
 await expect(board.locator('[data-cell-id]')).toHaveCount(216);
 return board;
}

const layers=[
 {name:'stations',id:'ground-outpost-landmarks'},
 {name:'svg-buildings',id:'ground-colony-walls'},
 {name:'factory',id:'ground-south-industrial-wing'},
 {name:'fixtures',id:'ground-colony-fixtures'},
 {name:'webgl-buildings',id:'ground-landing-court-3d'},
 {name:'room-deck',id:'ground-bay-platform-overlay'},
 {name:'ground-floor',id:'ground-colony-floor'},
] as const;

for(const width of [390,1280])test('identify actual central K-47 layer occlusion '+width,
 async({page})=>{
  test.setTimeout(150000);
  await page.setViewportSize({width,height:850});
  const board=await followRealSquad(page);
  // The actual previously over-tall BALIZA is still the same discovered
  // blocked station and remains reachable through the original mission
  // model; only its decorative mast is shortened and enclosed.
  const beacon=board.getByTestId('ground-perimeter-uplink-compact');
  await expect(beacon).toHaveCount(1);
  await expect(beacon).toHaveAttribute('data-station-footprint','7,5');
  await expect(beacon).toHaveAttribute('data-mast-top','-81');
  await expect(beacon).toHaveAttribute('pointer-events','none');
  await expect(board.getByTestId('ground-landmark-perimeter-uplink'))
    .toHaveCount(1);
  const initialCamera=await board.getAttribute('viewBox');
  const initialArt=await page.getByTestId('ground-landing-court-3d')
   .getAttribute('data-authored-art-ready');
  await page.screenshot({path:'test-results/k47-layer-trace-baseline-'+width+'.png'});
  for(const item of layers){
   const layer=page.getByTestId(item.id);
   await expect(layer).toHaveCount(1);
   const style=await page.addStyleTag({content:
     '[data-testid="'+item.id+'"]{display:none!important}'});
   await expect(layer).toHaveCSS('display','none');
   await page.screenshot({path:'test-results/k47-layer-trace-without-'+
     item.name+'-'+width+'.png'});
   await style.evaluate(el=>el.remove());
   await expect(layer).not.toHaveCSS('display','none');
   await expect(board).toHaveAttribute('viewBox',initialCamera!);
   await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  }
  await expect(page.getByTestId('ground-landing-court-3d'))
   .toHaveAttribute('data-authored-art-ready',initialArt!);
  // At initial squad follow the beacon can be outside a 390px camera.
  // Walk the REAL officer one step farther into the original west/east
  // access corridor so the compact BALIZA is actually visible on mobile.
  // This exercises the genuine move cursor and blocked-neighbor routing.
  await page.getByTestId('ground-move-mode').click();
  await board.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const officer=page.getByTestId('ground-unit-venn');
  await expect(officer).toHaveAttribute('data-grid-x','7',{timeout:30000});
  await expect(officer).toHaveAttribute('data-grid-y','6',{timeout:30000});
  await expect(officer).toHaveAttribute('data-walk-phase','idle',{timeout:30000});
  await expect(beacon).toHaveCount(1);
  await page.screenshot({path:'test-results/k47-beacon-near-'+width+'.png'});
  await page.reload();
  await expect(page.getByTestId('ground-unit-venn'))
   .toHaveAttribute('data-grid-x','7');
  await expect(page.getByTestId('ground-unit-venn'))
   .toHaveAttribute('data-grid-y','6');
  await expect(page.getByTestId('ground-squad-board')
   .locator('[data-cell-id]')).toHaveCount(216);
 });
