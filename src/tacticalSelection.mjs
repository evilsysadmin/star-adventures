// Pure selection rules. Screen coordinates are CSS pixels in one coordinate
// space; the renderer owns projection and visibility. No movement is issued.
const validId = id => typeof id === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(id);
const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const rosterIds = roster => {
  if (!Array.isArray(roster) || roster.length > 32) throw new TypeError('Invalid roster');
  const seen = new Set();
  for (const unit of roster) {
    if (!unit || !validId(unit.id) || seen.has(unit.id) || !point(unit) || typeof unit.visible !== 'boolean')
      throw new TypeError('Invalid projected officer');
    seen.add(unit.id);
  }
  return seen;
};
const validateSelection = (selected, ids) => {
  if (!Array.isArray(selected) || new Set(selected).size !== selected.length || selected.some(id => !ids.has(id)))
    throw new TypeError('Invalid selection');
};
const ordered = (roster, ids) => roster.filter(unit => unit.visible && ids.has(unit.id)).map(unit => unit.id);

/** Distinguish a selection drag from a click using CSS-pixel displacement. */
export function isSelectionDrag(start, end, threshold = 8) {
  if (!point(start) || !point(end) || !Number.isFinite(threshold) || threshold < 0)
    throw new TypeError('Invalid pointer gesture');
  return Math.hypot(end.x - start.x, end.y - start.y) > threshold;
}

/** The caller resolves a clicked visible officer, or null for empty ground. */
export function selectOfficer(roster, selected, target, additive = false) {
  const ids = rosterIds(roster);
  validateSelection(selected, ids);
  if (typeof additive !== 'boolean' || (target !== null && !roster.some(unit => unit.id === target && unit.visible)))
    throw new TypeError('Invalid selection target');
  if (!additive) return target === null ? [] : [target];
  const next = new Set(selected);
  if (target !== null) next.has(target) ? next.delete(target) : next.add(target);
  return ordered(roster, next);
}

/** Select visible projected centers within a normalized inclusive rectangle. */
export function selectOfficerRectangle(roster, selected, start, end, additive = false) {
  const ids = rosterIds(roster);
  validateSelection(selected, ids);
  if (!point(start) || !point(end) || typeof additive !== 'boolean') throw new TypeError('Invalid selection rectangle');
  const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
  const next = new Set(additive ? selected : []);
  for (const unit of roster)
    if (unit.visible && unit.x >= minX && unit.x <= maxX && unit.y >= minY && unit.y <= maxY) next.add(unit.id);
  return ordered(roster, next);
}
