import {expect,test,type Page} from '@playwright/test';
import world from '../../content/scenes/meridian.json';

// Authentic away-team exploration only: no artificial fog reveal, teleport,
// added level geometry or click-math overrides. Every visible structure must
// be backed by a physical canonical BLOCKED wall cell.
test.use({storageState:{cookies:[],origins:[]}});
const blocked=new Set(world.scenes.surface.walls.map(c=>c.x+','+c.y));

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 const board=page.getByTestId('ground-squad-board');
 await expect(board).toBeVisible();
 await expect(board.locator('[data-cell-id]')).toHaveCount(216);
 return board;
}
async function moveToNorth(page:Page){
 const unit=page.getByTestId('ground-unit-venn');
 const board=page.getByTestId('ground-squad-board');
 await page.getByTestId('ground-move-mode').click();
 await board.focus();
 const x=Number(await unit.getAttribute('data-grid-x'));
 const y=Number(await unit.getAttribute('data-grid-y'));
 for(let i=x;i<7;i++)await page.keyboard.press('ArrowRight');
 for(let i=x;i>7;i--)await page.keyboard.press('ArrowLeft');
 for(let i=y;i>1;i--)await page.keyboard.press('ArrowUp');
 for(let i=y;i<1;i++)await page.keyboard.press('ArrowDown');
 await page.keyboard.press('Enter');
 await expect(unit).toHaveAttribute('data-grid-x','7',{timeout:35000});
 await expect(unit).toHaveAttribute('data-grid-y','1',{timeout:35000});
 await expect(unit).toHaveAttribute('data-walk-phase','idle',{timeout:35000});
}

for(const width of [390,1280]){
 test('north industrial wall is real, discovered, unpickable and retained '+width,
  async({page})=>{
   test.setTimeout(170000);
   page.setDefaultTimeout(15000);
   await page.setViewportSize({width,height:850});
   const board=await land(page);
   const wall=page.getByTestId('ground-north-industrial-retaining');
   await expect(wall).toHaveAttribute('pointer-events','none');
   await expect(wall).toHaveAttribute('data-wall-row','0');
   await moveToNorth(page);
   const spans=board.locator('[data-testid^="ground-north-retaining-span-"]');
   await expect.poll(()=>spans.count()).toBeGreaterThan(0);
   const footprint=await spans.evaluateAll(nodes=>nodes.flatMap(n=>
    (n.getAttribute('data-footprint')||'').split(' ').filter(Boolean)));
   expect(footprint.length).toBeGreaterThan(0);
   for(const id of footprint){
    expect(blocked.has(id),'visible structure on actual blocked wall '+id).toBe(true);
    expect(id.endsWith(',0'),'northern real wall row '+id).toBe(true);
    // No unknown tile may be exposed merely by a painted parapet.
    await expect(board.locator('[data-fog-cell="'+id+'"][data-fog-state="unknown"]'))
      .toHaveCount(0);
   }
   await expect(board.locator('[data-cell-id]')).toHaveCount(216);
   await page.screenshot({path:'test-results/k47-north-industrial-after-'+width+'.png'});
   // Exactly same real frame with the new visual component hidden: useful
   // Chrome A/B without changing mission state, selection, camera or fog.
   const legacy=await page.addStyleTag({content:
    '[data-testid="ground-north-industrial-retaining"]{display:none!important}'});
   await expect(wall).toHaveCSS('display','none');
   await page.screenshot({path:'test-results/k47-north-industrial-before-'+width+'.png'});
   await legacy.evaluate(node=>node.remove());
   await expect(wall).not.toHaveCSS('display','none');
   await page.reload();
   await expect(page.getByTestId('ground-unit-venn'))
     .toHaveAttribute('data-grid-x','7');
   await expect(page.getByTestId('ground-unit-venn'))
     .toHaveAttribute('data-grid-y','1');
   await expect(page.getByTestId('ground-squad-board').locator('[data-cell-id]'))
     .toHaveCount(216);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
     .toBe(true);
  });
}
