import {expect,test,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

// Playwright executes this file in Node ESM (not Vite's JSON loader): read
// the same canonical authored map as data without importing JSON as a module.
const world=JSON.parse(readFileSync(
 new URL('../../content/scenes/meridian.json',import.meta.url),'utf8')) as {
 scenes:{surface:{walls:Array<{x:number;y:number}>}};
};

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
   test.setTimeout(220000);
   page.setDefaultTimeout(15000);
   await page.setViewportSize({width,height:850});
   const board=await land(page);
   const wall=page.getByTestId('ground-north-industrial-retaining');
   await expect(wall).toHaveAttribute('pointer-events','none');
   await expect(wall).toHaveAttribute('data-wall-row','0');
   await moveToNorth(page);
   // Discover one continuous physical northern wall by walking the real
   // open y=1 corridor, then return east. The western bays must be remembered
   // while the eastern bays are visibly lit: never dim the entire facade
   // because one cell of its previously explored span is outside LOS.
   const northUnit=page.getByTestId('ground-unit-venn');
   await page.getByTestId('ground-move-mode').click();
   await board.focus();
   for(let i=0;i<6;i++)await page.keyboard.press('ArrowLeft');
   await page.keyboard.press('Enter');
   await expect(northUnit).toHaveAttribute('data-grid-x','1',{timeout:35000});
   await expect(northUnit).toHaveAttribute('data-grid-y','1',{timeout:35000});
   await expect(northUnit).toHaveAttribute('data-walk-phase','idle',{timeout:35000});
   const bayMaterials=()=>board.locator('[data-testid^="ground-north-bay-"]')
     .evaluateAll(nodes=>nodes.map(node=>({
       id:node.getAttribute('data-testid'),
       panel:node.querySelectorAll('path')[1]?.getAttribute('fill'),
       lamp:Boolean(node.querySelector('circle')),
     })).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
   const paintAtWest=await bayMaterials();
   await moveToNorth(page);
   // Fog alone must not reshuffle physical bay paint or amber light placement.
   expect(await bayMaterials()).toEqual(paintAtWest);
   const partitioned=await board.locator(
     '[data-testid^="ground-north-retaining-span-"]').evaluateAll(nodes=>
     nodes.map(node=>({
       fog:node.getAttribute('data-fog'),
       cells:(node.getAttribute('data-footprint')||'').split(' ').filter(Boolean),
     })));
   expect(partitioned.some(span=>span.fog==='visible')).toBe(true);
   expect(partitioned.some(span=>span.fog==='remembered')).toBe(true);
   expect(new Set(partitioned.flatMap(span=>span.cells)).size)
     .toBe(partitioned.reduce((total,span)=>total+span.cells.length,0));
   for(const span of partitioned){
     for(const cell of span.cells){
       const fogCell=board.locator('[data-fog-cell="'+cell+'"]');
       if(span.fog==='remembered')
         await expect(fogCell).toHaveAttribute('data-fog-state','remembered');
       else
         await expect(fogCell).toHaveCount(0);
     }
   }
   await page.screenshot({
     path:'test-results/k47-north-industrial-mixed-fog-after-'+width+'.png'});
   // Visual counterfactual: restore the old ALL-dark façade when any of its
   // previously discovered cells falls outside LOS. Geometry/camera/selection
   // are otherwise unchanged; this CSS override is removed immediately.
   const oldAllDark=await page.addStyleTag({content:
     '[data-testid="ground-north-industrial-retaining"] [data-fog="visible"]'+
     '{opacity:.91!important;filter:brightness(.51) saturate(.6) contrast(1.1)!important}'});
   await page.screenshot({
     path:'test-results/k47-north-industrial-mixed-fog-before-'+width+'.png'});
   await oldAllDark.evaluate(node=>node.remove());
   await expect(board.locator(
     '[data-testid^="ground-north-retaining-span-"][data-fog="visible"]').first())
     .toHaveCSS('opacity','1');
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

   // Recede just four actual cells south (7,1 -> 7,4): the physical
   // north wall falls outside canonical LOS but remains IN the closer mobile
   // follow camera. Without this stop, a mobile picture at 5,6 sees zero
   // wall pixels and cannot establish a meaningful visual before/after.
   await page.getByTestId('ground-move-mode').click();
   await board.focus();
   for(let i=0;i<3;i++)await page.keyboard.press('ArrowDown');
   await page.keyboard.press('Enter');
   const near=page.getByTestId('ground-unit-venn');
   await expect(near).toHaveAttribute('data-grid-x','7',{timeout:35000});
   await expect(near).toHaveAttribute('data-grid-y','4',{timeout:35000});
   await expect(near).toHaveAttribute('data-walk-phase','idle',{timeout:35000});
   const nearRemembered=board.locator(
     '[data-testid^="ground-north-retaining-span-"][data-fog="remembered"]');
   await expect.poll(()=>nearRemembered.count()).toBeGreaterThan(0);
   await expect(nearRemembered.first()).toHaveCSS('opacity','0.91');
   const nearCamera=await board.getAttribute('viewBox');
   await page.screenshot({
     path:'test-results/k47-north-industrial-memory-after-near-'+width+'.png'});
   const oldNear=await page.addStyleTag({content:
     '[data-testid="ground-north-industrial-retaining"] '+
     '[data-fog="remembered"]{opacity:.68!important;filter:none!important}'});
   await page.screenshot({
     path:'test-results/k47-north-industrial-memory-before-near-'+width+'.png'});
   await oldNear.evaluate(node=>node.remove());
   await expect(board).toHaveAttribute('viewBox',nearCamera!);
   await expect(nearRemembered.first()).toHaveCSS('opacity','0.91');

   // Continue to 5,6 to check that remembered structures remain correct
   // even when the default mobile camera no longer displays their pixels.
   await page.getByTestId('ground-move-mode').click();
   await board.focus();
   for(let i=0;i<2;i++)await page.keyboard.press('ArrowLeft');
   for(let i=0;i<2;i++)await page.keyboard.press('ArrowDown');
   await page.keyboard.press('Enter');
   const venn=page.getByTestId('ground-unit-venn');
   await expect(venn).toHaveAttribute('data-grid-x','5',{timeout:35000});
   await expect(venn).toHaveAttribute('data-grid-y','6',{timeout:35000});
   await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:35000});
   const remembered=board.locator(
     '[data-testid^="ground-north-retaining-span-"][data-fog="remembered"]');
   await expect.poll(()=>remembered.count()).toBeGreaterThan(0);
   await expect(remembered.first()).toHaveCSS('opacity','0.91');
   const fogPaint=await remembered.first().evaluate(node=>({
     filter:getComputedStyle(node).filter,
     pointerEvents:getComputedStyle(node).pointerEvents,
   }));
   expect(fogPaint.filter).toContain('brightness(0.51)');
   expect(fogPaint.filter).toContain('saturate(0.6)');
   expect(fogPaint.pointerEvents).toBe('none');
   await expect(board.locator('[data-fog-cell="16,10"]'))
     .toHaveAttribute('data-fog-state','unknown');
   await expect(board.locator('[data-cell-id]')).toHaveCount(216);
   const originalCamera=await board.getAttribute('viewBox');

   // Exact Chromium same-frame A/B: recover the old semitransparent
   // remembered styling in CSS only; never mutate the game or fog.
   await page.screenshot({
     path:'test-results/k47-north-industrial-memory-after-follow-'+width+'.png'});
   const oldMemory=await page.addStyleTag({content:
     '[data-testid="ground-north-industrial-retaining"] '+
     '[data-fog="remembered"]{opacity:.68!important;filter:none!important}'});
   await expect(remembered.first()).toHaveCSS('opacity','0.68');
   await page.screenshot({
     path:'test-results/k47-north-industrial-memory-before-follow-'+width+'.png'});
   await oldMemory.evaluate(node=>node.remove());
   await expect(remembered.first()).toHaveCSS('opacity','0.91');
   await expect(board).toHaveAttribute('viewBox',originalCamera!);

   // The mobile sector inspector can actually show the already discovered
   // northern span at useful size; desktop uses its real full-map viewport.
   await page.getByTestId('ground-camera-toggle').click();
   if(width<=520)await page.getByTestId('ground-map-sector').selectOption('west');
   else await expect(board).toHaveAttribute('viewBox','-72 0 1280 640');
   const overviewCamera=await board.getAttribute('viewBox');
   await page.screenshot({
     path:'test-results/k47-north-industrial-memory-after-overview-'+width+'.png'});
   const oldOverview=await page.addStyleTag({content:
     '[data-testid="ground-north-industrial-retaining"] '+
     '[data-fog="remembered"]{opacity:.68!important;filter:none!important}'});
   await page.screenshot({
     path:'test-results/k47-north-industrial-memory-before-overview-'+width+'.png'});
   await oldOverview.evaluate(node=>node.remove());
   await expect(board).toHaveAttribute('viewBox',overviewCamera!);
   await expect(remembered.first()).toHaveCSS('opacity','0.91');

   await page.reload();
   await expect(page.getByTestId('ground-unit-venn'))
     .toHaveAttribute('data-grid-x','5');
   await expect(page.getByTestId('ground-unit-venn'))
     .toHaveAttribute('data-grid-y','6');
   await expect(page.getByTestId('ground-squad-board').locator(
     '[data-testid^="ground-north-retaining-span-"][data-fog="remembered"]')
     .first()).toHaveCSS('opacity','0.91');
   await expect(page.getByTestId('ground-squad-board').locator('[data-cell-id]'))
     .toHaveCount(216);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
     .toBe(true);
  });
}
