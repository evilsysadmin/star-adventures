// Genuine four-view walking sheets are visual-only, never battle authority.
// Six animation frames across; four world-facing rows top-to-bottom:
// north (-z), east (+x), south (+z), west (-x). Camera at (+x,+z).
export const WALK4_DIRECTIONS=['north','east','south','west'] as const;
export type Walk4Direction=(typeof WALK4_DIRECTIONS)[number];
export const WALK4_COLUMNS=6, WALK4_ROWS=4, WALK4_FRAMES=6;
export function walk4Direction(from:string,to:string):Walk4Direction|null{
 const a=/^(0|[1-9]\d*):(0|[1-9]\d*)$/.exec(from);
 const b=/^(0|[1-9]\d*):(0|[1-9]\d*)$/.exec(to);
 if(!a||!b)return null;
 const dx=Number(b[1])-Number(a[1]),dz=Number(b[2])-Number(a[2]);
 if(!Number.isSafeInteger(dx)||!Number.isSafeInteger(dz))return null;
 if(dx===0&&dz<0)return 'north';
 if(dx>0&&dz===0)return 'east';
 if(dx===0&&dz>0)return 'south';
 if(dx<0&&dz===0)return 'west';
 return null;
}
export function walk4Uv(frame:number,direction:Walk4Direction){
 if(!Number.isSafeInteger(frame)||!WALK4_DIRECTIONS.includes(direction))
  throw new RangeError('Invalid walking frame/direction');
 const column=((frame%WALK4_FRAMES)+WALK4_FRAMES)%WALK4_FRAMES;
 const row=WALK4_DIRECTIONS.indexOf(direction);
 return {x:column/WALK4_COLUMNS,y:1-(row+1)/WALK4_ROWS,
  repeatX:1/WALK4_COLUMNS,repeatY:1/WALK4_ROWS};
}
export function validWalk4Dimensions(width:unknown,height:unknown):boolean{
 return typeof width==='number'&&typeof height==='number'&&
  Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&
  width>=WALK4_COLUMNS*64&&height>=WALK4_ROWS*64&&
  width%WALK4_COLUMNS===0&&height%WALK4_ROWS===0;
}
