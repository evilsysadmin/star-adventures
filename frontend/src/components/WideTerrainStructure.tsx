// Paint-only multi-cell terrain silhouette. Coordinates describe a contiguous
// run of already-explored, physically blocked cells from the authoritative map.
// No events, new collision, fog, or hidden terrain are created by this SVG.
type Cell={x:number;y:number;key:string};
export type ConnectedStructure={
 id:string;style:string;sectorId:string;axis:string;
 cells:Cell[];start:{x:number;y:number};end:{x:number;y:number};length:number;
};
const point=(x:number,y:number)=>({x:440+(x-y)*40,y:52+(x+y)*20});
const pairs=(p:{x:number;y:number}[])=>p.map(x=>`${x.x},${x.y}`).join(' ');
function roofOutline(structure:ConnectedStructure){
 const centers=structure.cells.map(cell=>point(cell.x,cell.y));
 const first=centers[0],last=centers.at(-1)!;
 if(structure.axis==='x')return [
  {x:first.x-40,y:first.y},
  {x:first.x,y:first.y-20},
  ...centers.map(p=>({x:p.x+40,y:p.y})),
  {x:last.x,y:last.y+20},
  ...[...centers].reverse().map(p=>({x:p.x-40,y:p.y})),
 ];
 return [
  {x:first.x,y:first.y-20},
  {x:first.x+40,y:first.y},
  ...centers.slice(1).map(p=>({x:p.x+40,y:p.y})),
  {x:last.x,y:last.y+20},
  {x:last.x-40,y:last.y},
  ...centers.slice(0,-1).reverse().map(p=>({x:p.x-40,y:p.y})),
 ];
}
const colors={
 rock:{roof:'#899283',light:'#c7c6ad',edge:'#4e6258',side:'#344b45',seam:'#798673'},
 freight:{roof:'#aba18c',light:'#d7ccad',edge:'#645f54',side:'#424d4c',seam:'#c5ac78'},
 lab:{roof:'#a4c8c1',light:'#e0f1de',edge:'#4c8c8c',side:'#315c65',seam:'#8ad8c9'},
 service:{roof:'#91aaa4',light:'#d0dacb',edge:'#436b6e',side:'#2a4c59',seam:'#cbb781'},
} as const;

export function WideTerrainStructure({structure}:{structure:ConnectedStructure}){
 const tone=colors[structure.style as keyof typeof colors]??colors.service;
 const outline=roofOutline(structure);
 const centers=structure.cells.map(cell=>point(cell.x,cell.y));
 const start=centers[0],end=centers.at(-1)!;
 const roof=pairs(outline);
 const ridgeLine=centers.map((p,i)=>
  `${i?'L':'M'} ${p.x} ${p.y-9-(structure.style==='rock'?(i%3)*6:0)}`).join(' ');
 return <g data-wide-structure={structure.id}
   data-wide-structure-style={structure.style}
   data-wide-structure-size={structure.length}
   data-wide-structure-cells={structure.cells.map(c=>c.key).join(';')}
   pointerEvents="none" aria-hidden="true">
   {/* Side faces share a single continuous upper lip rather than one cube
       per tile; the entire footprint is 3-7 real impassable diamonds. */}
   <polygon points={pairs(outline.map(p=>({x:p.x,y:p.y+23})))}
     fill={tone.side} opacity=".82"/>
   {outline.map((p,i)=>{
     const q=outline[(i+1)%outline.length];
     if(q.x>=p.x)return null;
     return <polygon key={i}
       points={pairs([p,q,{x:q.x,y:q.y+23},{x:p.x,y:p.y+23}])}
       fill={i%2===0?tone.side:tone.edge}
       stroke={tone.edge} strokeWidth="1.2"/>;
   })}
   <polygon points={roof} fill={tone.roof}
     stroke={tone.light} strokeWidth="2.3" strokeLinejoin="round"/>
   {structure.style==='rock'&&<>
     <path d={ridgeLine} stroke={tone.light} strokeWidth="3.4"
       fill="none" strokeLinejoin="round" strokeLinecap="round" opacity=".8"/>
     <path d={`M ${start.x} ${start.y+7} L ${end.x} ${end.y+7}`}
       stroke="#566a60" strokeWidth="4.5" opacity=".8" fill="none"/>
     <path d={centers.map((p,i)=>
       `${i?'L':'M'} ${p.x+5} ${p.y+3+(i%2)*3}`).join(' ')}
       stroke="#d1c5a2" strokeWidth="1.5" opacity=".7" fill="none"/>
   </>}
   {structure.style==='freight'&&<>
     <path d={`M ${start.x} ${start.y-6} L ${end.x} ${end.y-6}`}
       stroke="#34484c" strokeWidth="8" opacity=".7" fill="none"/>
     <path d={`M ${start.x} ${start.y-9} L ${end.x} ${end.y-9}`}
       stroke="#f0cb77" strokeWidth="2.5" opacity=".9" fill="none"/>
     {centers.filter((_,i)=>i%2===0).map((p,i)=>
       <path key={i} d={`M ${p.x-9} ${p.y+4} l 18 -9`}
         stroke="#eee0bb" strokeWidth="2.2" opacity=".6"/>)}
   </>}
   {structure.style==='lab'&&<>
     <path d={`M ${start.x} ${start.y-8} L ${end.x} ${end.y-8}`}
       stroke="#5a8d91" strokeWidth="10" opacity=".85" fill="none"/>
     <path d={`M ${start.x} ${start.y-8} L ${end.x} ${end.y-8}`}
       stroke="#c6f7e4" strokeWidth="3.4" opacity=".9" fill="none"/>
     {centers.filter((_,i)=>i%2===0).map((p,i)=>
       <circle key={i} cx={p.x} cy={p.y+6} r="3.1"
         fill="#e8e8d2" stroke="#5c9292" strokeWidth="1.2"/>)}
   </>}
   {structure.style==='service'&&<>
     <path d={`M ${start.x} ${start.y-8} L ${end.x} ${end.y-8}`}
       stroke="#344e56" strokeWidth="10" fill="none"/>
     <path d={`M ${start.x} ${start.y-8} L ${end.x} ${end.y-8}`}
       stroke="#b4d8cd" strokeWidth="3" fill="none"/>
   </>}
 </g>;
}
