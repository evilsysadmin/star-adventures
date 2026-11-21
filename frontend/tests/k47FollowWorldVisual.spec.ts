import {expect,test,type Page} from '@playwright/test';

// Same physical surface, same commander, same save: only the follow camera
// changes its center toward genuinely visible walkable terrain.
test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 const board=page.getByTestId('ground-squad-board');
 await expect(board).toBeVisible();
 return board;
}
async function walkNorth(page:Page){
 const board=page.getByTestId('ground-squad-board');
 const officer=page.getByTestId('ground-unit-venn');
 await page.getByTestId('ground-move-mode').click();
 await board.focus();
 const x=Number(await officer.getAttribute('data-grid-x'));
 const y=Number(await officer.getAttribute('data-grid-y'));
 for(let i=x;i<7;i++)await page.keyboard.press('ArrowRight');
 for(let i=x;i>7;i--)await page.keyboard.press('ArrowLeft');
 for(let i=y;i>1;i--)await page.keyboard.press('ArrowUp');
 for(let i=y;i<1;i++)await page.keyboard.press('ArrowDown');
 await page.keyboard.press('Enter');
 await expect(officer).toHaveAttribute('data-grid-x','7',{timeout:35000});
 await expect(officer).toHaveAttribute('data-grid-y','1',{timeout:35000});
 await expect(officer).toHaveAttribute('data-walk-phase','idle',{timeout:35000});
}

for(const width of [390,1280]){
 test('real explored colony shifts into follow frame while officer remains pickable '+width,
 async({page})=>{
  test.setTimeout(140000);
  page.setDefaultTimeout(16000);
  await page.setViewportSize({width,height:850});
  const board=await land(page);
  await walkNorth(page);
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  await expect(board.locator('[data-fog-cell="16,10"]'))
    .toHaveAttribute('data-fog-state','unknown');
  const camera=async()=>board.evaluate(el=>{
   const svg=el as SVGSVGElement;
   const frame=svg.getBoundingClientRect(),view=svg.viewBox.baseVal;
   const officer=svg.querySelector('[data-testid="ground-unit-venn"]')!
     .getBoundingClientRect();
   return {x:view.x,y:view.y,width:view.width,height:view.height,
    officerCenter:(officer.left+officer.right)/2,
    officerBottom:officer.bottom,frameLeft:frame.left,frameRight:frame.right,
    frameBottom:frame.bottom};
  });
  const improved=await camera();
  await page.screenshot({path:'test-results/k47-follow-world-after-'+width+'.png'});
  // Development-only comparison. The actual mission, officer and map never
  // change; the original leader-only follow is restored for one exact frame.
  await page.evaluate(()=>{
   (window as Window&{__k47LegacyFollowFraming?:boolean})
     .__k47LegacyFollowFraming=true;
  });
  await page.getByTestId('ground-camera-toggle').click();
  await page.getByTestId('ground-camera-toggle').click();
  const legacy=await camera();
  await page.screenshot({path:'test-results/k47-follow-world-before-'+width+'.png'});
  expect(improved.x).toBeLessThan(legacy.x-5);
  expect(improved.y).toBe(legacy.y);
  expect(improved.width).toBe(legacy.width);
  expect(improved.height).toBe(legacy.height);
  const maxShift=width<=520?29:91;
  expect(legacy.x-improved.x).toBeLessThanOrEqual(maxShift);
  expect(improved.officerCenter).toBeGreaterThan(improved.frameLeft+width*.2);
  expect(improved.officerCenter).toBeLessThan(improved.frameRight-width*.15);

  // Restore the new camera by a normal view toggle, then issue a REAL order
  // using the original 216 SVG hit cells and persist it through F5.
  await page.evaluate(()=>{
   (window as Window&{__k47LegacyFollowFraming?:boolean})
     .__k47LegacyFollowFraming=false;
  });
  await page.getByTestId('ground-camera-toggle').click();
  await page.getByTestId('ground-camera-toggle').click();
  await expect.poll(async()=> (await camera()).x).toBe(improved.x);
  await board.locator('[data-cell-id="7,2"]').click({button:'right'});
  await expect(page.getByTestId('ground-unit-venn'))
    .toHaveAttribute('data-grid-y','2',{timeout:35000});
  await expect(page.getByTestId('ground-unit-venn'))
    .toHaveAttribute('data-walk-phase','idle',{timeout:35000});
  await page.reload();
  await expect(page.getByTestId('ground-unit-venn'))
    .toHaveAttribute('data-grid-y','2');
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  await expect(board.locator('[data-fog-cell="16,10"]'))
    .toHaveAttribute('data-fog-state','unknown');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    .toBe(true);
 });
}
