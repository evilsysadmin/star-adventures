import {OrthographicCamera,Vector3} from 'three';

// Exact orthographic counterpart of GroundSquadSelection's authored surface
// projection: screen = (440 + (x-z)*40, 52 + (x+z)*20).
// Camera changes must preserve this mapping; the existing SVG owns all picking.
export const ARCHIVE_RENDER_WIDTH=1120;
export const ARCHIVE_RENDER_HEIGHT=550;
export const ARCHIVE_PX_PER_WORLD=40*Math.SQRT2;
const target=new Vector3(7.075,0,4.075);

export function makeGroundArchiveCamera(){
  const halfW=ARCHIVE_RENDER_WIDTH/(2*ARCHIVE_PX_PER_WORLD);
  const halfH=ARCHIVE_RENDER_HEIGHT/(2*ARCHIVE_PX_PER_WORLD);
  const camera=new OrthographicCamera(-halfW,halfW,halfH,-halfH,.1,150);
  camera.position.copy(target).add(new Vector3(12,12*Math.sqrt(2/3),12));
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}
