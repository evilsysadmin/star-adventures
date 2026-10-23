import { test, expect, type Page } from '@playwright/test';
import { createIsoCamera } from '../src/tacticalIsoCamera';
import { createIsoDetailCamera } from '../src/tacticalIsoFocus';
import { projectCell } from '../src/tacticalGrid';

async function tapTile(page:Page,id:string,focus:string|null){
  const canvas=page.getByTestId('iso-render-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box=(await canvas.boundingBox())!;
  const [col,row]=id.split(':').map(Number);
  const camera=focus===null ? createIsoCamera(box.width/box.height) :
    createIsoDetailCamera(box.width/box.height,(()=>{const [x,y]=focus.split(':').map(Number);return {col:x,row:y};})());
  const p=projectCell({id,col,row},camera,{left:box.x,top:box.y,width:box.width,height:box.height});
  await page.mouse.click(p.x,p.y);
  await expect(page.getByTestId('iso-selected')).toContainText(id);
}
async function start(page:Page,width:number) {
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-iso').click();
  await expect(page.getByTestId('iso-render-canvas')).toBeVisible();
}

for(const width of [390,1280]){
 test(`select on-canvas squad members by actual cell at ${width}px without stealing target selection`,async({page})=>{
  await start(page,width);
  await expect(page.getByTestId('iso-unit-science')).toHaveAttribute('aria-pressed','true');
  await tapTile(page,'2:5',null);
  await expect(page.getByTestId('iso-unit-security')).toHaveAttribute('aria-pressed','true');
  await tapTile(page,'1:6',null);
  await expect(page.getByTestId('iso-unit-medic')).toHaveAttribute('aria-pressed','true');
  await tapTile(page,'6:2',null);
  await expect(page.getByTestId('iso-unit-medic')).toHaveAttribute('aria-pressed','true');
  // Exercise same auto-selection through accessible fallback.
  await page.getByTestId('iso-accessible-grid').locator('summary').click();
  await page.getByRole('button',{name:'Casilla 1:1'}).click();
  await expect(page.getByTestId('iso-unit-science')).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:`test-results/iso-tap-select-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

test('mobile detail focus centers selected officer via roster and board touch',async({page})=>{
 await start(page,390);
 await page.getByTestId('iso-focus-toggle').click();
 await page.getByTestId('iso-unit-security').click();
 await expect(page.getByTestId('iso-camera-mode')).toContainText('centro en 2:5');
 await expect(page.getByTestId('iso-unit-security')).toHaveAttribute('aria-pressed','true');
 await tapTile(page,'1:6','2:5');
 await expect(page.getByTestId('iso-unit-medic')).toHaveAttribute('aria-pressed','true');
 await expect(page.getByTestId('iso-camera-mode')).toContainText('centro en 1:6');
 await page.getByTestId('iso-unit-science').click();
 await expect(page.getByTestId('iso-camera-mode')).toContainText('centro en 1:1');
 await expect(page.getByTestId('iso-unit-science')).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:'test-results/iso-detail-tap-officer-390.png',fullPage:true});
});

test('moved officer can be reselected at current cell, old cell does not select it',async({page})=>{
 await start(page,390);
 await tapTile(page,'4:1',null);
 await page.getByTestId('iso-move').click();
 await expect(page.getByTestId('iso-unit-science')).toContainText('4:1',{timeout:10000});
 await page.getByTestId('iso-unit-medic').click();
 await tapTile(page,'1:1',null);
 await expect(page.getByTestId('iso-unit-medic')).toHaveAttribute('aria-pressed','true');
 await tapTile(page,'4:1',null);
 await expect(page.getByTestId('iso-unit-science')).toHaveAttribute('aria-pressed','true');
 await page.getByTestId('tactical-view-current').click();
 await expect(page.getByTestId('tactical-selected')).toBeVisible();
});
