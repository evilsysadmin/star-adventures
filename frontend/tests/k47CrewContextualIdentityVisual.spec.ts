import {expect,test,type Page} from '@playwright/test';

// The actual K-47 game, the original squad and the original camera.
// No test-only officer, coordinate or fog override is permitted.
test.use({storageState:{cookies:[],origins:[]}});

async function land(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls'))
  .toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 const board=page.getByTestId('ground-squad-board');
 await expect(board).toBeVisible();
 await expect(page.getByTestId('ground-landing-court-3d'))
  .toHaveAttribute('data-renderer-state','ready',{timeout:25000});
 await expect(board.locator('polygon[data-cell-id]')).toHaveCount(216);
 return board;
}

for(const width of [390,1280]){
 test('contextual crew identity keeps full names accessible, selection safe '+width,
 async({page})=>{
  test.setTimeout(140000);
  await page.setViewportSize({width,height:850});
  const board=await land(page);
  // Chrome preserves the pointer from the transport confirmation button.
  // After the scene replaces that screen, it can be directly over Isa;
  // the genuine :hover reveal is correct. Park outside the game world
  // before asserting the unhovered baseline at both viewport widths.
  await page.mouse.move(1,1);
  const camera=await board.getAttribute('viewBox');
  const ids=['venn','dorn','mira'] as const;
  const full=(id:string)=>page.getByTestId('ground-officer-nameplate-full-'+id);
  const initial=(id:string)=>page.getByTestId('ground-officer-nameplate-initial-'+id);

  // The one canonical crew roster always contains the complete accessible
  // names even though unselected in-world plaques only show initials.
  for(const [id,name,letter] of [
   ['venn','Nara','N'],['dorn','Kael','K'],['mira','Isa','I']
  ] as const){
   await expect(page.getByTestId('ground-select-'+id)).toContainText(name);
   await expect(full(id).locator('text')).toHaveText(name);
   await expect(initial(id).locator('text')).toHaveText(letter);
   await expect(page.getByTestId('ground-officer-nameplate-'+id))
    .toHaveAttribute('pointer-events','none');
   const hit=await page.getByTestId('ground-officer-hit-'+id)
    .evaluate(el=>{
     const bb=(el as SVGGraphicsElement).getBBox();
     return {w:bb.width,h:bb.height};
    });
   expect(hit).toEqual({w:36,h:57});
  }
  await expect(page.getByTestId('ground-select-venn'))
    .toHaveAttribute('aria-pressed','true');
  await expect(full('venn')).toHaveCSS('opacity','1');
  await expect(initial('venn')).toHaveCSS('opacity','0');
  for(const id of ['dorn','mira']){
   await expect(full(id)).toHaveCSS('opacity','0');
   await expect(initial(id)).toHaveCSS('opacity','1');
  }
  // Real same-frame screenshots: first production progressive disclosure,
  // then CSS-only original mode (all full names) with ALL state unchanged.
  await page.screenshot({path:'test-results/k47-crew-contextual-'+width+'.png'});
  const legacy=await page.addStyleTag({content:
   '[data-testid^="ground-officer-nameplate-full-"]{opacity:1!important}'+
   '[data-testid^="ground-officer-nameplate-initial-"]{opacity:0!important}'});
  for(const id of ids)await expect(full(id)).toHaveCSS('opacity','1');
  await page.screenshot({path:'test-results/k47-crew-all-labels-'+width+'.png'});
  await legacy.evaluate(el=>el.remove());
  await expect(full('dorn')).toHaveCSS('opacity','0');
  await expect(board).toHaveAttribute('viewBox',camera!);
  await expect(board.locator('polygon[data-cell-id]')).toHaveCount(216);

  // Touch-friendly canonical roster switches the contextual identity
  // without ever changing an officer position or adding a pick target.
  const pose=await page.getByTestId('ground-unit-dorn')
    .getAttribute('data-grid-x');
  await page.getByTestId('ground-select-dorn').click();
  await expect(page.getByTestId('ground-select-dorn'))
   .toHaveAttribute('aria-pressed','true');
  await expect(full('dorn')).toHaveCSS('opacity','1');
  await expect(initial('dorn')).toHaveCSS('opacity','0');
  await expect(full('venn')).toHaveCSS('opacity','0');
  await expect(initial('venn')).toHaveCSS('opacity','1');
  await expect(page.getByTestId('ground-unit-dorn'))
   .toHaveAttribute('data-grid-x',pose!);
  await page.screenshot({path:'test-results/k47-crew-selected-'+width+'.png'});

  // Mouse pointer disclosure is secondary to roster selection. A phone
  // must never require hover to identify its selected crew member.
  if(width>520){
   await page.getByTestId('ground-officer-hit-mira').hover();
   await expect(full('mira')).toHaveCSS('opacity','1');
   await expect(initial('mira')).toHaveCSS('opacity','0');
   await page.getByTestId('ground-camera-toggle').hover();
   await expect(full('mira')).toHaveCSS('opacity','0');
  }
  await page.reload();
  await expect(page.getByTestId('ground-squad-board')
   .locator('polygon[data-cell-id]')).toHaveCount(216);
  for(const id of ids){
   await expect(full(id)).toHaveCount(1);
   await expect(initial(id)).toHaveCount(1);
  }
  expect(await page.evaluate(()=>
    document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
