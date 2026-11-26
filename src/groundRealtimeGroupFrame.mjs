// View-only framing of selected continuous officers. No gameplay, fog,
// route, save or camera WebGL mutation. Positions are canonical projected SVG
// coordinates; the real SVG CTM continues to own every pick event.
export function groundRealtimeGroupFrame(points, aspect, baseHeight, compact=false, maxHeight=compact?620:520) {
  if (!Array.isArray(points) || points.length < 2 || points.length > 16 ||
      !Number.isFinite(aspect) || aspect <= 0 || aspect > 10 ||
      !Number.isFinite(baseHeight) || baseHeight <= 0 ||
      !Number.isFinite(maxHeight) || maxHeight<=0 || maxHeight>1600 ||
      points.some(p=>!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    throw new TypeError('Invalid realtime group camera input');
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs);
  const minY=Math.min(...ys),maxY=Math.max(...ys);
  // Paddings include real sprite selection rings, nameplates, and a small
  // touch-safe air gap. Portrait only zooms back as much as the squad needs.
  const marginX=compact ? 36 : 50;
  const marginY=compact ? 65 : 60;
  const needed=Math.max(baseHeight,
    (maxX-minX+2*marginX)/aspect,
    maxY-minY+2*marginY);
  // Beyond this zoom, officers become unreadable. Keep the group centroid
  // instead of inventing a map reveal; offer the existing full-map control.
  const limit=maxHeight;
  const height=Math.max(baseHeight,Math.min(limit,Math.ceil(needed)));
  return {
    center:{x:(minX+maxX)/2,y:(minY+maxY)/2},
    height,
    fits:needed<=height+.5,
  };
}

// The ordinary K-47 portrait group starts closer than solo follow. The
// existing group envelope still expands as the real officers spread out.
// Desktop and other callers keep their existing baseline.
export function groundCompactGroupFollowHeight(baseHeight,compact){
 if(!Number.isFinite(baseHeight)||baseHeight<=0)throw new TypeError('Invalid group follow height');
 return compact?Math.min(baseHeight,420):baseHeight;
}
