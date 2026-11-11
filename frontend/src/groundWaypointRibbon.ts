// Pure camera-only presentation math. No import from the rules domain,
// fog, station scene or Three. Used for small-screen objective ribbons.
export type LabelViewFrame={readonly left:number;readonly width:number};

export function waypointRibbonShift(
 anchorX:number,desiredOffset:number,labelWidth:number,
 frame:LabelViewFrame,scale=.78,margin=8,
):number|null{
 if(![anchorX,desiredOffset,labelWidth,frame.left,frame.width,scale,margin]
   .every(Number.isFinite)||
   labelWidth<=0||frame.width<=0||scale<=0||margin<0)return null;
 const right=frame.left+frame.width;
 // An objective offscreen must NEVER have its label dragged onscreen;
 // the world station stays at its real coordinate and fog keeps authority.
 if(anchorX<frame.left||anchorX>right)return null;
 const halfWidth=labelWidth*scale/2;
 const minimum=frame.left+halfWidth+margin;
 const maximum=right-halfWidth-margin;
 if(minimum>maximum)return null;
 const proposed=anchorX+desiredOffset;
 const finalX=Math.min(maximum,Math.max(minimum,proposed));
 return finalX-proposed;
}
