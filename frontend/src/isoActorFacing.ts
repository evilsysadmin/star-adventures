// Visual-only heading for tactical actors. Never authoritative for combat,
// navigation, line of sight, saves, or replay. World +x = increasing column,
// world +z = increasing row. A zero heading points along +z.
export function headingFromCells(from: string, to: string): number | null {
  const parse = (id: string): readonly [number, number] | null => {
    const match = /^(\d+):(\d+)$/.exec(id);
    if (!match) return null;
    const col = Number(match[1]), row = Number(match[2]);
    return Number.isSafeInteger(col) && Number.isSafeInteger(row) ? [col, row] : null;
  };
  const origin = parse(from), destination = parse(to);
  if (!origin || !destination) return null;
  const dx = destination[0] - origin[0], dz = destination[1] - origin[1];
  return dx === 0 && dz === 0 ? null : Math.atan2(dx, dz);
}

/** Screen-right in the fixed (+x,+z) isometric camera is dx-dz.
 * Existing V1 atlases show one illustrated view, not directional frames:
 * mirroring is valid only as an interim screen-left/right facing cue.
 */
export function isoSpriteSideFromCells(from:string,to:string): 'left'|'right'|null {
 const heading=headingFromCells(from,to);
 if(heading===null)return null;
 const screenX=Math.sin(heading)-Math.cos(heading);
 return Math.abs(screenX)<1e-9?null:screenX<0?'left':'right';
}
export function mirroredAtlasUv(frame:number,mirror:boolean,columns=3,rows=2) {
 if(!Number.isSafeInteger(frame)||!Number.isSafeInteger(columns)||!Number.isSafeInteger(rows)||columns<1||rows<1)
  throw new RangeError('Invalid sprite frame or atlas');
 const index=((frame%(columns*rows))+(columns*rows))%(columns*rows);
 const col=index%columns,row=Math.floor(index/columns);
 return {x:(col+(mirror?1:0))/columns,y:1-(row+1)/rows,
  repeatX:(mirror?-1:1)/columns,repeatY:1/rows};
}
