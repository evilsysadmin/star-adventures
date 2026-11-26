// View-local status, never a source of motion, saved state or route validation.
// Observe only the officers that belonged to the most recently accepted order.
export function groundRealtimeMoveNotice(
 notice:string, orderedIds:readonly string[], movingIds:readonly string[],
):string {
 if(!orderedIds.length||orderedIds.some(id=>movingIds.includes(id)))return notice;
 return notice.replace(' en marcha hacia ', ' ha llegado a ');
}

// The realtime formation planner accepts a rounded leader anchor. Solo
// movement preserves its fractional target. Display exactly that distinction.
export function groundMoveTargetLabel(
 destination:Readonly<{x:number;y:number}>, count:number,
):string {
 const target=count>1?{x:Math.round(destination.x),y:Math.round(destination.y)}:destination;
 return target.x.toFixed(1)+':'+target.y.toFixed(1);
}
