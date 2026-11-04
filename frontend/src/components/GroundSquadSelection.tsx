
import { useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import world from '../../../content/scenes/meridian.json';
import { isSelectionDrag, selectOfficer, selectOfficerRectangle } from '../../../src/tacticalSelection.mjs';
import './groundSquadSelection.css';

type Officer = { id: string; name: string };
type Point = { x: number; y: number };
type Gesture = { pointerId: number; start: Point; target: string | null; tile: string | null; additive: boolean };
const scene = world.scenes.surface;
const tile = (col: number, row: number): Point => ({ x: 440 + (col - row) * 40, y: 52 + (col + row) * 20 });
const tileShape = (col: number, row: number) => {
  const { x, y } = tile(col, row);
  return [x + ',' + (y - 20), (x + 40) + ',' + y, x + ',' + (y + 20), (x - 40) + ',' + y].join(' ');
};
const blocked = new Set(scene.walls.map(cell => cell.x + ',' + cell.y));
const sceneTiles = Array.from({ length: scene.height }, (_, y) =>
  Array.from({ length: scene.width }, (_, x) => ({ x, y, key: x + ',' + y }))).flat();

export function GroundSquadSelection({
  squad, position, onMove, disabled = false,
}: {
  squad: Officer[];
  position: { x: number; y: number };
  onMove: (target: Point) => boolean;
  disabled?: boolean;
}) {
  // The current campaign has ONE authoritative ground position. These display
  // offsets are visual-only and never become fabricated individual coordinates.
  const squadCenter = tile(position.x, position.y);
  const units = squad.map((officer, index) => ({
    ...officer,
    x: squadCenter.x + (index - (squad.length - 1) / 2) * 48,
    y: squadCenter.y + (index % 2 === 0 ? 13 : -13),
  }));
  const [selected, setSelected] = useState<string[]>(() => squad[0] ? [squad[0].id] : []);
  const [moveMode, setMoveMode] = useState(false);
  const [moveNotice, setMoveNotice] = useState('Selecciona todo el equipo para dar una orden de marcha.');
  const [keyboardCell, setKeyboardCell] = useState<Point>(() => ({x:position.x,y:position.y}));
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const screenRoster = () => {
    const root = svg.current;
    const matrix = root?.getScreenCTM();
    if (!root || !matrix) return null;
    return units.map(unit => {
      const point = root.createSVGPoint();
      point.x = unit.x;
      point.y = unit.y;
      const center = point.matrixTransform(matrix);
      return { id: unit.id, x: center.x, y: center.y, visible: true };
    });
  };

  const requestMove = (tileId: string | null) => {
    if (!tileId || disabled) return;
    setMoveMode(false);
    if (selected.length !== squad.length || squad.length === 0) {
      setMoveNotice('Selecciona todo el equipo. El movimiento individual llegará en otra iteración.');
      return;
    }
    const [x,y] = tileId.split(',').map(Number);
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || blocked.has(tileId) ||
        scene.objects.some(object => object.x === x && object.y === y)) {
      setMoveNotice('Casilla bloqueada u ocupada; el equipo no se mueve.');
      return;
    }
    if (x === position.x && y === position.y) {
      setMoveNotice('El equipo ya está aquí.');
      return;
    }
    const success = onMove({x,y});
    setMoveNotice(success ? 'Equipo en ' + x + ':' + y : 'No hay ruta segura hasta esa casilla.');
  };
  const onBoardKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (disabled || !moveMode || event.altKey || event.ctrlKey || event.metaKey) return;
    const offsets: Record<string, [number,number]> = {
      ArrowUp:[0,-1], ArrowRight:[1,0], ArrowDown:[0,1], ArrowLeft:[-1,0],
    };
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      requestMove(keyboardCell.x + ',' + keyboardCell.y);
    } else if (offsets[event.key]) {
      event.preventDefault();
      setKeyboardCell(cell => ({
        x: Math.max(0,Math.min(scene.width-1,cell.x+offsets[event.key][0])),
        y: Math.max(0,Math.min(scene.height-1,cell.y+offsets[event.key][1])),
      }));
    }
  };
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (disabled || event.button !== 0 || !event.isPrimary) return;
    const target = (event.target as Element).closest('[data-officer-id]')?.getAttribute('data-officer-id') ?? null;
    const tileTarget = (event.target as Element).closest('[data-cell-id]')?.getAttribute('data-cell-id') ?? null;
    gesture.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      target,
      tile: tileTarget,
      additive: event.shiftKey,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!gesture.current || gesture.current.pointerId !== event.pointerId) return;
    const end = { x: event.clientX, y: event.clientY };
    setMarquee(isSelectionDrag(gesture.current.start, end)
      ? { start: gesture.current.start, end } : null);
  };
  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    gesture.current = null;
    setMarquee(null);
    const roster = screenRoster();
    if (!roster || disabled) return;
    const end = { x: event.clientX, y: event.clientY };
    if (!isSelectionDrag(start.start, end) && moveMode && start.tile) {
      requestMove(start.tile);
      return;
    }
    if (isSelectionDrag(start.start, end))
      setSelected(previous => selectOfficerRectangle(roster, previous, start.start, end, start.additive));
    else
      setSelected(previous => selectOfficer(roster, previous, start.target, start.additive));
  };
  const cancelGesture = () => { gesture.current = null; setMarquee(null); };
  const rootBounds = svg.current?.getBoundingClientRect();
  const marqueeStyle = marquee && rootBounds ? {
    left: Math.min(marquee.start.x, marquee.end.x) - rootBounds.left,
    top: Math.min(marquee.start.y, marquee.end.y) - rootBounds.top,
    width: Math.abs(marquee.start.x - marquee.end.x),
    height: Math.abs(marquee.start.y - marquee.end.y),
  } : undefined;

  return <div className="ground-squad" data-testid="ground-squad-selection">
    <div className="ground-squad-viewport">
      <svg ref={svg} data-testid="ground-squad-board" viewBox="0 0 900 430" tabIndex={0}
        preserveAspectRatio="xMidYMid meet" role="img" onKeyDown={onBoardKeyDown}
        aria-label="Vista elevada del puesto planetario, con los tres oficiales desplegados"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={cancelGesture}
        onLostPointerCapture={cancelGesture} onContextMenu={event => {
          event.preventDefault();
          requestMove((event.target as Element).closest('[data-cell-id]')?.getAttribute('data-cell-id') ?? null);
        }}>
        <defs>
          <linearGradient id="ground-terrain" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#45646a" /><stop offset="1" stopColor="#243b43" />
          </linearGradient>
          <radialGradient id="ground-sky">
            <stop offset="0" stopColor="#45636b" /><stop offset="1" stopColor="#101b29" />
          </radialGradient>
        </defs>
        <rect width="900" height="430" fill="url(#ground-sky)" />
        <ellipse cx="450" cy="324" rx="345" ry="66" fill="#081219" opacity=".55" />
        {sceneTiles.map(cell => <polygon key={cell.key} data-cell-id={cell.key} points={tileShape(cell.x, cell.y)}
          fill={blocked.has(cell.key) ? '#142936' : (cell.x + cell.y) % 2 ? '#45605e' : 'url(#ground-terrain)'}
          stroke="#6d8c86" strokeOpacity=".28" strokeWidth="1" />)}
        {scene.walls.filter(cell => cell.x > 0 && cell.y > 0 &&
          cell.x < scene.width - 1 && cell.y < scene.height - 1).map(cell => {
            const p = tile(cell.x, cell.y);
            return <g key={cell.x + ',' + cell.y} transform={'translate(' + p.x + ' ' + p.y + ')'} pointerEvents="none">
              <path d="M-31 0 L0 -15 31 0 0 15Z" fill="#52615c" />
              <path d="M-31 0 L0 15 V-15 L-31 -27Z" fill="#293c42" />
              <path d="M0 15 L31 0 V-27 L0 -15Z" fill="#1a2b34" />
            </g>;
          })}
        {scene.objects.map((object, index) => {
          const p = tile(object.x, object.y);
          return <g key={object.id} transform={'translate(' + p.x + ' ' + p.y + ')'} pointerEvents="none">
            <ellipse rx="22" ry="10" cy="4" fill="#060f18" opacity=".72" />
            <path d="M-16 -4 L0 -13 16 -4 0 5Z" fill={object.type === 'transition' ? '#b49d70' : '#76b5ad'} />
            <path d="M-16 -4 V-30 L0 -38 V-13Z" fill="#375768" stroke="#9acbc3" strokeWidth=".8" />
            <path d="M0 -13 V-38 L16 -30 V-4Z" fill="#1e3645" stroke="#8aafa7" strokeWidth=".8" />
            <path d="M-9 -23 L0 -28 9 -23" fill="none" stroke="#88e6d1" strokeWidth="2" />
            <text y="-43" textAnchor="middle" className="ground-object-label">{index + 1}</text>
          </g>;
        })}
        {moveMode && <polygon data-testid="ground-keyboard-destination" points={tileShape(keyboardCell.x,keyboardCell.y)}
          fill="#e8d7a4" fillOpacity=".16" stroke="#e8ca82" strokeWidth="3" strokeDasharray="7 4"
          pointerEvents="none" />}
        {units.map((unit, index) => {
          const active = selected.includes(unit.id);
          return <g key={unit.id} data-testid={'ground-unit-' + unit.id}
            data-officer-id={unit.id} data-proj-x={unit.x} data-proj-y={unit.y}
            transform={'translate(' + unit.x + ' ' + unit.y + ')'}
            className={active ? 'ground-unit is-selected' : 'ground-unit'}>
            <circle r="27" cy="-7" fill="transparent" />
            <ellipse rx="18" ry="8" cy="10" fill="#081821" opacity=".85" />
            <ellipse rx="22" ry="10" cy="9" fill="none" stroke={active ? '#e8ca82' : '#69949b'}
              strokeWidth={active ? 3 : 1.5} />
            <path d="M-12 3 L-10 -12 Q0 -20 10 -12 L12 3 Q0 10 -12 3Z"
              fill={['#9c6c4e','#607a87','#517c76'][index % 3]} stroke="#bbd0ca" strokeWidth="1.3" />
            <path d="M-7 -10 L0 -5 7 -10" fill="none" stroke="#ead7ab" strokeWidth="2" />
            <circle cx="0" cy="-18" r="8" fill="#d4ae8c" stroke="#e4c4a0" strokeWidth="1.2" />
            <path d="M-8 -18 Q-7 -30 2 -27 Q9 -25 8 -18 Q1 -23 -8 -18Z" fill="#28373b" />
            <text y="-37" textAnchor="middle" className="ground-unit-name">{unit.name.split(' ')[0]}</text>
          </g>;
        })}
      </svg>
      {marqueeStyle && <div data-testid="ground-selection-marquee" className="ground-selection-marquee" style={marqueeStyle} />}
    </div>
    <div className="ground-squad-toolbar" aria-label="Selección de equipo">
      {squad.map(officer =>
        <button key={officer.id} type="button" data-testid={'ground-select-' + officer.id}
          aria-pressed={selected.includes(officer.id)} disabled={disabled}
          onClick={() => setSelected(previous => selectOfficer(
            squad.map(item => ({ id: item.id, x: 0, y: 0, visible: true })),
            previous, officer.id, false))}>
          {officer.name}
        </button>)}
      <button type="button" data-testid="ground-select-all" disabled={disabled}
        onClick={() => setSelected(squad.map(officer => officer.id))}>Todo el equipo</button>
      <button type="button" data-testid="ground-move-mode" aria-pressed={moveMode} disabled={disabled}
        onClick={() => { setMoveMode(value => !value); setKeyboardCell({x:position.x,y:position.y}); }}>
        {moveMode ? 'Cancelar movimiento' : 'Mover equipo · tocar destino'}
      </button>
    </div>
    <p className="ground-squad-status" data-testid="ground-selection-status" role="status">
      {selected.length === 0 ? 'Ningún oficial seleccionado' :
        selected.length === squad.length ? 'Todo el equipo seleccionado' :
        selected.length + ' de ' + squad.length + ' oficiales seleccionados'}
    </p>
    <p className="ground-squad-status" data-testid="ground-move-status" role="status">{moveNotice}</p>
    <p className="ground-squad-help">Clic, Shift+clic y arrastre seleccionan oficiales.
      Con todo el equipo seleccionado, clic derecho en el suelo ordena marchar.
      En móvil, activa «Mover equipo» y toca destino. Con teclado, activa mover,
      enfoca el mapa, usa flechas y Enter. Los oficiales aún comparten una sola posición;
      vuelve a explorar para interactuar con las estaciones.</p>
  </div>;
}
