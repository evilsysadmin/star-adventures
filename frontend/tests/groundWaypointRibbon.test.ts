import {expect,test} from '@playwright/test';
import {waypointRibbonShift} from '../src/groundWaypointRibbon';

test('a near-edge waypoint moves its panel inside the camera while the anchor stays fixed',()=>{
 const frame={left:280,width:260};
 const shift=waypointRibbonShift(520,0,70,frame);
 expect(shift).not.toBeNull();
 expect(shift!).toBeLessThan(0);
 const center=520+shift!;
 const half=70*.78/2;
 expect(center-half).toBeGreaterThanOrEqual(frame.left+8);
 expect(center+half).toBeLessThanOrEqual(frame.left+frame.width-8);
 // A different station with a pre-existing art-directed offset is clamped
 // using that same offset; the world station never changes coordinates.
 const offset=waypointRibbonShift(520,76,68,frame);
 expect(offset).toBeLessThan(0);
 expect(520+76+offset!+68*.78/2).toBeLessThanOrEqual(532);
});

test('onscreen stations remain anchored and offscreen/invalid pins stay offscreen',()=>{
 const frame={left:300,width:250};
 expect(waypointRibbonShift(420,0,65,frame)).toBe(0);
 expect(waypointRibbonShift(290,0,65,frame)).toBeNull();
 expect(waypointRibbonShift(551,0,65,frame)).toBeNull();
 expect(waypointRibbonShift(420,0,600,frame)).toBeNull();
 expect(waypointRibbonShift(420,0,65,{left:0,width:0})).toBeNull();
 expect(waypointRibbonShift(NaN,0,65,frame)).toBeNull();
 expect(waypointRibbonShift(420,0,65,frame,0)).toBeNull();
});
