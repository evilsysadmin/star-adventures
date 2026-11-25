// Groups already-authored blocked cells into continuous visual structures.
// Never edits collision, wayfinding, mission state, fog, or the source barriers.
// Call with the *explored* subset, so no undiscovered wall is drawn early.
const key=(x,y)=>x+','+y;
const styles=new Set(['rock','freight','lab','service']);
const checkCell=(w,width,height)=>w&&Number.isSafeInteger(w.x)&&
  Number.isSafeInteger(w.y)&&w.x>=0&&w.x<width&&w.y>=0&&w.y<height&&
  typeof w.key==='string'&&w.key===key(w.x,w.y)&&styles.has(w.wall)&&
  typeof w.sectorId==='string';

export function buildWideConnectedStructures(barriers,width,height){
  if(!Array.isArray(barriers)||!Number.isSafeInteger(width)||
     !Number.isSafeInteger(height)||width<4||height<4||
     width>100||height>100)
    throw new TypeError('Invalid wide connected geometry');
  const byCell=new Map();
  for(const item of barriers){
    if(!checkCell(item,width,height)||byCell.has(item.key))
      throw new TypeError('Invalid or duplicate connected wall cell');
    byCell.set(item.key,item);
  }
  const claimed=new Set(),structures=[];
  // The legacy 18x12 GLBs and exterior map perimeter are excluded from large
  // structures. They have their own established authored silhouettes.
  const eligible=w=>w.x>0&&w.x<width-1&&w.y>0&&w.y<height-1&&
    (w.x>=18||w.y>=12);
  for(const [axis,dx,dy] of [['x',1,0],['y',0,1]]){
    const ordered=[...byCell.values()].sort((a,b)=>a.y-b.y||a.x-b.x);
    for(const first of ordered){
      if(claimed.has(first.key)||!eligible(first))continue;
      const preceding=byCell.get(key(first.x-dx,first.y-dy));
      if(preceding&&!claimed.has(preceding.key)&&eligible(preceding)&&
         preceding.wall===first.wall&&preceding.sectorId===first.sectorId)
        continue;
      const run=[];
      let x=first.x,y=first.y;
      while(true){
        const next=byCell.get(key(x,y));
        if(!next||claimed.has(next.key)||!eligible(next)||
           next.wall!==first.wall||next.sectorId!==first.sectorId)break;
        run.push(next);
        x+=dx;y+=dy;
      }
      // A 1-2 cell remnant is better served by existing single-wall art.
      // Cap the span to avoid a massive feature over-occluding the scene.
      for(let offset=0;offset<run.length;offset+=7){
        const section=run.slice(offset,offset+7);
        if(section.length<3)continue;
        section.forEach(w=>claimed.add(w.key));
        const start=section[0],end=section.at(-1);
        structures.push({
          id:`${first.wall}-${start.x}-${start.y}-${axis}`,
          style:first.wall,sectorId:first.sectorId,axis,
          cells:section.map(w=>({x:w.x,y:w.y,key:w.key})),
          start:{x:start.x,y:start.y},end:{x:end.x,y:end.y},
          length:section.length,
        });
      }
    }
  }
  return structures;
}
