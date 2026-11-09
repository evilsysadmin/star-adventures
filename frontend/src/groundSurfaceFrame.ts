// Canonical SVG projection remains unchanged. The full-map frame derives
// from authored terrain dimensions; it is never a second movement grid.
export const GROUND_ISO_X=440;
export const GROUND_ISO_Y=52;
export const GROUND_TILE_HALF_WIDTH=40;
export const GROUND_TILE_HALF_HEIGHT=20;

export function groundSurfaceFrame(width:number,height:number){
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
    width<3||height<3||width>100||height>100)
    throw new RangeError('Invalid ground surface frame');
  // 32/48 px of horizontal breathing room around the extreme true tile tips,
  // and enough vertical room to avoid cutting off the southern platform.
  const minX=GROUND_ISO_X-GROUND_TILE_HALF_WIDTH*height-32;
  const maxX=GROUND_ISO_X+GROUND_TILE_HALF_WIDTH*width+48;
  const top=0;
  const bottom=GROUND_ISO_Y+GROUND_TILE_HALF_HEIGHT*(width+height-1)+8;
  return {left:minX,top,width:maxX-minX,height:bottom-top};
}
