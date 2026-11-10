import {expect,test,type Page} from '@playwright/test';

// This is the real immersive bridge -> surface UI. No diagnostic journal mode.
test.use({storageState:{cookies:[],origins:[]}});

async function orderCell(page:Page,x:number,y:number){
 const board=page.getByTestId('ground-squad-board');
 const coords=await board.evaluate((node,{x,y})=>{
  const svg=node as SVGSVGElement,point=svg.createSVGPoint();
  point.x=440+(x-y)*40;point.y=52+(x+y)*20;
  const transform=svg.getScreenCTM();
  if(!transform)throw new Error('No camera transform');
  const result=point.matrixTransform(transform),bounds=svg.getBoundingClientRect();
  return {x:result.x-bounds.left,y:result.y-bounds.top};
 },{x,y});
 await board.click({button:'right',position:coords});
}

for(const width of [390,1280]){
 test('fog blocks unseen intel, walking reveals valley, F5 remembers only what was seen '+width,async({page})=>{
  test.setTimeout(115_000);
  page.setDefaultTimeout(18_000);
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25_000});
  await page.getByTestId('captain-transport').click({timeout:25_000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  await expect(board).toBeVisible();
  await page.getByTestId('ground-camera-toggle').click();
  await expect(board).toHaveAttribute('viewBox','-72 0 1280 640');
  await expect(page.getByTestId('ground-fog-layer')).toHaveCount(1);
  // The new medical volume is *only* an authored relief-point visual.
  // It inherits station discovery and never creates a new pick target.
  const medical=await board.evaluate(root=>{
    const all=[...root.querySelectorAll('[data-testid^="ground-landmark-"]')];
    const station=root.querySelector('[data-testid="ground-landmark-relief-point"]');
    const volume=station?.querySelector('[data-testid="ground-medical-facility-volume"]');
    const plaque=station?.querySelector('[data-testid="ground-waypoint-label-relief-point"]');
    const box=(volume as SVGGElement | null)?.getBBox();
    return {
      totalStations:all.length,
      exists:!!volume,
      passive:volume?getComputedStyle(volume).pointerEvents==='none':false,
      hiddenWhenUnknown:root.querySelector('[data-fog-cell="6,4"]')
        ?.getAttribute('data-fog-state')!=='unknown'||
        station?.getAttribute('visibility')==='hidden',
      size:box?{width:box.width,height:box.height}:null,
      originalLabel:plaque?.querySelector('text')?.textContent,
      shift:plaque?.getAttribute('transform'),
    };
  });
  expect(medical.totalStations).toBe(5);
  expect(medical.exists&&medical.passive&&medical.hiddenWhenUnknown).toBe(true);
  expect(medical.size?.height).toBeGreaterThan(120);
  expect(medical.originalLabel).toBe('SOCORRO');
  expect(medical.shift).toBe('translate(60 -85) scale(.78)');
  // Mission plaques are attached only to original stations and inherit
  // their discovered/undiscovered visibility; all pass events through.
  const waypoints=await board.evaluate(root=>
    [{id:'probe',cell:'4,2'},{id:'sensor-vault',cell:'2,2'},
     {id:'relief-point',cell:'6,4'},{id:'perimeter-uplink',cell:'7,5'},
     {id:'beam-out',cell:'4,6'}]
      .map(({id,cell})=>{
        const station=root.querySelector('[data-testid="ground-landmark-'+id+'"]');
        const plaque=station?.querySelector('[data-testid="ground-waypoint-label-'+id+'"]');
        return {id,exists:!!plaque,
          passive:plaque?getComputedStyle(plaque).pointerEvents==='none':false,
          caption:plaque?.querySelector('text')?.textContent,
          hidden:station?.getAttribute('visibility')==='hidden',
          unknown:root.querySelector('[data-fog-cell="'+cell+'"]')
            ?.getAttribute('data-fog-state')==='unknown'};
      }));
  expect(waypoints.every(p=>p.exists&&p.passive&&!!p.caption)).toBe(true);
  expect(waypoints.every(p=>!p.unknown||p.hidden)).toBe(true);
  // Base terrain is now continuous *behind* the authoritative fog, while the
  // exact same cell polygons remain as the only selectable world positions.
  const material=await board.evaluate(root=>{
    const byId=(id:string)=>root.querySelector('[data-cell-id="'+id+'"]');
    const all=[...root.querySelectorAll('polygon[data-cell-id]')];
    return {
      tiles:all.length,
      west:byId('4,4')?.getAttribute('fill'),
      neighboring:byId('5,4')?.getAttribute('fill'),
      east:byId('14,5')?.getAttribute('fill'),
      wall:byId('15,2')?.getAttribute('fill'),
      regions:[...root.querySelectorAll('[data-testid^="ground-continuous-floor-"]')]
        .map(node=>({area:node.getAttribute('data-testid'),
          pointer:getComputedStyle(node).pointerEvents,
          size:node.getAttribute('d')?.length??0})),
      gradients:[...root.querySelectorAll('linearGradient[id^="ground-continuous-"]')]
        .map(node=>node.getAttribute('gradientUnits')),
    };
  });
  expect(material.tiles).toBe(216);
  expect(material.west).toBe('url(#ground-continuous-colony)');
  expect(material.neighboring).toBe(material.west);
  expect(material.east).toBe('url(#ground-continuous-outside)');
  expect(material.wall).toBe('url(#ground-continuous-wallstone)');
  expect(material.regions).toHaveLength(2);
  expect(material.regions.every(x=>x.pointer==='none'&&x.size>200)).toBe(true);
  expect(material.gradients).toEqual(['userSpaceOnUse','userSpaceOnUse','userSpaceOnUse']);

  await expect(board.locator('[data-fog-cell="10,4"]')).toHaveAttribute('data-fog-state','unknown');
  // The never-explored sector is one continuous, opaque world-space
  // atmosphere: no per-cell palette revealing an obvious checkerboard.
  const continuous=page.getByTestId('ground-undiscovered-continuous-field');
  await expect(continuous).toHaveAttribute('fill','url(#ground-undiscovered-gradient)');
  await expect(continuous).toHaveAttribute('pointer-events','none');
  const fogMaterial=await board.evaluate(root=>{
    const cells=[...root.querySelectorAll('[data-fog-state="unknown"]')];
    const gradient=root.querySelector('#ground-undiscovered-gradient');
    const field=root.querySelector('[data-testid="ground-undiscovered-continuous-field"]');
    return {
      count:cells.length,
      fills:[...new Set(cells.map(cell=>cell.getAttribute('fill')))],
      opaque:cells.every(cell=>cell.getAttribute('fill-opacity')==='1'&&
        cell.getAttribute('stroke-opacity')==='0'),
      worldSpace:gradient?.getAttribute('gradientUnits'),
      unionPathLength:field?.getAttribute('d')?.length??0,
    };
  });
  expect(fogMaterial.count).toBeGreaterThan(40);
  expect(fogMaterial.fills).toEqual(['url(#ground-undiscovered-gradient)']);
  expect(fogMaterial.opaque).toBe(true);
  expect(fogMaterial.worldSpace).toBe('userSpaceOnUse');
  expect(fogMaterial.unionPathLength).toBeGreaterThan(300);

  // The undiscovered perimeter must not outline a floating island:
  // surround and hidden tiles share the exact world-space paint.
  const seam=await board.evaluate(root=>{
    const surround=root.querySelector('[data-testid="ground-fog-seamless-surround"]');
    const unknown=root.querySelector('[data-fog-state="unknown"]');
    const gradient=root.querySelector('#ground-undiscovered-gradient');
    const haze=root.querySelector('[data-testid="ground-shared-atmospheric-haze"]');
    const pick=root.querySelector('polygon[data-cell-id]');
    const fog=root.querySelector('[data-testid="ground-fog-layer"]');
    const backdrop=root.querySelector('[data-testid="ground-planet-backdrop"]');
    return {
      matchingFill:surround?.getAttribute('fill')===unknown?.getAttribute('fill'),
      fullBleed:surround?.getAttribute('x')==='-72'&&
        surround?.getAttribute('width')==='1280'&&
        surround?.getAttribute('height')==='640',
      sameWorldCoords:gradient?.getAttribute('gradientUnits')==='userSpaceOnUse',
      passive:surround?getComputedStyle(surround).pointerEvents==='none':false,
      hazePassive:haze?getComputedStyle(haze).pointerEvents==='none':false,
      hazeNoTargets:haze?.querySelectorAll('[data-cell-id],[data-fog-cell],[data-officer-id]').length===0,
      afterBackdrop:!!surround&&!!backdrop&&
        Boolean(backdrop.compareDocumentPosition(surround)&Node.DOCUMENT_POSITION_FOLLOWING),
      beforePicking:!!surround&&!!pick&&
        Boolean(surround.compareDocumentPosition(pick)&Node.DOCUMENT_POSITION_FOLLOWING),
      weatherAfterFog:!!fog&&!!haze&&
        Boolean(fog.compareDocumentPosition(haze)&Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
  expect(seam).toEqual({
    matchingFill:true,fullBleed:true,sameWorldCoords:true,
    passive:true,hazePassive:true,hazeNoTargets:true,
    afterBackdrop:true,beforePicking:true,weatherAfterFog:true,
  });

  await expect(page.getByTestId('ground-scenery-crystal-5')).toHaveAttribute('visibility','hidden');
  await board.screenshot({path:'test-results/away-fog-unknown-'+width+'.png'});

  // A long move is an exploration order: the new area is learned from the
  // real route, not from a map legend or pre-revealed mission marker.
  await orderCell(page,9,4);
  const venn=page.getByTestId('ground-unit-venn');
  await expect(venn).toHaveAttribute('data-grid-x','9');
  await expect(venn).toHaveAttribute('data-grid-y','4');
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:18_000});
  await expect(board.locator('[data-fog-cell="10,4"]')).toHaveCount(0);
  await board.screenshot({path:'test-results/away-fog-visible-'+width+'.png'});
  await orderCell(page,4,5);
  await expect(venn).toHaveAttribute('data-grid-x','4');
  await expect(venn).toHaveAttribute('data-walk-phase','idle',{timeout:18_000});
  await expect(board.locator('[data-fog-cell="10,4"]')).toHaveAttribute('data-fog-state','remembered');
  await expect(board.locator('[data-fog-cell="10,4"]'))
    .toHaveAttribute('fill-opacity','0.6');
  // The expanded east edge is still wholly unknown at this point.
  await expect(board.locator('[data-fog-cell="16,10"]'))
    .toHaveAttribute('data-fog-state','unknown');
  await board.screenshot({path:'test-results/away-fog-memory-'+width+'.png'});

  await page.reload();
  await expect(page.getByTestId('ground-squad-board')).toBeVisible();
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','4');
  await expect(page.getByTestId('ground-squad-board').locator('[data-fog-cell="10,4"]'))
   .toHaveAttribute('data-fog-state','remembered');
  const hasDuplicateFogSave=await page.evaluate(()=>Object.keys(localStorage).some(key=>key.includes('ground-fog')));
  expect(hasDuplicateFogSave).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
