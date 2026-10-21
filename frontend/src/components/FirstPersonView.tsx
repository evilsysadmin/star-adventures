import { useCallback, useEffect, useRef, useState } from 'react';
import world from '../../../content/scenes/meridian.json';
import { startExploration, applyExploration, faceTile } from '../../../src/spatial.mjs';
import { BridgeScene } from './BridgeScene';

type ViewState = {
  version: number; area: string; x: number; y: number; heading: string;
  pending: null | { id: string; to: string };
};
type SceneObject = { id: string; x: number; y: number; label: string; type: string; action?: string; to?: string };
type Scene = { title: string; width: number; height: number; walls: Array<{x:number;y:number}>; objects: SceneObject[] };
type ExplorationEvent = { type: string; label?: string; area?: string; action?: string; stationId?: string };
type Command = 'forward' | 'backward' | 'turn-left' | 'turn-right' | 'use' | 'confirm' | 'decline';
const HEADINGS = ['N', 'E', 'S', 'W'];
const ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
const HORIZON = 240;
const WIDTH = 960;
const HEIGHT = 480;

function drawScene(canvas: HTMLCanvasElement, state: ViewState, alert: boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const scene = (world.scenes as Record<string, Scene>)[state.area];
  const walls = new Set(scene.walls.map(cell => cell.x + ',' + cell.y));
  const targets = new Map(scene.objects.map(target => [target.x + ',' + target.y, target]));
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const ceiling = ctx.createLinearGradient(0, 0, 0, HORIZON);
  ceiling.addColorStop(0, '#06101c'); ceiling.addColorStop(1, '#294353');
  ctx.fillStyle = ceiling; ctx.fillRect(0, 0, WIDTH, HORIZON);
  const floor = ctx.createLinearGradient(0, HORIZON, 0, HEIGHT);
  floor.addColorStop(0, '#1d313c'); floor.addColorStop(1, '#09141e');
  ctx.fillStyle = floor; ctx.fillRect(0, HORIZON, WIDTH, HEIGHT);
  // The wireframe perspective grid is decorative; collision is strictly owned by src/spatial.mjs.
  ctx.strokeStyle = '#9dbfc619'; ctx.lineWidth = 2;
  for (let n = -8; n <= 8; n++) {
    ctx.beginPath(); ctx.moveTo(WIDTH/2 + n*32, HORIZON); ctx.lineTo(WIDTH/2 + n*148, HEIGHT); ctx.stroke();
  }
  for (let n = 1; n < 8; n++) {
    const y = HORIZON + 230 * (1 - 1/(n*.5+1));
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH,y); ctx.stroke();
  }
  const angle = ANGLES[HEADINGS.indexOf(state.heading)];
  const wallColumn = 3;
  for (let col = 0; col < WIDTH; col += wallColumn) {
    const offset = (col / WIDTH - .5) * (Math.PI / 2.7);
    const ray = angle + offset;
    let distance = .03;
    let hitObject: SceneObject | undefined;
    let hitWall = false;
    let hitX = state.x;
    let hitY = state.y;
    while(distance < 14) {
      hitX = Math.floor(state.x + .5 + Math.cos(ray)*distance);
      hitY = Math.floor(state.y + .5 + Math.sin(ray)*distance);
      const key = hitX + ',' + hitY;
      hitObject = targets.get(key);
      hitWall = hitX < 0 || hitY < 0 || hitX >= scene.width || hitY >= scene.height || walls.has(key);
      if(hitObject || hitWall) break;
      distance += .035;
    }
    const corrected = Math.max(.19, distance * Math.cos(offset));
    const height = Math.min(HEIGHT * 1.65, HEIGHT*.94 / corrected);
    const top = HORIZON - height/2;
    const fog = Math.max(.18, 1 - corrected/12);
    const edge = (Math.floor(distance*10)%4===0) ? 1.04 : 1;
    const base = hitObject ? (hitObject.type === 'transition' ? [66,181,173] : [194,147,96]) :
      state.area === 'bridge' ? [73,112,136] : [87,118,118];
    ctx.fillStyle = `rgb(${base.map(channel=>Math.round(channel*fog*edge)).join(',')})`;
    ctx.fillRect(col, top, wallColumn+1, height);
    ctx.fillStyle = `rgba(8,19,30,${Math.min(.88, .22 + corrected*.045)})`;
    ctx.fillRect(col, top+height*.83, wallColumn+1, height*.17);
    if(hitObject && Math.floor(hitX+hitY)%2===0) {
      ctx.fillStyle = hitObject.type === 'transition' ? '#7be3d2' : '#f0cc8c';
      ctx.globalAlpha = Math.max(.12, Math.min(.65, fog));
      ctx.fillRect(col, top+height*.32, wallColumn+1, Math.max(2,height*.04));
      ctx.globalAlpha = 1;
    }
  }
  const edge = ctx.createLinearGradient(0, 0, WIDTH, 0);
  edge.addColorStop(0, '#020610d9');edge.addColorStop(.25, '#02061000');
  edge.addColorStop(.75, '#02061000');edge.addColorStop(1, '#020610d9');
  ctx.fillStyle = edge;ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.strokeStyle = alert ? '#efa481' : '#9de0d6';ctx.lineWidth = 2;
  ctx.beginPath();ctx.moveTo(470,HORIZON);ctx.lineTo(478,HORIZON);
  ctx.moveTo(482,HORIZON);ctx.lineTo(490,HORIZON);
  ctx.moveTo(480,HORIZON-10);ctx.lineTo(480,HORIZON-3);
  ctx.moveTo(480,HORIZON+3);ctx.lineTo(480,HORIZON+10);ctx.stroke();
  ctx.fillStyle = '#08131cc9';ctx.fillRect(0,HEIGHT-40,WIDTH,40);
  ctx.fillStyle = '#a8c5c8';ctx.font = 'bold 14px system-ui';
  ctx.fillText(state.area === 'bridge' ? 'USS MERIDIAN  /  PUENTE 01' : 'EQUIPO DE DESEMBARCO  /  SUPERFICIE',19,HEIGHT-15);
  ctx.textAlign = 'right';ctx.fillText(`POS ${state.x}:${state.y}  ·  ${state.heading}`,WIDTH-19,HEIGHT-15);ctx.textAlign = 'left';
}

export function FirstPersonView({ alert, terminal }: { alert: boolean; terminal: boolean }) {
  const [exploration, setExploration] = useState<ViewState>(() => startExploration(world));
  const [event, setEvent] = useState<ExplorationEvent | null>(null);
  const [showMap, setShowMap] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const area = (world.scenes as Record<string, Scene>)[exploration.area];
  const front = faceTile(exploration);
  const facing = area.objects.find(object => object.x === front.x && object.y === front.y);
  const dispatch = useCallback((type: Command) => {
    const result = applyExploration(world, exploration, { type });
    if (!result) return; // Invalid commands throw; narrow JS module return for strict TS.
    setExploration(result.state);
    setEvent(result.event);
  }, [exploration]);
  useEffect(() => {
    if (canvas.current) drawScene(canvas.current, exploration, alert);
  }, [exploration, alert, showMap]);
  useEffect(() => {
    const onKey = (key: KeyboardEvent) => {
      if (showMap || key.repeat || key.defaultPrevented || key.altKey || key.ctrlKey || key.metaKey) return;
      if (key.target instanceof HTMLElement &&
          (key.target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(key.target.tagName))) return;
      const lookup: Record<string, Command> = {
        ArrowUp: 'forward', ArrowDown: 'backward', ArrowLeft: 'turn-left', ArrowRight: 'turn-right',
        w: 'forward', s: 'backward', a: 'turn-left', d: 'turn-right', e: 'use',
      };
      let command = lookup[key.key.length === 1 ? key.key.toLowerCase() : key.key];
      if (exploration.pending) {
        if (key.key === 'Escape') command = 'decline';
        else if (key.key === 'Enter') command = 'confirm';
        else return;
      }
      if (!command) return;
      key.preventDefault();
      dispatch(command);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, exploration.pending, showMap]);
  return (
    <section className="firstperson" aria-label="Exploración del puente y del equipo de desembarco">
      <div className="firstperson-top">
        <span className="firstperson-name" data-testid="explore-area">{area.title}</span>
        <button type="button" className="firstperson-map-toggle" onClick={() => setShowMap(m => !m)}>
          {showMap ? 'Volver al puente' : 'Mapa táctico'}
        </button>
      </div>
      {showMap ? <BridgeScene alert={alert} terminal={terminal} /> : (
        <>
          <canvas ref={canvas} className="firstperson-canvas" width={WIDTH} height={HEIGHT} role="img"
            aria-label={`Perspectiva en primera persona: ${area.title}, posición ${exploration.x} ${exploration.y}, rumbo ${exploration.heading}`} />
          <div className="firstperson-hud">
            <span data-testid="explore-heading">RUMBO {exploration.heading} · {exploration.x}:{exploration.y}</span>
            <span data-testid="explore-target">{facing ? `OBJETIVO: ${facing.label}` : 'Observando la estancia'}</span>
          </div>
          <div className="firstperson-controls" aria-label="Control de exploración">
            <button type="button" disabled={!!exploration.pending} data-testid="explore-left" onClick={() => dispatch('turn-left')}>↶ Girar</button>
            <button type="button" disabled={!!exploration.pending} data-testid="explore-forward" onClick={() => dispatch('forward')}>↑ Avanzar</button>
            <button type="button" disabled={!!exploration.pending} data-testid="explore-backward" onClick={() => dispatch('backward')}>↓ Retroceder</button>
            <button type="button" disabled={!!exploration.pending} data-testid="explore-right" onClick={() => dispatch('turn-right')}>Girar ↷</button>
            <button type="button" disabled={!!exploration.pending} data-testid="explore-use" className="firstperson-interact" onClick={() => dispatch('use')}>E · Usar</button>
          </div>
          <p className="firstperson-feedback" data-testid="explore-feedback" aria-live="polite">
            {event?.type === 'station' ? `${event.label}: estación detectada. Las órdenes operativas siguen disponibles en el panel de mando.` :
              event?.type === 'blocked' ? 'Paso bloqueado.' :
              event?.type === 'nothing-to-use' ? 'No hay nada a tu alcance.' :
              event?.type === 'transition-declined' ? 'Permaneces en la misma casilla. Puedes volver a usar el acceso.' :
              event?.type === 'area-entered' ? 'Cambio de área confirmado. Escenario exploratorio de prueba.' :
              'Flechas o WASD · E para interactuar · mueve la mirada antes de usar una estación.'}
          </p>
          {exploration.pending && (
            <div className="firstperson-dialog-backdrop">
              <div role="dialog" aria-modal="true" aria-labelledby="transport-title" className="firstperson-dialog">
                <h3 id="transport-title">Confirmar cambio de área</h3>
                <p>¿Quieres entrar en { (world.scenes as Record<string,Scene>)[exploration.pending.to].title }?</p>
                <div className="firstperson-dialog-actions">
                  <button type="button" autoFocus data-testid="transport-decline" onClick={() => dispatch('decline')}>No, permanecer</button>
                  <button type="button" data-testid="transport-confirm" onClick={() => dispatch('confirm')}>Sí, continuar</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
