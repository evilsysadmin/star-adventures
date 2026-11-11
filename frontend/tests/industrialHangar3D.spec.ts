import {expect,test} from '@playwright/test';
import * as THREE from 'three';
import {addIndustrialSpanHangars} from '../src/groundVisual/IndustrialSpanHangar3D';

test('a connected hangar remains strictly inside its blocked 5-cell footprint',()=>{
 const scene=new THREE.Scene();
 const dispose=addIndustrialSpanHangars(scene,[{start:3,end:7,row:7}]);
 const group=scene.getObjectByName('industrial-hangar-3-7-7') as THREE.Group;
 expect(group).toBeTruthy();
 const bounds=new THREE.Box3().setFromObject(group);
 // Beyond these limits art could cover a live tile or intercept squad art.
 expect(bounds.min.x).toBeGreaterThanOrEqual(2.5);
 expect(bounds.max.x).toBeLessThanOrEqual(7.5);
 expect(bounds.min.z).toBeGreaterThanOrEqual(6.5);
 expect(bounds.max.z).toBeLessThanOrEqual(7.5);
 expect(bounds.min.y).toBeGreaterThanOrEqual(-.001);
 expect(bounds.max.y).toBeLessThanOrEqual(1.85);
 const names=group.children.map(child=>child.name);
 expect(names.filter(name=>name.startsWith('roof-pitch-'))).toHaveLength(2);
 expect(names.filter(name=>name.startsWith('bay-panel-'))).toHaveLength(5);
 expect(names.filter(name=>name.startsWith('roof-plant-housing'))).toHaveLength(1);
 expect(names).toContain('skylight-glazing');
 expect(names).toContain('shared-plinth');
 dispose();
 expect(scene.children).toHaveLength(0);
});

test('separate valid spans never connect across unknown cells, invalid spans fail closed',()=>{
 const scene=new THREE.Scene();
 const dispose=addIndustrialSpanHangars(scene,[
  {start:3,end:4,row:7},
  {start:6,end:7,row:7},
  {start:8,end:5,row:7},
  {start:2.2,end:4,row:7},
  {start:0,end:30,row:7},
 ]);
 const root=scene.getObjectByName('modular-industrial-span-hangars') as THREE.Group;
 expect(root.children).toHaveLength(2);
 const left=new THREE.Box3().setFromObject(root.children[0]);
 const right=new THREE.Box3().setFromObject(root.children[1]);
 expect(left.max.x).toBeLessThan(4.5);
 expect(right.min.x).toBeGreaterThan(5.5);
 expect(root.userData.buildingCount).toBe(2);
 dispose();
 expect(scene.getObjectByName('modular-industrial-span-hangars')).toBeUndefined();
});
