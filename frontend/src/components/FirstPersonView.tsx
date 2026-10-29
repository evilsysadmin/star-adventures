import { requestCaptainTransport } from '../../../src/captainOrders.mjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import world from '../../../content/scenes/meridian.json';
import { startExploration, applyExploration, faceTile } from '../../../src/spatial.mjs';
import { BridgeScene } from './BridgeScene';
import { BridgeInteriorView } from './BridgeInteriorView';
import { missionWaypoint, type WaypointCommand } from '../missionWaypoint';

export type ViewState = {
  version: number; area: string; x: number; y: number; heading: string;
  pending: null | { id: string; to: string };
};
type SceneObject = { id: string; x: number; y: number; label: string; type: string; action?: string; to?: string };
type Scene = { title: string; width: number; height: number; walls: Array<{x:number;y:number}>; objects: SceneObject[] };
export type ExplorationEvent = { type: string; label?: string; area?: string; action?: string; stationId?: string };
type Command = 'forward' | 'backward' | 'turn-left' | 'turn-right' | 'use' | 'confirm' | 'decline';
const HEADINGS = ['N', 'E', 'S', 'W'];
const ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
const HORIZON = 240;
const WIDTH = 960;
const HEIGHT = 480;

// Outdoor scenery is fixed to compass/world directions, not to the screen.
// It never participates in the walkability, targeting or interaction model.
function drawSurfaceSkyline(ctx: CanvasRenderingContext2D, heading: string) {
  const angle = ANGLES[HEADINGS.indexOf(heading)];
  // A fixed celestial bearing makes the sky legible as a place: the pale
  // satellite appears above the northern ridge and disappears when facing E.
  const northBearing = -Math.PI / 2;
  const delta = Math.atan2(Math.sin(northBearing - angle), Math.cos(northBearing - angle));
  const halfFov = Math.PI / 5.4;
  if (Math.abs(delta) < halfFov + .08) {
    const moonX = WIDTH / 2 + delta / halfFov * WIDTH / 2;
    const glow = ctx.createRadialGradient(moonX, 100, 8, moonX, 100, 78);
    glow.addColorStop(0, '#d4d2c1a8');
    glow.addColorStop(.45, '#a3b9b15c');
    glow.addColorStop(1, '#a3b9b100');
    ctx.fillStyle = glow;
    ctx.fillRect(moonX - 78, 22, 156, 156);
    ctx.fillStyle = '#d4d1b7';
    ctx.beginPath(); ctx.arc(moonX, 100, 23, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#aeb5aa55';
    ctx.beginPath(); ctx.arc(moonX - 7, 95, 7, 0, Math.PI * 2); ctx.fill();
  }
  for (const layer of [
    { base: 88, color: '#536574', phase: .6 },
    { base: 36, color: '#59625e', phase: 2.1 },
  ]) {
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(0, HORIZON);
    for (let x = 0; x <= WIDTH; x += 6) {
      const bearing = angle + (x / WIDTH - .5) * (Math.PI / 2.7);
      const ridge = 24 * Math.sin(bearing * 3 + layer.phase)
        + 14 * Math.sin(bearing * 9 - layer.phase)
        + 7 * Math.sin(bearing * 17 + layer.phase);
      ctx.lineTo(x, HORIZON - layer.base - ridge);
    }
    ctx.lineTo(WIDTH, HORIZON);
    ctx.closePath();
    ctx.fill();
  }
}

function drawSurfaceGround(ctx: CanvasRenderingContext2D, state: ViewState, scene: Scene) {
  const angle = ANGLES[HEADINGS.indexOf(state.heading)];
  const forwardX = Math.cos(angle), forwardY = Math.sin(angle);
  const focal = WIDTH / (2 * Math.tan(Math.PI / 5.4));
  // Sparse deterministic stones are anchored to map coordinates. Turning or
  // walking changes their projection instead of sliding a screen-space decal.
  for (let y = 1; y < scene.height - 1; y++) {
    for (let x = 1; x < scene.width - 1; x++) {
      const seed = (x * 73 + y * 151 + x * y * 19) >>> 0;
      if (seed % 4 === 0) continue;
      const dx = x + .17 + (seed % 7) * .09 - (state.x + .5);
      const dy = y + .18 + (seed % 5) * .11 - (state.y + .5);
      const depth = dx * forwardX + dy * forwardY;
      if (depth < .45 || depth > 7) continue;
      const lateral = -dx * forwardY + dy * forwardX;
      const screenX = WIDTH / 2 + lateral / depth * focal;
      const screenY = HORIZON + 165 / (depth + .3);
      if (screenX < -12 || screenX > WIDTH + 12 || screenY > HEIGHT - 42) continue;
      const radius = Math.max(1, 7 / (depth + .5));
      ctx.fillStyle = seed % 3 ? '#9e947765' : '#273f415c';
      ctx.beginPath();
      ctx.ellipse(screenX, screenY, radius * 1.8, radius * .6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawScene(canvas: HTMLCanvasElement, state: ViewState, alert: boolean, activeStation: string | null) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const scene = (world.scenes as Record<string, Scene>)[state.area];
  const walls = new Set(scene.walls.map(cell => cell.x + ',' + cell.y));
  const targets = new Map(scene.objects.map(target => [target.x + ',' + target.y, target]));
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const ceiling = ctx.createLinearGradient(0, 0, 0, HORIZON);
  if (state.area === 'surface') {
    ceiling.addColorStop(0, '#111c2d'); ceiling.addColorStop(.68, '#394b59');
    ceiling.addColorStop(1, '#806d68');
  } else {
    ceiling.addColorStop(0, '#06101c'); ceiling.addColorStop(1, '#294353');
  }
  ctx.fillStyle = ceiling; ctx.fillRect(0, 0, WIDTH, HORIZON);
  if (state.area === 'surface') drawSurfaceSkyline(ctx, state.heading);
  const floor = ctx.createLinearGradient(0, HORIZON, 0, HEIGHT);
  if (state.area === 'surface') {
    floor.addColorStop(0, '#635c51'); floor.addColorStop(1, '#1c292b');
  } else {
    floor.addColorStop(0, '#1d313c'); floor.addColorStop(1, '#09141e');
  }
  ctx.fillStyle = floor; ctx.fillRect(0, HORIZON, WIDTH, HEIGHT);
  if (state.area === 'bridge') {
    // A deck, not an infinite wireframe: perspective walkway and ceiling
    // light wells are decorative only. Navigation stays in spatial.mjs.
    const deck = ctx.createLinearGradient(0, HORIZON, 0, HEIGHT);
    deck.addColorStop(0, '#223e4c'); deck.addColorStop(1, '#0d202b');
    ctx.fillStyle = deck;
    ctx.beginPath();
    ctx.moveTo(449, HORIZON); ctx.lineTo(511, HORIZON);
    ctx.lineTo(826, HEIGHT); ctx.lineTo(134, HEIGHT);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#bda77b70'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(449, HORIZON); ctx.lineTo(134, HEIGHT);
    ctx.moveTo(511, HORIZON); ctx.lineTo(826, HEIGHT); ctx.stroke();
    ctx.fillStyle = '#162d3b';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(960, 0);
    ctx.lineTo(730, 67); ctx.lineTo(230, 67); ctx.closePath(); ctx.fill();
    for (let depth = 1; depth <= 4; depth++) {
      const perspective = 1 / (1 + depth * .72);
      const y = HORIZON - 215 * perspective;
      const halfWidth = 90 + 400 * perspective;
      ctx.strokeStyle = depth % 2 ? '#5c899480' : '#bda77b55';
      ctx.lineWidth = Math.max(2, 9 * perspective);
      ctx.beginPath(); ctx.moveTo(WIDTH / 2 - halfWidth, y);
      ctx.lineTo(WIDTH / 2 + halfWidth, y); ctx.stroke();
      ctx.fillStyle = '#a8dcd7a8';
      ctx.fillRect(WIDTH / 2 - 24 * perspective, y - 2, 48 * perspective, 3);
    }
  } else {
    // The relief outpost has a grounded, dusty approach instead of the
    // bridge's polished deck. These marks are scenery, never collision.
    const path = ctx.createLinearGradient(0, HORIZON, 0, HEIGHT);
    path.addColorStop(0, '#8a7b67'); path.addColorStop(1, '#3e4945');
    ctx.fillStyle = path;
    ctx.beginPath(); ctx.moveTo(465, HORIZON); ctx.lineTo(495, HORIZON);
    ctx.lineTo(760, HEIGHT); ctx.lineTo(200, HEIGHT); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c2aa805c'; ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(480 + side * 15, HORIZON);
      ctx.lineTo(480 + side * 280, HEIGHT); ctx.stroke();
    }
    for (let depth = 1; depth <= 6; depth++) {
      const y = HORIZON + 240 * (1 - 1 / (1 + depth * .65));
      const half = (y - HORIZON) * 1.16;
      ctx.strokeStyle = depth % 2 ? '#c3ad8055' : '#233d415e';
      ctx.beginPath(); ctx.moveTo(480 - half, y);
      ctx.lineTo(480 + half, y); ctx.stroke();
    }
  }
  if (state.area === 'surface') {
    drawSurfaceGround(ctx, state, scene);
  } else {
    // Bridge deck reference lines remain decorative; navigation is spatial.mjs.
    ctx.strokeStyle = '#9dbfc619'; ctx.lineWidth = 2;
    for (let n = -8; n <= 8; n++) {
      ctx.beginPath(); ctx.moveTo(WIDTH/2 + n*32, HORIZON); ctx.lineTo(WIDTH/2 + n*148, HEIGHT); ctx.stroke();
    }
    for (let n = 1; n < 8; n++) {
      const y = HORIZON + 230 * (1 - 1/(n*.5+1));
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH,y); ctx.stroke();
    }
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
    const fullHeight = Math.min(HEIGHT * 1.65, HEIGHT*.94 / corrected);
    // The planetary perimeter is a low rocky escarpment, not an indoor wall
    // reaching to the ceiling. Keep its base/depth and all collision unchanged.
    const height = state.area === 'surface' && !hitObject ? fullHeight * .64 : fullHeight;
    const top = HORIZON + fullHeight / 2 - height;
    const fog = Math.max(.18, 1 - corrected/12);
    const edge = (Math.floor(distance*10)%4===0) ? 1.04 : 1;
    const base = state.area === 'surface'
      ? hitObject ? hitObject.type === 'transition' ? [47, 111, 117] : [80, 98, 97]
        : [118, 108, 94]
      : hitObject ? hitObject.type === 'transition' ? [45, 117, 117] : [43, 89, 101]
        : [73, 112, 136];
    ctx.fillStyle = `rgb(${base.map(channel=>Math.round(channel*fog*edge)).join(',')})`;
    ctx.fillRect(col, top, wallColumn+1, height);
    ctx.fillStyle = `rgba(8,19,30,${Math.min(.88, .22 + corrected*.045)})`;
    ctx.fillRect(col, top+height*.83, wallColumn+1, height*.17);
    if (state.area === 'bridge') {
      // Every strip is attached to the ray-hit cell. Turning and walking
      // therefore reveal the same architectural panels from new angles.
      const contactX = state.x + .5 + Math.cos(ray) * distance;
      const contactY = state.y + .5 + Math.sin(ray) * distance;
      const along = Math.abs(Math.sin(ray)) >= Math.abs(Math.cos(ray))
        ? contactX - Math.floor(contactX) : contactY - Math.floor(contactY);
      const rib = along < .07 || along > .93;
      const trim = Math.max(2, height * .018);
      if (rib) {
        ctx.fillStyle = '#0a1b28d9';
        ctx.fillRect(col, top, wallColumn + 1, height * .83);
      } else {
        ctx.fillStyle = '#b5a17988';
        ctx.fillRect(col, top + height * .18, wallColumn + 1, trim);
        ctx.fillStyle = '#6d9fa477';
        ctx.fillRect(col, top + height * .78, wallColumn + 1, trim);
        if (hitObject?.type === 'station') {
          // Recessed display and readable illuminated controls replace the
          // solid, full-height teal slab seen on the initial bridge.
          if (along > .13 && along < .87) {
            ctx.fillStyle = '#061923ed';
            ctx.fillRect(col, top + height * .27, wallColumn + 1, height * .37);
            ctx.fillStyle = '#164354';
            ctx.fillRect(col, top + height * .30, wallColumn + 1, height * .25);
            ctx.fillStyle = hitObject.action === 'tactical' ? '#e5a17b' : '#78d9c8';
            ctx.fillRect(col, top + height * .43, wallColumn + 1, Math.max(2, height * .017));
            if (Math.floor(along * 30) % 5 === 0) {
              ctx.fillStyle = '#b7e7d5b0';
              ctx.fillRect(col, top + height * .33, wallColumn + 1, height * .065);
            }
          }
          ctx.fillStyle = '#d1b68c';
          ctx.fillRect(col, top + height * .67, wallColumn + 1, Math.max(2, height * .02));
          if (Math.floor(along * 22) % 3 === 0) {
            ctx.fillStyle = '#70b6b1';
            ctx.fillRect(col, top + height * .70, wallColumn + 1, height * .035);
          }
        } else if (hitObject?.type === 'transition') {
          if (along > .14 && along < .86) {
            ctx.fillStyle = '#0b303c';
            ctx.fillRect(col, top + height * .25, wallColumn + 1, height * .48);
            ctx.fillStyle = '#8ee5d1';
            ctx.fillRect(col, top + height * .30, wallColumn + 1, Math.max(2, height * .018));
            ctx.fillRect(col, top + height * .67, wallColumn + 1, Math.max(2, height * .018));
          }
        } else if (Math.floor(along * 12) % 4 === 0) {
          ctx.fillStyle = '#9dbfc32b';
          ctx.fillRect(col, top + height * .30, wallColumn + 1, height * .37);
        }
      }
    }
    if (state.area === 'surface') {
      // Outpost masonry and rock strata are attached to the *ray-hit tile*,
      // so the same structures remain in place when the player turns.
      const contactX = state.x + .5 + Math.cos(ray) * distance;
      const contactY = state.y + .5 + Math.sin(ray) * distance;
      const along = Math.abs(Math.sin(ray)) >= Math.abs(Math.cos(ray))
        ? contactX - Math.floor(contactX) : contactY - Math.floor(contactY);
      const seam = along < .055 || along > .945;
      if (seam) {
        ctx.fillStyle = '#182e32b8';
        ctx.fillRect(col, top, wallColumn + 1, height * .83);
      } else if (hitObject) {
        // Distinct physical landmarks: science, medical relief, perimeter
        // warning and transporter, rather than identical anonymous slabs.
        const accent = hitObject.type === 'transition' ? '#9cebd3'
          : hitObject.action === 'assist-evacuees' ? '#efc88c'
          : hitObject.action === 'secure-perimeter' ? '#eaa18a'
          : hitObject.action === 'extract-sensor-core' ? '#b4b8f0' : '#8dded6';
        ctx.fillStyle = '#152e36ed';
        ctx.fillRect(col, top + height * .19, wallColumn + 1, height * .59);
        if (along > .13 && along < .87) {
          ctx.fillStyle = '#09212ae8';
          ctx.fillRect(col, top + height * .28, wallColumn + 1, height * .37);
          ctx.fillStyle = accent;
          ctx.fillRect(col, top + height * .33, wallColumn + 1, Math.max(2, height * .024));
          ctx.fillRect(col, top + height * .60, wallColumn + 1, Math.max(2, height * .018));
          if (Math.floor(along * 24) % 5 === 0) {
            ctx.fillStyle = '#b6d6d7a8';
            ctx.fillRect(col, top + height * .43, wallColumn + 1, height * .085);
          }
        }
        ctx.fillStyle = '#d1bb9870';
        ctx.fillRect(col, top + height * .74, wallColumn + 1, Math.max(2, height * .017));
      } else {
        // Horizontal sediment bands and sparse fissures break the flat walls
        // without fake interactive props or random texture flicker.
        const stratum = (hitX * 13 + hitY * 7) % 4;
        ctx.fillStyle = '#e2c8a326';
        ctx.fillRect(col, top + height * (.26 + stratum * .025), wallColumn + 1, Math.max(2, height * .016));
        ctx.fillStyle = '#23383b66';
        ctx.fillRect(col, top + height * .65, wallColumn + 1, Math.max(2, height * .028));
        if (Math.floor(along * 19 + hitX * 3 + hitY * 5) % 9 === 0) {
          ctx.fillStyle = '#263e4088';
          ctx.fillRect(col, top + height * .36, wallColumn + 1, height * .23);
        }
      }
    }
    if(hitObject && Math.floor(hitX+hitY)%2===0) {
      ctx.fillStyle = hitObject.type === 'transition' ? '#7be3d2' : '#f0cc8c';
      ctx.globalAlpha = Math.max(.12, Math.min(.65, fog));
      ctx.fillRect(col, top+height*.32, wallColumn+1, Math.max(2,height*.04));
      ctx.globalAlpha = 1;
    }
  }
  // At interaction range, a real outpost landmark must not collapse into
  // a full-screen anonymous wall. Show its recessed, readable faceplate,
  // tied strictly to the object on the cell the player is facing.
  const front = faceTile(state);
  const surfaceFocus = state.area === 'surface' && !activeStation
    ? scene.objects.find(item => item.x === front.x && item.y === front.y) : undefined;
  if (surfaceFocus) {
    const medical = surfaceFocus.action === 'assist-evacuees';
    const security = surfaceFocus.action === 'secure-perimeter';
    const transport = surfaceFocus.type === 'transition';
    const accent = medical ? '#e6c392' : security ? '#ec9e8b'
      : transport ? '#8ae4d1' : '#a6c4e5';
    const title = medical ? 'PUESTO DE SOCORRO' : security ? 'CONTROL DEL PERÍMETRO'
      : transport ? 'TRANSPORTE DE REGRESO'
        : surfaceFocus.action === 'inspect-probe' ? 'SONDA CIENTÍFICA' : 'ARCHIVO DE SENSORES';
    const instruction = medical ? 'E · ASISTIR A LOS CIVILES' : security ? 'E · ESTABLECER CONTACTO'
      : transport ? 'E · SOLICITAR TRANSPORTE' : 'E · INSPECCIONAR';
    // Bevelled inset is a close-up of the same ray-hit station, not a
    // teleport, popup choice or invented mission state.
    ctx.fillStyle = '#071720e8'; ctx.fillRect(142, 78, 676, 294);
    ctx.fillStyle = '#263d42'; ctx.fillRect(154, 90, 652, 270);
    ctx.fillStyle = '#0c222b'; ctx.fillRect(174, 110, 612, 230);
    ctx.strokeStyle = '#8d9d8b'; ctx.lineWidth = 3;
    ctx.strokeRect(154, 90, 652, 270);
    ctx.fillStyle = accent; ctx.fillRect(174, 110, 612, 6);
    ctx.fillStyle = '#152f39'; ctx.fillRect(192, 139, 576, 178);
    ctx.strokeStyle = '#668b8c'; ctx.lineWidth = 2;
    ctx.strokeRect(192, 139, 576, 178);
    ctx.fillStyle = accent; ctx.font = 'bold 29px system-ui';
    ctx.fillText(title, 216, 180, 510);
    ctx.fillStyle = '#d5e5dc'; ctx.font = 'bold 23px system-ui';
    ctx.fillText(instruction, 216, 289, 500);
    ctx.fillStyle = accent;
    if (medical) {
      ctx.fillRect(681, 199, 18, 65); ctx.fillRect(658, 222, 64, 18);
    } else if (transport) {
      ctx.strokeStyle = accent; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(687, 231, 33, 46, 0, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.strokeStyle = accent; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(688, 229, 32, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(688, 206); ctx.lineTo(688, 252);
      ctx.moveTo(665, 229); ctx.lineTo(711, 229); ctx.stroke();
    }
    ctx.fillStyle = '#bbd0c5'; ctx.font = 'bold 15px system-ui';
    ctx.fillText('PUESTO DE CAMPO  /  INTERFAZ LOCAL', 216, 209, 420);
  }
  // Adjacent live station gets a readable embedded console; no fabricated telemetry.
  const station = scene.objects.find(item => item.type === 'station' &&
    item.x === front.x && item.y === front.y && item.id === activeStation);
  if (station) {
    const isScience = station.action === 'science';
    const accent = isScience ? '#8ee9df' : station.action === 'tactical' ? '#ffb899' : '#cfdfb0';
    const display = ctx.createLinearGradient(140, 65, 760, 370);
    display.addColorStop(0, '#061923'); display.addColorStop(1, '#153947');
    ctx.fillStyle = '#06101df0'; ctx.fillRect(108, 52, 744, 331);
    ctx.fillStyle = display; ctx.fillRect(127, 69, 706, 295);
    ctx.strokeStyle = '#668f98'; ctx.lineWidth = 3; ctx.strokeRect(127, 69, 706, 295);
    ctx.fillStyle = accent; ctx.fillRect(148, 92, 4, 46);
    ctx.font = 'bold 24px system-ui'; ctx.fillText(station.label.toUpperCase(), 170, 113);
    ctx.font = 'bold 13px system-ui'; ctx.fillStyle = '#9cb9bf';
    ctx.fillText('INTERFAZ DE ESTACIÓN · ÓRDENES DISPONIBLES A LA DERECHA', 170, 137);
    ctx.strokeStyle = '#92bac444'; ctx.lineWidth = 1;
    for(let x = 154; x <= 810; x += 26) {
      ctx.beginPath(); ctx.moveTo(x, 172); ctx.lineTo(x, 334); ctx.stroke();
    }
    for(let y = 180; y < 336; y += 26) {
      ctx.beginPath(); ctx.moveTo(155, y); ctx.lineTo(806, y); ctx.stroke();
    }
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(482, 253, 108, 65, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = .55;
    ctx.beginPath(); ctx.ellipse(482, 253, 68, 43, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0c2e3c'; ctx.fillRect(158, 343, 645, 8);
    ctx.fillStyle = accent; ctx.fillRect(158, 343, 146, 8);
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

const WAYPOINT_ORDERS: Record<WaypointCommand, string> = {
  forward: '↑ AVANZA', 'turn-left': '↶ GIRA A LA IZQUIERDA',
  'turn-right': 'GIRA A LA DERECHA ↷', use: 'E · INTERACTÚA',
};

export function FirstPersonView({ alert, terminal, initialState, onSpatialEvent, squad = [], missionTargetId = null, perimeterResolved = false, paused = false, captainMode = false, onCaptainStation }: { alert: boolean; terminal: boolean; initialState?: ViewState; onSpatialEvent?: (state: ViewState, event: ExplorationEvent) => void; squad?: { id: string; name: string }[]; missionTargetId?: string | null; perimeterResolved?: boolean; paused?: boolean; captainMode?: boolean; onCaptainStation?: (id: string) => void }) {
  const [exploration, setExploration] = useState<ViewState>(() => initialState ?? startExploration(world));
  const [event, setEvent] = useState<ExplorationEvent | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [bridgeFallback, setBridgeFallback] = useState(false);
  const useCompatibleBridge = useCallback(() => setBridgeFallback(true), []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(exploration);
  const area = (world.scenes as Record<string, Scene>)[exploration.area];
  const front = faceTile(exploration);
  const facing = area.objects.find(object => object.x === front.x && object.y === front.y);
  const seated = captainMode && exploration.area === 'bridge';
  const bridgePose = seated ? { ...exploration, ...world.scenes.bridge.spawn } as ViewState : exploration;
  const waypoint = seated ? null : missionWaypoint(world, exploration, missionTargetId);
  const dispatch = useCallback((type: Command) => {
    // Sync ref prevents dropped turns when two keyboard events arrive before React rerenders.
    const result = applyExploration(world, stateRef.current, { type });
    if (!result) return;
    stateRef.current = result.state;
    setExploration(result.state);
    setEvent(result.event);
    onSpatialEvent?.(result.state, result.event);
  }, [onSpatialEvent]);
  useEffect(() => {
    if (canvas.current && (exploration.area !== 'bridge' || bridgeFallback))
      drawScene(canvas.current, exploration, alert, event?.type === 'station' ? (event.stationId ?? null) : null);
  }, [exploration, alert, showMap, event, bridgeFallback]);
  useEffect(() => {
    const onKey = (key: KeyboardEvent) => {
      if (paused || (seated && !exploration.pending)) return;
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
  }, [dispatch, exploration.pending, showMap, paused, seated]);
  return (
    <section id="exploration" className={`firstperson firstperson-${exploration.area}`} aria-label="Exploración del puente y del equipo de desembarco">
      <div className="firstperson-top">
        <span className="firstperson-name" data-testid="explore-area">{area.title}</span>
        <button type="button" className="firstperson-map-toggle" onClick={() => setShowMap(m => !m)}>
          {showMap ? 'Volver al puente' : 'Mapa táctico'}
        </button>
      </div>
      {showMap ? <BridgeScene alert={alert} terminal={terminal} /> : (
        <>
          <div className="firstperson-render-stage">
          {exploration.area === 'bridge' && !bridgeFallback
            ? <BridgeInteriorView pose={{ ...bridgePose, seated }} alert={alert} onUnavailable={useCompatibleBridge} />
            : <canvas key={exploration.area} ref={canvas} className="firstperson-canvas" width={WIDTH} height={HEIGHT} role="img"
                aria-label={`Perspectiva en primera persona: ${area.title}, posición ${exploration.x} ${exploration.y}, rumbo ${exploration.heading}`} />}
          {exploration.area === 'bridge' && !bridgeFallback && <div className="bridge-lens" aria-hidden="true">
            <span className="bridge-lens-deck">MERIDIAN <b>PUENTE · 01</b></span>
            <span className="bridge-reticle">+</span>
            <span className="bridge-lens-mode">{seated ? 'PUESTO DEL CAPITÁN' : 'EXPLORACIÓN EN PRIMERA PERSONA'}</span>
          </div>}
          </div>
          <div className="firstperson-hud">
            <span data-testid="explore-heading">{seated ? 'CAPITÁN · MANDO DE LA NAVE' : `RUMBO ${exploration.heading} · ${exploration.x}:${exploration.y}`} </span>
            <span data-testid="explore-target">{seated ? 'Selecciona un oficial para transmitir tus órdenes' : facing ? `OBJETIVO: ${facing.label}` : 'Observando la estancia'}</span>
          </div>
          {waypoint && <div className="firstperson-waypoint" data-testid="mission-waypoint"
            data-action={waypoint.action} role="status" aria-live="polite">
            <span className="firstperson-waypoint-label">RUTA DE MISIÓN · {waypoint.label}</span>
            <strong data-testid="mission-waypoint-command">{WAYPOINT_ORDERS[waypoint.action]}</strong>
            <span className="firstperson-waypoint-steps">{waypoint.steps === 0 ? 'Objetivo al alcance' : `${waypoint.steps} ${waypoint.steps === 1 ? 'casilla' : 'casillas'} por recorrer`}</span>
          </div>}
          {seated ? <div className="captain-controls" aria-label="Puesto del capitán" data-testid="captain-controls">
            {world.scenes.bridge.objects.filter(item => item.type === 'station').map(item =>
              <button key={item.id} type="button" disabled={paused || !!exploration.pending}
                data-testid={`captain-${item.id}`} onClick={() => onCaptainStation?.(item.id)}>
                {item.action === 'command' ? 'Mando' : item.label}</button>)}
            <button type="button" disabled={paused || !!exploration.pending} data-testid="captain-transport"
              onClick={() => {
                const result = requestCaptainTransport(world, stateRef.current);
                stateRef.current = result.state; setExploration(result.state); setEvent(result.event);
                onSpatialEvent?.(result.state, result.event);
              }}>Desembarcar →</button>
          </div> : <div className="firstperson-controls" aria-label="Control de exploración">
            <button type="button" disabled={!!exploration.pending || paused} data-testid="explore-left" onClick={() => dispatch('turn-left')}>↶ Girar</button>
            <button type="button" disabled={!!exploration.pending || paused} data-testid="explore-forward" onClick={() => dispatch('forward')}>↑ Avanzar</button>
            <button type="button" disabled={!!exploration.pending || paused} data-testid="explore-backward" onClick={() => dispatch('backward')}>↓ Retroceder</button>
            <button type="button" disabled={!!exploration.pending || paused} data-testid="explore-right" onClick={() => dispatch('turn-right')}>Girar ↷</button>
            <button type="button" disabled={!!exploration.pending || paused} data-testid="explore-use" className="firstperson-interact" onClick={() => dispatch('use')}>E · Usar</button>
          </div>}
          {exploration.area === 'surface' && <div className="away-party" data-testid="away-party">
            <span className="away-party-label">EQUIPO DESPLEGADO</span>
            <div className="away-party-members">
              {squad.map(officer => <span key={officer.id} className="away-party-member">
                <span className="away-party-portrait" aria-hidden="true">{officer.name.split(' ').map(part => part[0]).join('')}</span>
                {officer.name}
              </span>)}
            </div>
          </div>}
          <p className="firstperson-feedback" data-testid="explore-feedback" aria-live="polite">
            {seated ? 'Tu tripulación espera órdenes. Ciencia y diplomacia pueden resolver el conflicto sin combatir.' : event?.type === 'station' ? event.action === 'inspect-probe' ? 'Sonda investigada. Consulta el informe del equipo.' :
              event.action === 'assist-evacuees' ? 'Puesto de socorro: consulta el resultado del equipo médico en el diario.' :
              event.action === 'extract-sensor-core' ? 'Archivo de sensores: consulta el resultado de la extracción en el canal reservado.' :
               event.action === 'secure-perimeter' ? perimeterResolved
                 ? 'El perímetro ya está resuelto. Continúa la misión en superficie.'
                 : 'Contacto detectado: el equipo entra en el encuentro táctico opcional.' :
                `${event.label}: consola seleccionada. Consulta las órdenes de esta estación.` :
              event?.type === 'blocked' ? 'Paso bloqueado.' :
              event?.type === 'nothing-to-use' ? 'No hay nada a tu alcance.' :
              event?.type === 'transition-declined' ? 'Permaneces en la misma casilla. Puedes volver a usar el acceso.' :
              event?.type === 'area-entered' ? 'Transporte completado. Equipo listo para continuar la misión.' :
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
