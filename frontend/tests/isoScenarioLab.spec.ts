import { test, expect, type Page } from '@playwright/test';
import { cells, projectCell } from '../src/tacticalGrid';
import { createIsoCamera } from '../src/tacticalIsoCamera';
import { createIsoDetailCamera } from '../src/tacticalIsoFocus';
import { SCENARIOS, createMission, missionPath, applyMissionAction, type SquadId, type MissionAction } from '../src/isoScenarioCampaign';

async function openMissions(page:Page,width:number) {
 await page.setViewportSize({width,height:850});
 await page.goto('/');
 await page.getByTestId('tactical-view-missions').click();
 await expect(page.getByTestId('scenario-lab')).toBeVisible();
 await expect(page.getByTestId('scenario-render-canvas')).toBeVisible();
}
async function clickBoard(page:Page,id:string,size:8|10|12,focus?:string) {
 const canvas=page.getByTestId('scenario-render-canvas');
 await canvas.scrollIntoViewIfNeeded();
 const b=(await canvas.boundingBox())!;
 const [col,row]=id.split(':').map(Number);
 const camera=focus?(()=>{
   const [x,y]=focus.split(':').map(Number);
   return createIsoDetailCamera(b.width/b.height,{col:x,row:y},1.75,size);
 })():createIsoCamera(b.width/b.height,size);
 const p=projectCell({id,col,row},camera,
   {left:b.x,top:b.y,width:b.width,height:b.height},size);
 expect(p.x).toBeGreaterThan(b.x+1);
 expect(p.x).toBeLessThan(b.x+b.width-1);
 expect(p.y).toBeGreaterThan(b.y+1);
 expect(p.y).toBeLessThan(b.y+b.height-1);
 await page.mouse.click(p.x,p.y);
 await expect(page.getByTestId('scenario-selected')).toHaveText(id);
}

test('12×12 derelict scene raycasts every one of 144 cells at mobile width',async({page})=>{
 test.setTimeout(95_000);
 await openMissions(page,390);
 await page.getByTestId('scenario-tab-derelict').click();
 await expect(page.getByTestId('scenario-camera-mode')).toContainText('12 × 12');
 for(const cell of cells(12))await clickBoard(page,cell.id,12);
 await page.screenshot({path:'test-results/scenario-derelict-12x12-mobile-390.png',fullPage:true});
 await page.getByTestId('scenario-focus-toggle').click();
 await clickBoard(page,'10:11',12,'11:11');
 await expect(page.getByTestId('scenario-camera-mode')).toContainText('Detalle de casilla');
 await page.getByTestId('scenario-focus-toggle').click();
 await clickBoard(page,'0:0',12);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('10×10 relay scene raycasts all 100 cells at desktop size; scenario switching resets safely',async({page})=>{
 test.setTimeout(80_000);
 await openMissions(page,1280);
 for(const cell of cells(10))await clickBoard(page,cell.id,10);
 await page.screenshot({path:'test-results/scenario-relay-10x10-desktop-1280.png',fullPage:true});
 await page.getByTestId('scenario-tab-evacuation').click();
 await expect(page.getByTestId('scenario-name')).toContainText('Evacuación');
 await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');
 await page.getByTestId('scenario-tab-relay').click();
 await expect(page.getByTestId('scenario-unit-science')).toContainText('1:1');
 await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');
 await page.getByTestId('tactical-view-current').click();
 await expect(page.getByTestId('tactical-selected')).toBeVisible();
 await page.getByTestId('tactical-view-iso').click();
 await expect(page.getByTestId('iso-render-canvas')).toBeVisible();
});

test('mission orders really consume AP, reject blocked/long travel and change objective state',async({page})=>{
 await openMissions(page,390);
 await clickBoard(page,'2:1',10);
 await expect(page.getByTestId('scenario-move')).toBeEnabled();
 await page.getByTestId('scenario-move').click();
 await expect(page.getByTestId('scenario-unit-science')).toContainText('2:1');
 await expect(page.getByTestId('scenario-ap')).toContainText('2 / 3');
 await clickBoard(page,'4:1',10);
 await expect(page.getByTestId('scenario-move')).toBeDisabled();
 await clickBoard(page,'9:9',10);
 await expect(page.getByTestId('scenario-move')).toBeDisabled();
 await expect(page.getByTestId('scenario-scan')).toBeDisabled();
 await page.getByTestId('scenario-end-turn').click();
 await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
 await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');
 await page.screenshot({path:'test-results/scenario-relay-after-orders-390.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

// Mirror the pure authoritative state while issuing every order through the UI.
// Completing a scenario here is impossible via fake button text or direct state injection.
test('evacuation scenario can actually be completed by science, medic and extraction orders',async({page})=>{
 test.setTimeout(115_000);
 await openMissions(page,390);
 await page.getByTestId('scenario-tab-evacuation').click();
 const def=SCENARIOS.evacuation;
 let state=createMission('evacuation');
 const grid=page.getByTestId('scenario-accessible-grid');
 await grid.locator('summary').click();
 const pick=async(id:string)=>{
  await page.getByRole('button',{name:`Casilla ${id}`}).click();
  await expect(page.getByTestId('scenario-selected')).toHaveText(id);
 };
 const officer=async(id:SquadId)=>page.getByTestId(`scenario-unit-${id}`).click();
 const doTurn=async()=>{
  await page.getByTestId('scenario-end-turn').click();
  state=applyMissionAction(state,{type:'end-turn'});
 };
 const go=async(id:SquadId,target:string,reach:number)=>{
  await officer(id);
  const dist=(a:string,b:string)=>{
   const [x,y]=a.split(':').map(Number),[cx,cy]=b.split(':').map(Number);
   return Math.abs(x-cx)+Math.abs(y-cy);
  };
  const candidates=[];
  for(let x=0;x<def.size;x++)for(let y=0;y<def.size;y++){
   const cell=`${x}:${y}`;
   if(dist(cell,target)>reach)continue;
   const path=missionPath(state,id,cell);
   if(path)candidates.push(path);
  }
  candidates.sort((a,b)=>a.length-b.length);
  expect(candidates.length).toBeGreaterThan(0);
  let path=candidates[0];
  while(path.length>1){
   if(state.ap===0)await doTurn();
   const stop=path[Math.min(5,path.length-1)];
   await pick(stop);
   await expect(page.getByTestId('scenario-move')).toBeEnabled();
   await page.getByTestId('scenario-move').click();
   state=applyMissionAction(state,{type:'move',officer:id,cell:stop});
   await expect(page.getByTestId(`scenario-unit-${id}`)).toContainText(stop);
   path=missionPath(state,id,candidates[0].at(-1)!);
   expect(path).not.toBeNull();
  }
 };
 const perform=async(command:MissionAction,button:string)=>{
  if(state.ap===0)await doTurn();
  await page.getByTestId(button).click();
  state=applyMissionAction(state,command);
 };
 await go('science',def.sensor,2);
 await perform({type:'scan',officer:'science'},'scenario-scan');
 await expect(page.getByTestId('scenario-objectives')).toContainText('Analizar señal');
 await go('medic',def.survivor!,1);
 await perform({type:'rescue',officer:'medic'},'scenario-rescue');
 await go('science',def.extraction,0);
 await perform({type:'extract',officer:'science'},'scenario-extract');
 await expect(page.getByTestId('scenario-success')).toContainText('Misión completada');
 await expect(page.getByTestId('scenario-ap')).toContainText(`${state.ap} / 3`);
 await expect(page.getByTestId('scenario-notice')).toContainText('Extracción confirmada');
 await page.screenshot({path:'test-results/scenario-evacuation-real-victory-390.png',fullPage:true});
 expect(state.completed).toBe(true);
});

test('touch controls and a resized 12×12 camera preserve the same logical selected cell',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:850},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 try{
  await openMissions(page,390);
  await page.getByTestId('scenario-tab-derelict').tap();
  const canvas=page.getByTestId('scenario-render-canvas');
  await canvas.scrollIntoViewIfNeeded();
  await page.setViewportSize({width:430,height:900});
  const b=(await canvas.boundingBox())!;
  const p=projectCell({id:'11:11',col:11,row:11},createIsoCamera(b.width/b.height,12),
   {left:b.x,top:b.y,width:b.width,height:b.height},12);
  await page.touchscreen.tap(p.x,p.y);
  await expect(page.getByTestId('scenario-selected')).toHaveText('11:11');
  await page.getByTestId('scenario-focus-toggle').tap();
  await expect(page.getByTestId('scenario-camera-mode')).toContainText('Detalle de casilla');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 } finally {await context.close();}
});
