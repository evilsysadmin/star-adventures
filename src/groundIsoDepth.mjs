/**
 * Painter's order for ground officers in the fixed isometric projection.
 * Only the foot position determines visual depth: never rely on deployment
 * order, which can put a distant officer on top of a nearer one.
 *
 * The replayed grid remains authoritative. An in-flight walk pose changes
 * painting order only, never coordinates, selection IDs or saved commands.
 *
 * @template {{id:string,x:number,y:number}} T
 * @param {readonly T[]} officers
 * @param {{officerId:string,x:number,y:number}|null} walkPose
 * @returns {T[]}
 */
export function orderGroundOfficersByDepth(officers, walkPose = null) {
  const point = unit => walkPose?.officerId === unit.id ? walkPose : unit;
  return [...officers].sort((left, right) => {
    const a = point(left);
    const b = point(right);
    return a.y - b.y || a.x - b.x ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  });
}
