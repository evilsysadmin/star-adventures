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
