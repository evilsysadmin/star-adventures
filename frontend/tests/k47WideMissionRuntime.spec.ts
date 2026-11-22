import {expect,test,type Page} from '@playwright/test';

test.use({storageState:{cookies:[],origins:[]}});

async function enterWide(page:Page){
 await page.goto('/');
 await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
 await page.getByTestId('captain-transport').click();
 await page.getByTestId('transport-confirm').click();
 await expect(page.getByTestId('ground-squad-board')).toBeVisible();
 await page.locator('.ground-squad-instructions summary').click();
 await page.getByTestId('wide-trial-enter').click();
 await expect(page.getByTestId('wide-squad-board')).toBeVisible();
}

for(const [width,branch] of [[390,'life-support'],[1280,'research']] as const){
 test('Real K-47 mission: physical relay choice → scientific evidence → atomic F5 ('+width+')',
 async({page})=>{
  test.setTimeout(170000);
  page.setDefaultTimeout(16000);
  await page.setViewportSize({width,height:850});
  await enterWide(page);
  const board=page.getByTestId('wide-squad-board');
  const panel=page.getByTestId('wide-mission-panel');
  const oldSave=await page.evaluate(()=>
    localStorage.getItem('shadowops.star-adventures.ground-realtime.v1'));
  await expect(panel).toHaveAttribute('data-wide-power-route','none');
  await expect(panel).toHaveAttribute('data-wide-evidence','none');
  await expect(page.getByTestId('wide-mission-progress')).toHaveText('0/2');
  await expect(page.getByTestId('wide-power-life')).toHaveCount(0);
  await expect(page.getByTestId('wide-lab-collect')).toHaveCount(0);
  await expect(board.locator('[data-wide-objective="relay-power"]')).toHaveCount(0,
    'remote, unexplored relays cannot reveal their marker');
  await expect(board.locator('[data-wide-objective="lab-evidence"]')).toHaveCount(0);

  // Real walk, not a mock location or preloaded evidence. A mission action
  // appears only once the selected officer has physically reached the relay.
  await page.getByTestId('wide-sector-select').selectOption('south-yard');
  await board.locator('[data-wide-cell="18,15"]').click({button:'right'});
  await expect(page.getByTestId('wide-officer-venn')).toHaveAttribute(
    'data-move-phase','moving');
  await expect(page.getByTestId('wide-officer-venn')).toHaveAttribute(
    'data-move-phase','idle',{timeout:32000});
  await expect(board.locator('[data-wide-objective="relay-power"]')).toHaveCount(1);
  await expect(page.getByTestId('wide-power-life')).toBeVisible();
  await expect(page.getByTestId('wide-power-research')).toBeVisible();
  await expect(page.getByTestId('wide-lab-collect')).toHaveCount(0);
  const action=branch==='life-support'?'wide-power-life':'wide-power-research';
  await page.getByTestId(action).click();
  await expect(panel).toHaveAttribute('data-wide-power-route',branch);
  await expect(page.getByTestId('wide-mission-progress')).toHaveText('1/2');
  await expect(page.getByTestId('wide-power-research')).toHaveCount(0);
  await expect(page.getByTestId('wide-power-life')).toHaveCount(0);
  await expect(board.locator('[data-wide-objective="relay-power"]'))
    .toHaveAttribute('data-objective-state','complete');
  await expect(board.locator('[data-wide-objective="lab-evidence"]')).toHaveCount(0);
  await page.screenshot({path:'test-results/k47-wide-mission-relay-'+width+'.png'});

  const savedAtRelay=await page.evaluate(()=>localStorage.getItem(
    'shadowops.star-adventures.k47-wide-trial.motion.v1'));
  expect(savedAtRelay).toBeTruthy();
  const v2=JSON.parse(savedAtRelay!);
  expect(v2.version).toBe(2);
  expect(v2.mapId).toBe('k47-outer-array');
  expect(v2.mission.powerRoute).toBe(branch);
  expect(v2.mission.evidence).toBeNull();
  expect(v2.mission.journal).toEqual([{
    code:'relay.'+branch,officerId:'venn',
  }]);
  expect(await page.evaluate(()=>localStorage.getItem(
    'shadowops.star-adventures.ground-realtime.v1'))).toBe(oldSave);

  await page.reload();
  await expect(panel).toHaveAttribute('data-wide-power-route',branch);
  await expect(page.getByTestId('wide-mission-progress')).toHaveText('1/2');
  await expect(page.getByTestId('wide-power-life')).toHaveCount(0);

  // Lab is in a sealed compound reached through the real topology. Even a
  // powered lab has no remote interaction: walk to its actual ground cell.
  await page.getByTestId('wide-sector-select').selectOption('remote-lab');
  await expect(page.getByTestId('wide-lab-collect')).toHaveCount(0);
  await board.locator('[data-wide-cell="27,13"]').click({button:'right'});
  await expect(page.getByTestId('wide-officer-venn')).toHaveAttribute(
    'data-move-phase','moving');
  await expect(page.getByTestId('wide-officer-venn')).toHaveAttribute(
    'data-move-phase','idle',{timeout:36000});
  await expect(page.getByTestId('wide-lab-collect')).toBeVisible();
  await expect(board.locator('[data-wide-objective="lab-evidence"]'))
    .toHaveAttribute('data-objective-state','pending');
  await page.getByTestId('wide-lab-collect').click();
  const evidence=branch==='research'?'verified':'sealed';
  await expect(panel).toHaveAttribute('data-wide-evidence',evidence);
  await expect(page.getByTestId('wide-mission-progress')).toHaveText('2/2');
  await expect(page.getByTestId('wide-lab-collect')).toHaveCount(0);
  await expect(board.locator('[data-wide-objective="lab-evidence"]'))
    .toHaveAttribute('data-objective-state','complete');
  await expect(page.getByTestId('wide-mission-result')).toContainText(
    evidence==='verified'?'evidencia verificada':'muestras conservadas');
  await page.screenshot({path:'test-results/k47-wide-mission-lab-'+width+'.png'});

  const completed=await page.evaluate(()=>localStorage.getItem(
    'shadowops.star-adventures.k47-wide-trial.motion.v1'));
  expect(completed).toBeTruthy();
  const actual=JSON.parse(completed!);
  expect(actual.version).toBe(2);
  expect(actual.mission.journal).toEqual([
    {code:'relay.'+branch,officerId:'venn'},
    {code:'lab.'+evidence,officerId:'venn'},
  ]);
  expect(await page.evaluate(()=>localStorage.getItem(
    'shadowops.star-adventures.ground-realtime.v1'))).toBe(oldSave);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    .toBe(true);

  await page.reload();
  await expect(panel).toHaveAttribute('data-wide-power-route',branch);
  await expect(panel).toHaveAttribute('data-wide-evidence',evidence);
  await expect(page.getByTestId('wide-mission-progress')).toHaveText('2/2');
  await expect(page.getByTestId('wide-power-life')).toHaveCount(0);
  await expect(page.getByTestId('wide-lab-collect')).toHaveCount(0);
  await page.getByTestId('wide-trial-exit').click();
  await expect(page.getByTestId('ground-squad-board')).toBeVisible();
  await expect(page.locator('.mission-transmission')).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem(
    'shadowops.star-adventures.ground-realtime.v1'))).toBe(oldSave);

  // Explicit re-entry must retain the completed outcome; the old rescue
  // mission remains untouched and the pilot choice cannot be farmed.
  await page.locator('.ground-squad-instructions summary').click();
  await page.getByTestId('wide-trial-enter').click();
  await expect(panel).toHaveAttribute('data-wide-evidence',evidence);
  await expect(page.getByTestId('wide-mission-progress')).toHaveText('2/2');
 });
}
