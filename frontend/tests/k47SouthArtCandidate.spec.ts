import {test,expect} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Normal game CI never generates the candidate: only the dedicated art gate
// does. This spec cannot turn an unpublished GLB into a production request.
test.use({storageState:{cookies:[],origins:[]}});
const fixture=fileURLToPath(new URL('./fixtures/k47-south-candidate.glb',import.meta.url));
test.skip(!existsSync(fixture),'Run the K-47 original art workflow to generate the candidate');

for(const width of [390,1280]){
 test('render original authored south industrial GLB inside REAL ground gameplay '+width,async({page})=>{
  test.setTimeout(125000);
  await page.setViewportSize({width,height:850});
  const body=readFileSync(fixture);
  const sha=createHash('sha256').update(body).digest('hex');
  const url='https://assets.chess-studio.shadowops.dpdns.org/star-adventures/environment/south-industrial-shell-'+sha.slice(0,16)+'.glb';
  const manifest={
   schemaVersion:1,scene:'meridian.surface',
   slots:[{
    id:'south-industrial-shell',
    footprint:[[3,7],[4,7],[5,7],[6,7],[7,7]],
    anchor:[5,0,7],status:'published',
    asset:{url,sha256:sha,bytes:body.byteLength,license:'original',
      source:'Original ShadowOps authored K-47 industrial shell'}
   }]
  };
  await page.addInitScript(value=>{
    (window as typeof window & {__k47ArtPreviewManifest?:unknown})
      .__k47ArtPreviewManifest=value;
  },manifest);
  let requests=0;
  await page.route(url,route=>{
    requests++;
    return route.fulfill({status:200,body,contentType:'model/gltf-binary',
      headers:{'access-control-allow-origin':'*'}});
  });
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
  await page.getByTestId('captain-transport').click({timeout:25000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  const court=page.getByTestId('ground-landing-court-3d');
  await expect(court).toHaveAttribute('data-published-art-slots','1');
  await expect(court).toHaveAttribute('data-renderer-state','ready',{timeout:20000});
  // No test-only fog reveal. Normal player orders must discover all cells.
  await board.locator('[data-cell-id="5,6"]').click({button:'right'});
  await expect(page.getByTestId('ground-unit-venn'))
    .toHaveAttribute('data-grid-y','6');
  await expect(court).toHaveAttribute('data-authored-art-ready',
    'south-industrial-shell',{timeout:35000});
  await expect(court).toHaveAttribute('data-authored-art-state','ready');
  await expect(board.getByTestId('ground-south-industrial-wing'))
    .toHaveCSS('opacity','0');
  expect(requests).toBeGreaterThanOrEqual(1);
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  await board.screenshot({path:'test-results/k47-south-candidate-'+width+'.png'});
  await page.reload();
  await expect(court).toHaveAttribute('data-authored-art-ready',
    'south-industrial-shell',{timeout:35000});
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    .toBe(true);
 });
}
