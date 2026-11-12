import {test,expect} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
test.use({storageState:{cookies:[],origins:[]}});
const fixture=fileURLToPath(new URL('./fixtures/k47-archive-candidate.glb',import.meta.url));
test.skip(!existsSync(fixture),'Only the dedicated K-47 art workflow builds the original candidate');

for(const width of [390,1280]){
 test('actual Archive GLB replaces background volume only after real exploration '+width,async({page})=>{
  test.setTimeout(135000);
  await page.setViewportSize({width,height:850});
  const body=readFileSync(fixture);
  const sha=createHash('sha256').update(body).digest('hex');
  const url='https://assets.chess-studio.shadowops.dpdns.org/star-adventures/environment/west-archive-shell-'+sha.slice(0,16)+'.glb';
  const manifest={schemaVersion:1,scene:'meridian.surface',slots:[{
   id:'west-archive-shell',footprint:[[0,3],[0,4],[0,5]],
   anchor:[0,0,4],status:'published',
   asset:{url,sha256:sha,bytes:body.length,license:'original',
     source:'Original ShadowOps authored K-47 Archive GLB'}
  }]};
  await page.addInitScript(value=>{
   (window as typeof window & {__k47ArtPreviewManifest?:unknown})
      .__k47ArtPreviewManifest=value;
  },manifest);
  let fetched=0;
  await page.route(url,route=>{
   fetched++;
   return route.fulfill({status:200,body,contentType:'model/gltf-binary',
    headers:{'access-control-allow-origin':'*'}});
  });
  await page.goto('/');
  await expect(page.getByTestId('captain-controls')).toBeVisible({timeout:25000});
  await page.getByTestId('captain-transport').click({timeout:25000});
  await page.getByTestId('transport-confirm').click();
  const board=page.getByTestId('ground-squad-board');
  const court=page.getByTestId('ground-landing-court-3d');
  await expect(court).toHaveAttribute('data-renderer-state','ready',{timeout:20000});
  await board.locator('[data-cell-id="1,4"]').click({button:'right'});
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-x','1');
  await expect(page.getByTestId('ground-unit-venn')).toHaveAttribute('data-grid-y','4');
  await expect(page.getByTestId('ground-unit-venn'))
    .toHaveAttribute('data-walk-phase','idle',{timeout:30000});
  await expect(court).toHaveAttribute('data-authored-art-ready','west-archive-shell',
    {timeout:35000});
  await expect(court).toHaveAttribute('data-authored-art-state','ready');
  await expect(page.getByTestId('ground-archive-volume-3d'))
    .toHaveCSS('visibility','hidden');
  expect(fetched).toBeGreaterThanOrEqual(1);
  await expect(board.locator('[data-cell-id]')).toHaveCount(216);
  await expect(page.getByTestId('ground-landmark-sensor-vault')).toHaveCount(1);
  await expect(page.getByTestId('ground-landmark-probe')).toHaveCount(1);
  await board.screenshot({path:'test-results/k47-archive-candidate-'+width+'.png'});
  await page.reload();
  await expect(court).toHaveAttribute('data-authored-art-ready','west-archive-shell',
     {timeout:35000});
  await expect(page.getByTestId('ground-archive-volume-3d'))
    .toHaveCSS('visibility','hidden');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    .toBe(true);
 });
}
