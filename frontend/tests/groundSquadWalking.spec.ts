import {expect,test} from '@playwright/test';

// The visual animation consumes the already accepted ground-position route.
// It never writes a second game move or changes the persisted coordinates.
test.use({storageState:{cookies:[],origins:[]}});
const tinyPng=Buffer.from(
 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytAAAAABJRU5ErkJggg==',
 'base64',
);

async function land(page: import('@playwright/test').Page){
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:20_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('ground-squad-board')).toBeVisible();
}
for(const width of [390,1280]){
 test('accepted grid order plays real walk-atlas frames '+width+'px',async({page})=>{
  test.setTimeout(90_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({width,height:850});
  // Independent, decodable fixture proves that the six-frame walk sheet is
  // actually loaded, not merely an idle character translated across the map.
  await page.route(/\/star-adventures\/tactical\/officer-(female|male)-walk-v1-[^/]+\.webp$/,route=>
    route.fulfill({status:200,contentType:'image/png',
      headers:{'access-control-allow-origin':'*'},body:tinyPng}));
  await land(page);
  const venn=page.getByTestId('ground-unit-venn');
  await expect(venn).toHaveAttribute('data-walk-atlas-ready','true');
  const dorn=page.getByTestId('ground-unit-dorn');
  await expect(venn).toHaveAttribute('data-grid-x','4');
  await expect(venn).toHaveAttribute('data-grid-y','5');
  const dornPose=await dorn.getAttribute('transform');
  // The walk only lasts a few animation frames. On a busy Chromium CI runner,
  // querying five separate live elements can outlast that animation. Capture
  // *actual DOM state while moving*, rather than querying after it disappears.
  // This still fails if no frame advances, the atlas is missing or the
  // art-only scaling differs from the camera projection.
  await page.evaluate(()=>{
    const officer=document.querySelector('[data-testid="ground-unit-venn"]');
    if(!officer)throw new Error('Missing officer for live atlas observation');
    const record={
      moving:false,maxFrame:0,
      bounds:null as null|{
        width:number;height:number;expectedWidth:number;expectedHeight:number},
      atlas:null as null|{size:string;image:string},
    };
    (window as typeof window & {__groundWalkProbe?:typeof record})
      .__groundWalkProbe=record;
    const sample=()=>{
      if(officer.getAttribute('data-walk-phase')!=='moving')return;
      record.moving=true;
      record.maxFrame=Math.max(record.maxFrame,
        Number(officer.getAttribute('data-walk-frame')||0));
      const art=officer.querySelector('[data-testid="ground-officer-walk-venn"]');
      const inner=art?.querySelector('div');
      const svg=(officer as SVGGraphicsElement).ownerSVGElement;
      if(!art||!inner||!svg)return;
      const box=art.getBoundingClientRect();
      const rect=svg.getBoundingClientRect(),view=svg.viewBox.baseVal;
      if(box.width>0&&box.height>0&&view.width>0&&view.height>0){
        record.bounds={width:box.width,height:box.height,
          expectedWidth:54*.76*rect.width/view.width,
          expectedHeight:80*.76*rect.height/view.height};
        const style=getComputedStyle(inner);
        record.atlas={size:style.backgroundSize,image:style.backgroundImage};
      }
    };
    new MutationObserver(sample).observe(officer,{
      attributes:true,subtree:true,
      attributeFilter:['data-walk-phase','data-walk-frame'],
    });
  });
  await page.locator('[data-cell-id="2,4"]').click({button:'right'});
  await expect(venn).toHaveAttribute('data-grid-x','2');
  await expect(venn).toHaveAttribute('data-grid-y','4');
  await expect.poll(async()=>page.evaluate(()=>
    (window as typeof window & {__groundWalkProbe?:{maxFrame:number}})
      .__groundWalkProbe?.maxFrame??0),{timeout:12_000})
    .toBeGreaterThan(0);
  const observed=await page.evaluate(()=>
    (window as typeof window & {
      __groundWalkProbe?:{
        moving:boolean;maxFrame:number;
        bounds:null|{width:number;height:number;
          expectedWidth:number;expectedHeight:number};
        atlas:null|{size:string;image:string};
      };
    }).__groundWalkProbe);
  expect(observed?.moving).toBe(true);
  expect(observed?.atlas?.size).toBe('300% 200%');
  expect(observed?.atlas?.image).toMatch(/officer-female-walk-v1-/);
  if(!observed?.bounds)throw new Error('Live walking atlas never had visible bounds');
  expect(observed.bounds.width).toBeGreaterThan(observed.bounds.expectedWidth-2);
  expect(observed.bounds.width).toBeLessThan(observed.bounds.expectedWidth+2);
  expect(observed.bounds.height).toBeGreaterThan(observed.bounds.expectedHeight-2);
  expect(observed.bounds.height).toBeLessThan(observed.bounds.expectedHeight+2);
  // The screenshot is diagnostic; the live observer above is the actual
  // proof of a real animated atlas even if screenshot capture happens late.
  await page.getByTestId('ground-squad-board').screenshot({
    path:'test-results/ground-walk-'+width+'.png',
  });
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:10_000});
  await expect(dorn).toHaveAttribute('transform',dornPose??'');
  await page.reload();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','4');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-walk-phase','idle');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

test('reduced motion skips animation while preserving saved officer destination',async({page})=>{
 test.setTimeout(70_000);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:850});
 await land(page);
 await page.locator('[data-cell-id="2,4"]').click({button:'right'});
 const venn=page.getByTestId('ground-unit-venn');
 await expect(venn).toHaveAttribute('data-grid-x','2');
 await expect(venn).toHaveAttribute('data-grid-y','4');
 await expect(venn).toHaveAttribute('data-walk-phase','idle');
 await page.reload();
 await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','2');
});
