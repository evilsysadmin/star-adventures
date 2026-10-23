import { test, expect } from '@playwright/test';
import { SCENARIO_SAVE_KEY } from '../src/isoScenarioSession';

test('F5 restores 12x12 mission, real squad position, round, AP and objective log at 390px',async({page})=>{
  test.setTimeout(75_000);
  await page.setViewportSize({width:390,height:850});
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-tab-derelict').click();
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();
  await page.getByRole('button',{name:'Casilla 1:2'}).click();
  await expect(page.getByTestId('scenario-move')).toBeEnabled();
  await page.getByTestId('scenario-move').click();
  await page.getByTestId('scenario-end-turn').click();
  await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
  await expect(page.getByTestId('scenario-unit-science')).toContainText('1:2');
  const saved=await page.evaluate(key=>localStorage.getItem(key),SCENARIO_SAVE_KEY);
  expect(saved).not.toBeNull();
  expect(JSON.parse(saved!).actions).toHaveLength(2);
  await page.reload();
  await page.getByTestId('tactical-view-missions').click();
  await expect(page.getByTestId('scenario-name')).toContainText('Instalación abandonada');
  await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 2');
  await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');
  await expect(page.getByTestId('scenario-unit-science')).toContainText('1:2');
  await expect(page.getByTestId('scenario-selected')).toHaveText('1:2');
  await expect(page.getByTestId('scenario-notice')).toContainText('restaurada');
  await expect(page.getByTestId('scenario-log')).toContainText('2 eventos');
  await page.screenshot({path:'test-results/scenario-f5-restored-mobile-390.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByTestId('scenario-tab-relay').click();
  await expect(page.getByTestId('scenario-unit-science')).toContainText('1:1');
  await page.reload();
  await page.getByTestId('tactical-view-missions').click();
  await expect(page.getByTestId('scenario-name')).toContainText('Repetidor silencioso');
  await expect(page.getByTestId('scenario-turn')).toContainText('Ronda 1');
});

test('impossible and future-version checkpoints recover safely without overwriting other saves',async({page})=>{
  await page.setViewportSize({width:1280,height:850});
  await page.goto('/');
  const sentinel='shadowops.star-adventures.test-unrelated-sentinel';
  await page.evaluate(({key,sentinel})=>{
    localStorage.setItem(sentinel,'preserve-me');
    localStorage.setItem(key,JSON.stringify({
      version:1,scenarioId:'evacuation',actions:[{type:'extract',officer:'science'}],
    }));
  },{key:SCENARIO_SAVE_KEY,sentinel});
  await page.reload();
  await page.getByTestId('tactical-view-missions').click();
  await expect(page.getByTestId('scenario-name')).toContainText('Repetidor silencioso');
  await expect(page.getByTestId('scenario-notice')).toContainText('incompatible');
  await expect(page.getByTestId('scenario-ap')).toContainText('3 / 3');
  expect(await page.evaluate(key=>localStorage.getItem(key),sentinel)).toBe('preserve-me');
  await page.screenshot({path:'test-results/scenario-f5-corrupt-desktop-1280.png',fullPage:true});
  await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({
    version:2,scenarioId:'relay',actions:[],
  })),SCENARIO_SAVE_KEY);
  await page.reload();
  await page.getByTestId('tactical-view-missions').click();
  await expect(page.getByTestId('scenario-notice')).toContainText('incompatible');
  expect(await page.evaluate(key=>localStorage.getItem(key),sentinel)).toBe('preserve-me');
});

test('storage writes denied: orders remain playable and never pretend to be saved',async({page})=>{
  await page.addInitScript(key=>{
    const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(name:string,value:string){
      if(name===key)throw new DOMException('Blocked','QuotaExceededError');
      return set.call(this,name,value);
    };
  },SCENARIO_SAVE_KEY);
  await page.goto('/');
  await page.getByTestId('tactical-view-missions').click();
  await page.getByTestId('scenario-accessible-grid').locator('summary').click();
  await page.getByRole('button',{name:'Casilla 2:1'}).click();
  await page.getByTestId('scenario-move').click();
  await expect(page.getByTestId('scenario-unit-science')).toContainText('2:1');
  await expect(page.getByTestId('scenario-notice')).toContainText('no guardado');
});
