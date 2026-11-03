// Deterministic free-movement/contact prototype. No UI, storage or setting data.
// Contact is deliberately proximity-only, not a vision or stealth simulation.
const cell = (id, board) => {
  if (typeof id !== 'string' || !/^(0|[1-9]\d*):(0|[1-9]\d*)$/.test(id)) throw new TypeError('Invalid cell');
  const [x,y] = id.split(':').map(Number);
  if (x >= board.columns || y >= board.rows) throw new RangeError('Cell outside board');
  return [x,y];
};
const distance = (a,b,board) => {
  const [ax,ay] = cell(a,board), [bx,by] = cell(b,board);
  return Math.abs(ax-bx)+Math.abs(ay-by);
};
const idValid = id => typeof id === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(id);

export function validateContactScenario(scenario) {
  if (!scenario || typeof scenario !== 'object' || !scenario.board ||
      !Number.isSafeInteger(scenario.board.columns) || !Number.isSafeInteger(scenario.board.rows) ||
      scenario.board.columns < 1 || scenario.board.columns > 32 || scenario.board.rows < 1 || scenario.board.rows > 32 ||
      !Array.isArray(scenario.blocked) || !Array.isArray(scenario.officers) || !Array.isArray(scenario.hostiles) ||
      !scenario.officers.length || !scenario.hostiles.length || scenario.officers.length > 6 || scenario.hostiles.length > 32 ||
      !Number.isSafeInteger(scenario.contactRadius) || scenario.contactRadius < 1 || scenario.contactRadius > 32)
    throw new TypeError('Invalid contact scenario');
  const occupied = new Set(), ids = new Set();
  for (const location of scenario.blocked) {
    cell(location,scenario.board);
    if (occupied.has(location)) throw new TypeError('Duplicate blocked cell');
    occupied.add(location);
  }
  for (const unit of [...scenario.officers,...scenario.hostiles]) {
    if (!unit || !idValid(unit.id) || ids.has(unit.id) || !Number.isSafeInteger(unit.health) || unit.health < 1 ||
        !['N','E','S','W'].includes(unit.facing)) throw new TypeError('Invalid unit');
    cell(unit.cell,scenario.board);
    if (occupied.has(unit.cell)) throw new TypeError('Occupied starting cell');
    ids.add(unit.id); occupied.add(unit.cell);
  }
  return true;
}

function contacts(scenario, officers) {
  const pairs=[];
  for (const officer of officers) for (const hostile of scenario.hostiles)
    if (distance(officer.cell,hostile.cell,scenario.board) <= scenario.contactRadius)
      pairs.push({officer:officer.id,hostile:hostile.id});
  return pairs.sort((a,b)=>(a.officer < b.officer ? -1 : a.officer > b.officer ? 1 : a.hostile < b.hostile ? -1 : a.hostile > b.hostile ? 1 : 0));
}

/** Reconstruct state from a validated scenario and commands; no saved state is trusted. */
export function replayTacticalContact(scenario, commands) {
  validateContactScenario(scenario);
  if (!Array.isArray(commands) || commands.length > 1024) throw new TypeError('Invalid command history');
  const officers=scenario.officers.map(unit=>({...unit}));
  const hostiles=scenario.hostiles.map(unit=>({...unit}));
  let detected=contacts(scenario,officers);
  let phase=detected.length?'combat':'free';
  const events=detected.length?[{type:'contact',pairs:detected}]:[];
  for (const command of commands) {
    if (phase!=='free') throw new RangeError('Contact already started combat');
    if (!command || typeof command!=='object' || Object.keys(command).sort().join(',')!=='officer,path,type' ||
        command.type!=='move' || !idValid(command.officer) || !Array.isArray(command.path) ||
        command.path.length<1 || command.path.length>1024) throw new TypeError('Invalid movement command');
    const officer=officers.find(unit=>unit.id===command.officer);
    if (!officer) throw new RangeError('Unknown officer');
    // Validate the whole submitted route before moving, including its suffix.
    let previous=officer.cell;
    const occupied=new Set([...scenario.blocked,...hostiles.map(u=>u.cell),...officers.filter(u=>u!==officer).map(u=>u.cell)]);
    for (const destination of command.path) {
      cell(destination,scenario.board);
      if (occupied.has(destination) || distance(previous,destination,scenario.board)!==1) throw new RangeError('Invalid movement path');
      previous=destination;
    }
    for (const destination of command.path) {
      const [x,y]=cell(officer.cell,scenario.board), [nx,ny]=cell(destination,scenario.board);
      const from=officer.cell;
      officer.cell=destination;
      officer.facing=nx>x?'E':nx<x?'W':ny>y?'S':'N';
      events.push({type:'move',officer:officer.id,from,to:destination});
      detected=contacts(scenario,officers);
      if (detected.length) {
        phase='combat';
        events.push({type:'contact',pairs:detected});
        break;
      }
    }
  }
  return {version:1,phase,officers,hostiles,contacts:detected,events};
}
