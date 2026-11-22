// K-47 Outer Array: original, deterministic two-stage pilot mission.
// Pure rules only. The classic meridian rescue mission never imports these.
// A choice has a recorded consequence; there is no random success or fake
// "rescued civilians" count before a real evacuation stage exists.
const TARGETS=Object.freeze({
 'relay-power':Object.freeze({x:18,y:15}),
 'lab-evidence':Object.freeze({x:27,y:13}),
});
const actions=Object.freeze(['relay.life-support','relay.research','lab.collect']);
const key=(x,y)=>x+','+y;
const fail=message=>{throw new TypeError('Invalid wide mission: '+message);};
const record=(code,officerId)=>({code,officerId});
const own=(value)=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>own(value)&&
 Object.keys(value).sort().join('|')===keys.slice().sort().join('|');

export function startWideMission(){
 return {version:1,powerRoute:null,evidence:null,journal:[]};
}

export function validateWideMission(mission,squad=null){
 if(!exact(mission,['version','powerRoute','evidence','journal'])||
   mission.version!==1||!['life-support','research',null].includes(mission.powerRoute)||
   !['sealed','verified',null].includes(mission.evidence)||
   !Array.isArray(mission.journal)||mission.journal.length>2)
   fail('invalid mission snapshot');
 if(mission.powerRoute===null&&
   (mission.evidence!==null||mission.journal.length!==0))fail('evidence before relay');
 if(mission.powerRoute!==null&&mission.journal.length<1)fail('missing relay journal');
 if(mission.evidence!==null&&mission.journal.length!==2)fail('missing evidence journal');
 if(mission.evidence===null&&mission.journal.length>1)fail('invented evidence');
 if(mission.powerRoute==='life-support'&&mission.evidence==='verified'||
    mission.powerRoute==='research'&&mission.evidence==='sealed')
   fail('evidence contradicts power allocation');
 const validCodes=[
   mission.powerRoute===null?null:'relay.'+mission.powerRoute,
   mission.evidence===null?null:'lab.'+mission.evidence,
 ].filter(Boolean);
 for(let i=0;i<mission.journal.length;i++){
   const event=mission.journal[i];
   if(!exact(event,['code','officerId'])||event.code!==validCodes[i]||
      typeof event.officerId!=='string'||event.officerId.length<1||
      event.officerId.length>128||
      (squad!==null&&(!Array.isArray(squad)||!squad.includes(event.officerId))))
     fail('forged mission event');
 }
 return true;
}

export function wideMissionConsequences(mission){
 validateWideMission(mission);
 return {
   relayRestored:mission.powerRoute!==null,
   lifeSupportBacked:mission.powerRoute==='life-support',
   laboratoryPowered:mission.powerRoute==='research',
   samplesPreserved:mission.evidence!==null,
   evidenceVerified:mission.evidence==='verified',
   complete:mission.evidence!==null,
 };
}

// The authored objectives must match the real 32x20 trial and be genuinely
// walkable. The three remaining proposed sites are not live interactions.
export function validateWideMissionTargets(world,plan){
 const scene=world?.scenes?.surface;
 if(plan?.id!=='k47-outer-array'||!Array.isArray(plan.proposedObjectives)||
    scene?.width!==32||scene?.height!==20||!Array.isArray(scene.walls)||
    !Array.isArray(scene.objects))fail('wrong expedition / world');
 const blocked=new Set([...scene.walls,...scene.objects].map(p=>key(p.x,p.y)));
 for(const [id,at] of Object.entries(TARGETS)){
   const entries=plan.proposedObjectives.filter(o=>o.id===id);
   if(entries.length!==1||entries[0].at?.[0]!==at.x||
      entries[0].at?.[1]!==at.y||blocked.has(key(at.x,at.y)))
     fail('target is not an authored walkable objective: '+id);
 }
 return true;
}

export function wideMissionOfficerInRange(motion,officerId,at){
 const officer=motion?.motion?.officers?.find(o=>o.id===officerId);
 if(!officer||!Array.isArray(officer.route)||officer.route.length>0||
    !Number.isFinite(officer.x)||!Number.isFinite(officer.y))return false;
 const dx=Math.abs(officer.x-at.x),dy=Math.abs(officer.y-at.y);
 // The tested route engine ends exactly at a tile center. A settled officer
 // can use its own tile or an adjacent cardinal tile, never diagonal.
 return dx+dy<=1.001&&(dx<=.001||dy<=.001);
}

export function applyWideMissionAction(world,plan,motion,mission,officerId,action){
 validateWideMissionTargets(world,plan);
 validateWideMission(mission,motion?.motion?.officers?.map(o=>o.id)??[]);
 if(!actions.includes(action)||typeof officerId!=='string')fail('unknown order');
 const relay=action.startsWith('relay.');
 const target=TARGETS[relay?'relay-power':'lab-evidence'];
 if(!wideMissionOfficerInRange(motion,officerId,target))
   fail('selected officer must finish walking to the actual objective');
 if(relay&&mission.powerRoute!==null)fail('relay choice is final');
 if(!relay&&(mission.powerRoute===null||mission.evidence!==null))
   fail('lab requires restored power and cannot be repeated');
 const powerRoute=relay
   ?(action==='relay.life-support'?'life-support':'research')
   :mission.powerRoute;
 const evidence=relay?null:(powerRoute==='research'?'verified':'sealed');
 const code=relay?action:'lab.'+evidence;
 const next={
   version:1,powerRoute,evidence,
   journal:[...mission.journal.map(e=>({...e})),record(code,officerId)],
 };
 validateWideMission(next,motion.motion.officers.map(o=>o.id));
 return next;
}

export const WIDE_MISSION_TARGETS=TARGETS;
