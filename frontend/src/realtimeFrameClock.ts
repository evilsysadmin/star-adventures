// Pure timing policy for the continuous exploration RAF loop.
// At most 25 authoritative updates per second; no catch-up after a stall.
// Call reset on pause/visibility changes and initialize on the next frame.
export function createRealtimeFrameClock(){
  let last:number|null=null;
  return {
    reset(){last=null;},
    step(now:number):number|null{
      if(!Number.isFinite(now))return null;
      if(last===null||now<last){last=now;return null;}
      const elapsed=now-last;
      if(elapsed<40)return null;
      last=now;
      return Math.min(elapsed,80);
    },
  };
}
