import * as THREE from 'three';

// One ORIGINAL, asset-independent 3D officer experiment. Unlike the existing
// camera-facing six-frame atlases, this body has genuine 360-degree geometry:
// turning the rig changes the visible front, back, face, equipment and stance.
// The tactical reducer remains the only authority for positions and damage.
export type CanonicalPose = 'idle' | 'walk' | 'fire' | 'hit';
export type CanonicalOfficerVisual = Readonly<{
  root: THREE.Group;
  setTile(x: number, z: number): void;
  setFacing(heading: number): void;
  setPose(pose: CanonicalPose, phase?: number): void;
}>;

export function createCanonicalOfficer(scene: THREE.Scene, accent = '#9ad9e9'): CanonicalOfficerVisual {
  const root = new THREE.Group();
  root.name = 'canonical-science-officer';
  const fabric = new THREE.MeshStandardMaterial({ color: accent, roughness: .77, metalness: .06 });
  const dark = new THREE.MeshStandardMaterial({ color: '#142633', roughness: .76 });
  const boots = new THREE.MeshStandardMaterial({ color: '#0b1a25', roughness: .59 });
  const skin = new THREE.MeshStandardMaterial({ color: '#d5a47e', roughness: .89 });
  const hair = new THREE.MeshStandardMaterial({ color: '#25212b', roughness: .94 });
  const metal = new THREE.MeshStandardMaterial({ color: '#c9d9da', metalness: .78, roughness: .29 });
  const glow = new THREE.MeshStandardMaterial({
    color: '#78e7df', emissive: '#267c79', emissiveIntensity: .45, roughness: .4,
  });
  const shadow = new THREE.MeshBasicMaterial({
    color: '#020e18', transparent: true, opacity: .35, depthWrite: false,
  });
  const part = (parent: THREE.Group, name: string, geometry: THREE.BufferGeometry,
    material: THREE.Material, x: number, y: number, z: number) => {
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  };
  const disk = part(root, 'ground-contact',
    new THREE.CircleGeometry(.31, 20), shadow, 0, .006, 0);
  disk.rotation.x = -Math.PI / 2;

  const leftLeg = new THREE.Group(), rightLeg = new THREE.Group();
  leftLeg.name = 'left-leg'; rightLeg.name = 'right-leg';
  for (const [leg, sign] of [[leftLeg, -1], [rightLeg, 1]] as const) {
    leg.position.set(sign * .145, .80, 0);
    part(leg, 'trouser', new THREE.BoxGeometry(.23, .53, .25), dark, 0, -.27, 0);
    part(leg, 'knee', new THREE.BoxGeometry(.235, .13, .26), fabric, 0, -.50, .02);
    part(leg, 'boot', new THREE.BoxGeometry(.25, .25, .37), boots, 0, -.64, .085);
    root.add(leg);
  }

  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 1.13;
  root.add(torso);
  part(torso, 'jacket', new THREE.BoxGeometry(.60, .68, .38), fabric, 0, 0, 0);
  part(torso, 'waist', new THREE.BoxGeometry(.49, .19, .35), dark, 0, -.37, 0);
  part(torso, 'belt-buckle', new THREE.BoxGeometry(.16, .075, .035), metal, 0, -.39, .20);
  part(torso, 'shoulder-yoke', new THREE.BoxGeometry(.67, .12, .41), dark, 0, .28, 0);
  part(torso, 'collar', new THREE.CylinderGeometry(.155, .19, .12, 10), dark, 0, .38, 0);
  // Distinct front/back geometry makes actual heading legible at game scale.
  part(torso, 'front-placket', new THREE.BoxGeometry(.055, .36, .03), dark, 0, .03, .206);
  part(torso, 'front-insignia', new THREE.BoxGeometry(.12, .075, .04), metal, -.19, .16, .215);
  part(torso, 'front-insignia-light', new THREE.BoxGeometry(.055, .035, .046), glow, -.19, .16, .242);
  part(torso, 'rear-field-pack', new THREE.BoxGeometry(.39, .38, .14), dark, 0, .03, -.27);
  for (const x of [-.12, 0, .12]) {
    part(torso, 'pack-vent', new THREE.BoxGeometry(.06, .035, .02), metal, x, .10, -.35);
  }

  const head = new THREE.Group();
  head.name = 'head'; head.position.set(0, .55, .02); torso.add(head);
  part(head, 'face', new THREE.SphereGeometry(.19, 12, 10), skin, 0, 0, 0);
  const cap = part(head, 'hair-cap', new THREE.SphereGeometry(.194, 12, 8), hair, 0, .125, -.014);
  cap.scale.set(1.03, .50, 1.02);
  for (const x of [-.072, .072]) {
    part(head, 'eye', new THREE.SphereGeometry(.022, 6, 5), dark, x, .015, .18);
  }
  part(head, 'nose', new THREE.BoxGeometry(.045, .055, .055), skin, 0, -.033, .18);

  const leftArm = new THREE.Group(), rightArm = new THREE.Group();
  leftArm.name = 'left-arm'; rightArm.name = 'right-arm';
  for (const [arm, sign] of [[leftArm, -1], [rightArm, 1]] as const) {
    arm.position.set(sign * .385, .225, 0);
    part(arm, 'sleeve', new THREE.BoxGeometry(.22, .44, .27), fabric, 0, -.225, 0);
    part(arm, 'cuff', new THREE.BoxGeometry(.225, .10, .275), dark, 0, -.47, 0);
    part(arm, 'hand', new THREE.BoxGeometry(.17, .17, .17), skin, 0, -.565, .025);
    torso.add(arm);
  }
  part(leftArm, 'wrist-scanner', new THREE.BoxGeometry(.18, .07, .20), glow, 0, -.49, .145);
  const phaser = new THREE.Group();
  phaser.position.set(0, -.58, .12);
  rightArm.add(phaser);
  part(phaser, 'tool-grip', new THREE.BoxGeometry(.16, .15, .28), boots, 0, 0, .03);
  part(phaser, 'tool-barrel', new THREE.BoxGeometry(.12, .11, .32), metal, 0, .025, .22);
  part(phaser, 'tool-emitter', new THREE.BoxGeometry(.09, .08, .045), glow, 0, .025, .39);

  scene.add(root);
  const setPose = (pose: CanonicalPose, phase = 0) => {
    if (!Number.isFinite(phase)) phase = 0;
    torso.position.set(0, 1.13, 0);
    torso.rotation.set(0, 0, 0);
    torso.scale.set(1, 1, 1);
    head.rotation.set(0, 0, 0);
    leftLeg.rotation.set(0, 0, 0); rightLeg.rotation.set(0, 0, 0);
    leftArm.rotation.set(0, 0, 0); rightArm.rotation.set(0, 0, 0);
    if (pose === 'walk') {
      const step = Math.sin(phase);
      leftLeg.rotation.x = .49 * step;
      rightLeg.rotation.x = -.49 * step;
      leftArm.rotation.x = -.37 * step;
      rightArm.rotation.x = .37 * step;
      torso.position.y += .045 * Math.abs(Math.sin(phase));
      torso.rotation.z = .035 * step;
    } else if (pose === 'fire') {
      rightArm.rotation.x = -1.28 + .13 * Math.sin(Math.PI * Math.min(1, Math.max(0, phase)));
      leftArm.rotation.x = -.46;
      torso.rotation.x = -.065;
      head.rotation.x = -.06;
    } else if (pose === 'hit') {
      const recoil = Math.sin(Math.PI * Math.min(1, Math.max(0, phase)));
      torso.rotation.z = -.23 * recoil;
      torso.position.x = -.10 * recoil;
      head.rotation.z = .18 * recoil;
      rightArm.rotation.z = -.25 * recoil;
      leftLeg.rotation.x = -.22 * recoil;
    } else {
      torso.scale.y = 1 + .012 * Math.sin(phase * 2);
      head.rotation.y = .04 * Math.sin(phase * .7);
    }
  };
  setPose('idle');
  return {
    root,
    setTile(x, z) {
      if (Number.isFinite(x) && Number.isFinite(z)) root.position.set(x, .14, z);
    },
    setFacing(heading) {
      if (Number.isFinite(heading)) root.rotation.y = heading;
    },
    setPose,
  };
}
