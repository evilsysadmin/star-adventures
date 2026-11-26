import {expect,test,type Page} from '@playwright/test';
import {freshCaptainStorageState,legacyDiagnosticsStorageState} from './fixtures/browserStartProfiles';

test.use({storageState:freshCaptainStorageState()});

async function clickGround(page:Page,x:number,y:number,button:'left'|'right'='right'){
  const board=page.getByTestId('ground-squad-board');
  const p=await board.evaluate((element,{x,y})=>{
    const svg=element as SVGSVGElement;
    const center=svg.createSVGPoint();
    center.x=440+(x-y)*40;
    center.y=52+(x+y)*20;
    const matrix=svg.getScreenCTM();
    if(!matrix)throw new Error('Missing isometric projection');
    const screen=center.matrixTransform(matrix),rect=svg.getBoundingClientRect();
    return {x:screen.x-rect.left,y:screen.y-rect.top};
  },{x,y});
  await board.click({position:p,button});
}

const pose=async(page:Page)=>{
  const officer=page.getByTestId('ground-unit-venn');
  return {x:Number(await officer.getAttribute('data-world-x')),
    y:Number(await officer.getAttribute('data-world-y'))};
};

for(const width of [390,1280]){
  test('continuous away walk: real retarget, fog, F5 and safe classic rollback '+width,async({page})=>{
    test.setTimeout(110_000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await expect(page.getByTestId('captain-controls')).toBeVisible();
    await page.getByTestId('captain-transport').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    const officer=page.getByTestId('ground-unit-venn');
    await expect(officer).toHaveAttribute('data-world-x','4.000');

    // Explicit opt-in keeps the current grid gameplay untouched by default.
    await page.locator('.ground-squad-instructions summary').click();
    const toggle=page.getByTestId('ground-realtime-toggle');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed','true');
    await page.getByTestId('ground-camera-toggle').click(); // whole map for distant order
    if(width<=520)await page.getByTestId('ground-map-sector').selectOption('all');
    // Observe actual committed frame changes before issuing the order.
    // Sampling RAF for a fixed 700ms can alias the independent sprite timer
    // on a loaded software-rendered browser, especially at desktop width.
    const walkSamples=await officer.evaluateHandle(element=>{
      const samples:number[]=[];
      const read=()=>{
        if(element.getAttribute('data-walk-phase')==='moving')
          samples.push(Number(element.getAttribute('data-walk-frame')));
      };
      const observer=new MutationObserver(read);
      observer.observe(element,{attributes:true,attributeFilter:['data-walk-frame','data-walk-phase']});
      return {samples,observer};
    });
    await clickGround(page,9,4);
    await expect(officer).toHaveAttribute('data-walk-phase','moving');
    await expect(page.locator('[data-fog-cell="10,4"]')).toHaveAttribute('data-fog-state','unknown');
    const preview=page.getByTestId('ground-route-preview-venn');
    await expect(preview).toBeVisible();
    await expect(page.getByTestId('ground-route-preview-layer')).toHaveAttribute('pointer-events','none');
    // Every drawn segment stays within explored cells, including the
    // conservative half-cell envelope at fractional boundaries.
    const safe=await preview.evaluate(group=>{
      const svg=group.ownerSVGElement!;
      const unknown=new Set([...svg.querySelectorAll('[data-fog-state="unknown"]')]
        .map(e=>e.getAttribute('data-fog-cell')));
      const line=group.querySelector('polyline')!;
      const points=[...Array(line.points.numberOfItems)].map((_,i)=>{
        const p=line.points.getItem(i);
        return {x:((p.x-440)/40+(p.y-52)/20)/2,
          y:((p.y-52)/20-(p.x-440)/40)/2};
      });
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i];
        for(let y=Math.ceil(Math.min(a.y,b.y)-.5+1e-8);y<=Math.floor(Math.max(a.y,b.y)+.5-1e-8);y++)
          for(let x=Math.ceil(Math.min(a.x,b.x)-.5+1e-8);x<=Math.floor(Math.max(a.x,b.x)+.5-1e-8);x++)
            if(unknown.has(x+','+y))return false;
      }
      return points.length>1;
    });
    expect(safe).toBe(true);
    await expect(page.getByTestId('ground-route-preview-dorn')).toHaveCount(0);
    await expect(page.getByTestId('ground-route-preview-mira')).toHaveCount(0);


    await expect.poll(async()=>{
      const p=await pose(page);
      return Math.hypot(p.x-4,p.y-5);
    },{timeout:6000}).toBeGreaterThan(.08);
    // Sample real movement across multiple rendered frames: a 3x2 atlas has
    // exactly six frames, and out-of-range rows can make the actor disappear.
    try{
      await expect.poll(()=>walkSamples.evaluate(({samples})=>new Set(samples).size),
        {timeout:6000,message:'moving sprite must commit at least two distinct atlas frames'})
        .toBeGreaterThan(1);
      const observed=await walkSamples.evaluate(({samples})=>[...samples]);
      expect(observed.length).toBeGreaterThan(1);
      expect(observed.every(frame=>Number.isInteger(frame)&&frame>=0&&frame<6)).toBe(true);
    }finally{
      await walkSamples.evaluate(({observer})=>observer.disconnect());
      await walkSamples.dispose();
    }
    const mid=await pose(page);
    expect(Math.hypot(mid.x-9,mid.y-4)).toBeGreaterThan(1);
    // Capture the *actual gameplay follow camera* as well: the overview
    // previously made this improvement almost invisible in screenshots.
    await page.getByTestId('ground-camera-toggle').click();
    await page.getByTestId('ground-squad-board').screenshot({
      path:'test-results/away-realtime-follow-'+width+'.png',
    });
    await page.getByTestId('ground-camera-toggle').click();
    if(width<=520)await page.getByTestId('ground-map-sector').selectOption('all');
    await page.getByTestId('ground-squad-board').screenshot({
      path:'test-results/away-realtime-moving-'+width+'.png',
    });

    // Retarget from the actual fractional position, not from 9:4.
    await clickGround(page,3,5);
    await expect(officer).toHaveAttribute('data-walk-phase','moving');
    const saved=await page.evaluate(()=>{
      const raw=localStorage.getItem('shadowops.star-adventures.ground-realtime.v1');
      return raw?JSON.parse(raw):null;
    });
    expect(saved?.version).toBe(2);
    const last=saved?.motion.officers.find((o:{id:string})=>o.id==='venn').route.at(-1);
    // Browser hit coordinates have finite CSS pixel precision: the movement
    // remains truly subcellular rather than snapping to integer centers.
    expect(Math.abs(last.x-3)).toBeLessThan(.03);
    expect(Math.abs(last.y-5)).toBeLessThan(.03);
    const beforeReload=await pose(page);
    await page.reload();
    await expect(page.getByTestId('ground-realtime-toggle')).toHaveAttribute('aria-pressed','true');
    const resumed=page.getByTestId('ground-unit-venn');
    const afterReload=await pose(page);
    expect(Math.hypot(afterReload.x-beforeReload.x,afterReload.y-beforeReload.y))
      .toBeLessThan(.7);
    await expect(resumed).toHaveAttribute('data-walk-phase','idle',{timeout:8000});
    const arrived=await pose(page);
    expect(Math.abs(arrived.x-3)).toBeLessThan(.03);
    expect(Math.abs(arrived.y-5)).toBeLessThan(.03);

    // F5 restores the close follow camera: use overview for a distant
    // group target, rather than clicking an offscreen point.
    await page.getByTestId('ground-camera-toggle').click();
    if(width<=520)await page.getByTestId('ground-map-sector').selectOption('all');
    await expect(page.getByTestId('ground-camera-toggle'))
      .toHaveAttribute('aria-pressed','false');
    // The full selected team now receives ONE atomic continuous formation
    // order. Each selected officer travels independently and simultaneously
    // into a distinct real walkable cell around the clicked anchor.
    await page.getByTestId('ground-select-all').click();
    await clickGround(page,2,5);
    await expect(page.getByTestId('ground-move-status'))
      .toContainText('Formación de 3 oficiales');
    await expect.poll(async()=>page.evaluate(()=>{
      const raw=localStorage.getItem('shadowops.star-adventures.ground-realtime.v1');
      return raw?JSON.parse(raw).motion.officers.filter(
        (o:{route:unknown[]})=>o.route.length>0).length:0;
    }),{timeout:8000}).toBeGreaterThanOrEqual(2);
    await page.getByTestId('ground-squad-board').screenshot({
      path:'test-results/away-realtime-formation-moving-'+width+'.png',
    });
    await expect.poll(async()=>page.evaluate(()=>{
      const raw=localStorage.getItem('shadowops.star-adventures.ground-realtime.v1');
      return raw?JSON.parse(raw).motion.officers.every(
        (o:{route:unknown[]})=>o.route.length===0):false;
    }),{timeout:22000}).toBe(true);
    const team=await page.evaluate(()=>{
      const raw=localStorage.getItem('shadowops.star-adventures.ground-realtime.v1');
      return JSON.parse(raw!).motion.officers as Array<{id:string;x:number;y:number}>;
    });
    const unique=new Set(team.map(o=>o.x.toFixed(3)+','+o.y.toFixed(3)));
    expect(unique.size).toBe(3);
    expect(team.find(o=>o.id==='venn')?.x).toBeCloseTo(2,1);
    expect(team.find(o=>o.id==='venn')?.y).toBeCloseTo(5,1);
    await expect(page.getByTestId('ground-move-status'))
      .toContainText('ha llegado a');
    await page.getByTestId('ground-squad-board').screenshot({
      path:'test-results/away-realtime-formation-arrived-'+width+'.png',
    });
    // Review the actual follow camera, not only the tiny whole-map overview.
    // All three real officer bodies must be within the playable stage.
    await page.getByTestId('ground-camera-toggle').click();
    await expect(page.getByTestId('ground-camera-toggle'))
      .toHaveAttribute('aria-pressed','true');
    const followed=await page.getByTestId('ground-squad-board').evaluate(svg=>{
      const frame=svg.getBoundingClientRect();
      return ['venn','dorn','mira'].map(id=>{
        const unit=svg.querySelector('[data-testid="ground-unit-'+id+'"]')!;
        const art=unit.querySelector('[data-testid="ground-officer-visible-art-'+id+'"]')!;
        const r=art.getBoundingClientRect();
        return {id,x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,
          artLeft:r.left,artRight:r.right,artTop:r.top,artBottom:r.bottom,
          left:frame.left,right:frame.right,top:frame.top,bottom:frame.bottom};
      });
    });
    for(const o of followed){
      expect(o.x,o.id+' horizontal view').toBeGreaterThan(o.left);
      expect(o.x,o.id+' horizontal view').toBeLessThan(o.right);
      expect(o.y,o.id+' vertical view').toBeGreaterThan(o.top);
      expect(o.y,o.id+' vertical view').toBeLessThan(o.bottom);
      // Verify the actual whole art envelope, not only its midpoint.
      expect(o.artLeft,o.id+' left edge').toBeGreaterThanOrEqual(o.left-1);
      expect(o.artRight,o.id+' right edge').toBeLessThanOrEqual(o.right+1);
      expect(o.artTop,o.id+' top edge').toBeGreaterThanOrEqual(o.top-1);
      expect(o.artBottom,o.id+' bottom edge').toBeLessThanOrEqual(o.bottom+1);
    }
    await page.screenshot({
      path:'test-results/away-realtime-formation-follow-'+width+'.png',
    });
    await page.reload();
    await expect(page.getByTestId('ground-realtime-toggle')).toHaveAttribute('aria-pressed','true');
    const restoredTeam=await page.evaluate(()=>{
      const raw=localStorage.getItem('shadowops.star-adventures.ground-realtime.v1');
      return JSON.parse(raw!).motion.officers as Array<{id:string;x:number;y:number}>;
    });
    expect(restoredTeam.map(o=>({id:o.id,x:o.x,y:o.y})))
      .toEqual(team.map(o=>({id:o.id,x:o.x,y:o.y})));

    // Classic rollback removes the experimental sidecar and restores v1.
    await page.locator('.ground-squad-instructions summary').click();
    await page.getByTestId('ground-realtime-toggle').click();
    await expect(page.getByTestId('ground-realtime-toggle')).toHaveAttribute('aria-pressed','false');
    await expect(resumed).toHaveAttribute('data-world-x','4.000');
    expect(await page.evaluate(()=>localStorage.getItem(
      'shadowops.star-adventures.ground-realtime.v1'))).toBeNull();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}


test.describe('legacy first-person deployment',()=>{
  test.use({storageState:legacyDiagnosticsStorageState});
  for(const width of [390,1280]){
  test('legacy deployment leaves tactical help clickable above the HUD at '+width+'px',async({page})=>{
    test.setTimeout(70000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await expect(page.getByTestId('explore-right')).toBeVisible({timeout:15000});
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-forward').click();
    await page.getByTestId('explore-right').click();
    await page.getByTestId('explore-use').click();
    await page.getByTestId('transport-confirm').click();
    await expect(page.getByTestId('ground-squad-board')).toBeVisible();
    const help=page.locator('.ground-squad-instructions summary');
    const hud=page.locator('.firstperson-hud');
    await expect(help).toBeVisible();
    await expect.poll(async()=>{
      const a=await help.boundingBox(),b=await hud.boundingBox();
      return !!a&&!!b&&a.y+a.height<=b.y+1;
    }).toBe(true);
    await help.click({timeout:10000});
    const toggle=page.getByTestId('ground-realtime-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click({timeout:10000});
    await expect(toggle).toHaveAttribute('aria-pressed','true');
    await page.screenshot({path:'test-results/ground-classic-help-no-overlap-'+width+'.png'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
});


for(const width of [390,1280]){
  test('stop selected realtime officer without teleporting and preserve stop on reload '+width,async({page})=>{
    test.setTimeout(70000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:15000});
    await page.getByTestId('captain-transport').click();
    await page.getByTestId('transport-confirm').click();
    await page.locator('.ground-squad-instructions summary').click();
    await page.getByTestId('ground-realtime-toggle').click();
    await page.getByTestId('ground-select-venn').click();
    const stop=page.getByTestId('ground-stop-officer');
    const officer=page.getByTestId('ground-unit-venn');
    await expect(stop).toBeDisabled();
    await page.getByTestId('ground-camera-toggle').click();
    if(width<=520)await page.getByTestId('ground-map-sector').selectOption('all');
    await clickGround(page,9,4);
    await expect(stop).toBeEnabled();
    await expect.poll(async()=>{
      const p=await pose(page);
      return Math.hypot(p.x-4,p.y-5);
    }).toBeGreaterThan(.08);
    await stop.click();
    await expect(officer).toHaveAttribute('data-walk-phase','idle');
    await expect(stop).toBeDisabled();
    await expect(page.getByTestId('ground-route-preview-venn')).toHaveCount(0);
    await expect(page.getByTestId('ground-current-notice')).toContainText('se ha detenido');
    const stopped=await pose(page);
    expect(Math.hypot(stopped.x-9,stopped.y-4)).toBeGreaterThan(.5);
    await page.screenshot({path:'test-results/ground-realtime-stopped-'+width+'.png'});
    await page.reload();
    await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-walk-phase','idle');
    expect(await pose(page)).toEqual(stopped);
    await expect(page.getByTestId('ground-stop-officer')).toBeDisabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}


for(const width of [390,1280]){
  test('stop selected formation atomically and restore every stopped pose '+width,async({page})=>{
    test.setTimeout(70000);
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:15000});
    await page.getByTestId('captain-transport').click();
    await page.getByTestId('transport-confirm').click();
    await page.locator('.ground-squad-instructions summary').click();
    await page.getByTestId('ground-realtime-toggle').click();
    await page.getByTestId('ground-select-all').click();
    const stop=page.getByTestId('ground-stop-officer');
    await expect(stop).toBeDisabled();
    await page.getByTestId('ground-camera-toggle').click();
    if(width<=520)await page.getByTestId('ground-map-sector').selectOption('all');
    const readMotion=()=>page.evaluate(()=>{
      const raw=localStorage.getItem('shadowops.star-adventures.ground-realtime.v1');
      return JSON.parse(raw!).motion.officers as Array<{id:string;x:number;y:number;route:Array<{x:number;y:number}>}>;
    });
    await clickGround(page,2,5);
    await expect(stop).toBeEnabled();
    const planned=await readMotion();
    expect(planned.filter(o=>o.route.length>0).length).toBeGreaterThanOrEqual(2);
    const goals=planned.map(o=>o.route.at(-1)??o);
    await stop.click();
    await expect(stop).toBeDisabled();
    await expect(page.getByTestId('ground-current-notice')).toContainText('Formación de 3 oficiales detenida');
    const stopped=await readMotion();
    expect(stopped.every(o=>o.route.length===0)).toBe(true);
    expect(stopped.some((o,i)=>Math.hypot(o.x-goals[i].x,o.y-goals[i].y)>.1)).toBe(true);
    for(const o of stopped)await expect(page.getByTestId('ground-unit-'+o.id)).toHaveAttribute('data-walk-phase','idle');
    await page.screenshot({path:'test-results/ground-realtime-formation-stopped-'+width+'.png'});
    await page.reload();
    await expect(page.getByTestId('ground-realtime-toggle')).toHaveAttribute('aria-pressed','true');
    expect(await readMotion()).toEqual(stopped);
    for(const o of stopped)await expect(page.getByTestId('ground-unit-'+o.id)).toHaveAttribute('data-walk-phase','idle');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
