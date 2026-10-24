export type TacticalCellHit = { col: number; row: number; id: string; blocked: boolean };
export type TacticalCameraProbe = {
  projectCell(col: number, row: number): {
    clientX: number; clientY: number; ndcX: number; ndcY: number;
  };
  pick(clientX: number, clientY: number): TacticalCellHit | null;
  selectCell(col: number, row: number): void;
  getSelected(): TacticalCellHit | null;
  dispose(): void;
};
export function mountTacticalCamera(
  canvas: HTMLCanvasElement,
  onCell: (cell: TacticalCellHit) => void,
): TacticalCameraProbe;
