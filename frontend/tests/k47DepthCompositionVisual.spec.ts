import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls'))
   .toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click({timeout:25000});
 await page.getByTestId('transport-confirm').click();
 const board=page.getByTestId('ground-squad-board');
 await expect(board).toBeVisible();
 await expect(page.getByTestId('ground-landing-court-3d'))
   .toHaveAttribute('data-renderer-state','ready',{timeout:25000});
 return board;
}
async function approach(page:Page){
 const board=page.getByTestId('ground-squad-board');
 await board.locator('[data-cell-id="5,6"]').click({button:'right'});
 const venn=page.getByTestId('ground-unit-venn');
 await expect(venn).toHaveAttribute('data-grid-x','5');
 await expect(venn).toHaveAttribute('data-grid-y','6');
 await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:27000});
 await expect(page.getByTestId('ground-landing-court-3d'))
   .toHaveAttribute('data-hangar-ready','true',{timeout:25000});
}

for(const width of [390,1280]){
 test('single-canvas K-47 environment paints between ground and squad '+width,
 async({page,browser})=>{
  test.setTimeout(170000);
  await page.setViewportSize({width,height:850});
  const context=await browser.newContext({
   viewport:{width,height:850},storageState:{cookies:[],origins:[]},
  });
  try{
   const old=await context.newPage();
   await old.addInitScript(()=>{
    (window as typeof window&{__k47LegacyDepthOrder?:boolean})
      .__k47LegacyDepthOrder=true;
   });
   const oldBoard=await land(old);
   await expect(old.getByTestId('ground-landing-court-3d'))
     .toHaveAttribute('data-floor-visual-source','webgl');
   await expect(oldBoard.getByTestId('ground-bay-platform-overlay')).toHaveCount(0);
   await oldBoard.screenshot({path:'test-results/k47-depth-before-landing-'+width+'.png'});
   const board=await land(page);
   await expect(page.getByTestId('ground-landing-court-3d'))
     .toHaveAttribute('data-floor-visual-source','svg');
   await expect(page.getByTestId('ground-landing-court-3d'))
     .toHaveAttribute('data-painted-cells','0');
   await expect(page.getByTestId('ground-bay-floor-4,5'))
     .not.toHaveCSS('opacity','0.08');
   const root=page.getByTestId('ground-squad-board');
   await expect(root.getByTestId('ground-bay-platform-overlay')).toHaveCount(1);
   await expect(root.getByTestId('ground-rescue-bay')).toHaveCount(1);
   await expect(root.getByTestId('ground-bay-central-hatch')).toHaveCount(1);
   await expect(root.getByTestId('ground-bay-machinery-hub')).toHaveCount(1);
   await expect(root.getByTestId('ground-bay-floor-4,5')).toHaveCount(1);
   const layers=await board.evaluate(node=>{
    const get=(id:string)=>node.querySelector('[data-testid="'+id+'"]');
    const floor=get('ground-colony-floor'),court=get('ground-landing-court-3d');
    const deck=get('ground-bay-platform-overlay'),fog=get('ground-fog-layer');
    const officer=get('ground-unit-venn');
    const follows=(a:Element|null,b:Element|null)=>!!a&&!!b&&
      Boolean(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);
    return {
     floorBelowCourt:follows(floor,court),
     courtBelowDeck:follows(court,deck),
     deckBelowFog:follows(deck,fog),
     fogBelowOfficer:follows(fog,officer),
     oneWebGLCanvas:node.querySelectorAll('[data-testid="ground-landing-court-3d"] canvas').length===1,
     canvasPassive:court?.getAttribute('pointer-events')==='none',
     deckPassive:deck?.getAttribute('pointer-events')==='none',
     canonicalTiles:node.querySelectorAll('polygon[data-cell-id]').length,
     fogUnknown:node.querySelector('[data-fog-cell="10,4"]')
       ?.getAttribute('data-fog-state')==='unknown',
    };
   });
   expect(layers).toEqual({
    floorBelowCourt:true,courtBelowDeck:true,deckBelowFog:true,
    fogBelowOfficer:true,oneWebGLCanvas:true,canvasPassive:true,
    deckPassive:true,canonicalTiles:216,fogUnknown:true,
   });
   await board.screenshot({path:'test-results/k47-depth-after-landing-'+width+'.png'});
   await approach(old);
   await oldBoard.screenshot({path:'test-results/k47-depth-before-follow-'+width+'.png'});
   await approach(page);
   await board.screenshot({path:'test-results/k47-depth-after-follow-'+width+'.png'});
   await page.reload();
   await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','6');
   await expect(page.getByTestId('ground-bay-platform-overlay')).toHaveCount(1);
   await expect(page.getByTestId('ground-landing-court-3d'))
    .toHaveAttribute('data-renderer-state','ready',{timeout:25000});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    .toBe(true);
  }finally{await context.close();}
 });
}

test('WebGL-denied K-47 keeps single SVG floor and foreground platform',async({page})=>{
 test.setTimeout(100000);
 await page.setViewportSize({width:390,height:850});
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){
   if(String(type).startsWith('webgl'))return null;
   return (original as (...v:unknown[])=>unknown).call(this,type,...args);
  } as typeof original;
 });
 await page.goto('/');
 await expect(page.getByTestId('captain-controls'))
  .toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 await expect(page.getByTestId('ground-landing-court-3d'))
  .toHaveAttribute('data-renderer-state','fallback');
 await expect(page.getByTestId('ground-bay-platform-overlay')).toHaveCount(1);
 await expect(page.getByTestId('ground-bay-central-hatch')).toHaveCount(1);
 await expect(page.getByTestId('ground-bay-floor-4,5')).toHaveCount(1);
 await expect(page.getByTestId('ground-squad-board')
  .locator('polygon[data-cell-id]')).toHaveCount(216);
 await page.getByTestId('ground-squad-board').locator('[data-cell-id="5,4"]')
  .click({button:'right'});
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','5');
});
