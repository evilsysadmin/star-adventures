import {expect,test} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

for(const width of [360,390,430,1280,1757]){
 test('planetary landing is a fullscreen, pickable isometric stage at '+width+'px',async({page})=>{
  test.setTimeout(100_000);
  page.setDefaultTimeout(15_000);
  const height=width===1757?800:850;
  await page.setViewportSize({width,height});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:20_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();

  const shape=await board.evaluate(node=>{
   const svg=node as SVGSVGElement,rect=svg.getBoundingClientRect();
   const camera=svg.viewBox.baseVal;
   return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,
    aspectError:Math.abs(camera.width/camera.height-rect.width/rect.height)};
  });
  // The SVG is the scene, not a card beneath the mission transmission.
  expect(shape.x).toBeLessThanOrEqual(2);
  expect(shape.y).toBeLessThanOrEqual(2);
  expect(shape.width).toBeGreaterThanOrEqual(width-2);
  expect(shape.height).toBeGreaterThanOrEqual(height-2);
  expect(shape.aspectError).toBeLessThan(.08);
  await expect(page.getByTestId('ground-select-all')).toBeInViewport();
  await expect(page.getByTestId('ground-move-mode')).toBeInViewport();
  await expect(page.getByTestId('ground-camera-toggle')).toBeInViewport();

  const obstacles=await page.evaluate(()=>{
   const map=document.querySelector('[data-testid="ground-squad-board"]')!.getBoundingClientRect();
   const dock=document.querySelector('.ground-squad-toolbar')!.getBoundingClientRect();
   const hud=document.querySelector('.ground-squad-viewbar')!.getBoundingClientRect();
   const leader=document.querySelector('[data-testid="ground-unit-venn"]')!.getBoundingClientRect();
   return {mapBottom:map.bottom,dockBottom:dock.bottom,hudBottom:hud.bottom,
     leaderY:leader.y+leader.height/2,leaderX:leader.x+leader.width/2,
     hudTop:hud.top,dockTop:dock.top,
     noOverflow:document.documentElement.scrollWidth<=innerWidth};
  });
  expect(obstacles.noOverflow).toBe(true);
  expect(obstacles.dockBottom).toBeLessThanOrEqual(height);
  expect(obstacles.hudBottom).toBeLessThanOrEqual(height);
  // On portrait, essential camera/actions must not obscure the landing.
  if(width<=430){
   expect(obstacles.hudTop).toBeGreaterThan(obstacles.leaderY);
   expect(obstacles.dockTop).toBeGreaterThan(obstacles.leaderY);
  }

  // A real pointer order and the existing F5 save must survive the new HUD.
  await board.locator('[data-cell-id="2,4"]').click({button:'right'});
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','4');
  await page.screenshot({path:'test-results/away-fullscreen-'+width+'.png'});
  await page.reload();
  await expect(board).toBeVisible();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

  // The legacy camera remains an explicit rollback, not a forced FPS landing.
  await page.getByTestId('ground-squad-toggle').click();
  await expect(page.getByTestId('compatible-firstperson-canvas')).toBeVisible();
 });
}
