// Presentation-only collision test in canonical SVG coordinates. All
// positions use the same projection as the unit art; camera/zoom is irrelevant.
type Rect={left:number;right:number;top:number;bottom:number};
type Actor={id:string;x:number;y:number;bodyTop:number;plateY:number;plateWidth:number;selected:boolean};
const overlap=(a:Rect,b:Rect)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
const body=(u:Actor):Rect=>({left:u.x-21,right:u.x+21,top:u.y+u.bodyTop,bottom:u.y+8});
const plate=(u:Actor):Rect=>({left:u.x-u.plateWidth/2-1,right:u.x+u.plateWidth/2+1,top:u.y+u.plateY-11,bottom:u.y+u.plateY+9});

// Bodies always win, then selected labels, then stable roster order.
// Suppress only conflicting labels, not actors/hitboxes. Recompute from
// actual positions so separation restores names with no stored UI state.
export function visibleGroundNameplates(actors:readonly Actor[]):ReadonlySet<string>{
 const visible=new Set<string>(),occupied:Rect[]=[];
 const order=[...actors.filter(u=>u.selected),...actors.filter(u=>!u.selected)];
 for(const u of order){
  const box=plate(u);
  if(actors.some(other=>other.id!==u.id&&overlap(box,body(other)))||
    occupied.some(other=>overlap(box,other)))continue;
  visible.add(u.id);occupied.push(box);
 }
 return visible;
}
