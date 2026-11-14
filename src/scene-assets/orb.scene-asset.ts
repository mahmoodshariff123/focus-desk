import {
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
} from '@iwsdk/core';

/**
 * Focus orb that sits in front of the timer. FocusDeskSystem looks up the
 * named meshes and drives their emissive color, scale and spin from progress.
 */
export function createFocusOrb(): Group {
  const root = new Group();

  const base = new Mesh(
    new CylinderGeometry(0.07, 0.085, 0.018, 48),
    new MeshStandardMaterial({ color: '#2a2c31', roughness: 0.45, metalness: 0.2 }),
  );
  base.name = 'orb-base';
  base.position.y = 0.009;

  const core = new Mesh(
    new IcosahedronGeometry(0.05, 5),
    new MeshStandardMaterial({
      color: '#9fb4ff',
      emissive: '#3a5cff',
      emissiveIntensity: 0.25,
      roughness: 0.25,
      metalness: 0,
    }),
  );
  core.name = 'orb-core';
  core.position.y = 0.075;

  const ring = new Mesh(
    new TorusGeometry(0.072, 0.0045, 12, 96),
    new MeshStandardMaterial({
      color: '#d9dce3',
      emissive: '#3a5cff',
      emissiveIntensity: 0.2,
      roughness: 0.3,
      metalness: 0.4,
    }),
  );
  ring.name = 'orb-ring';
  ring.position.y = 0.075;
  ring.rotation.x = Math.PI / 2.4;

  root.add(base, core, ring);
  return root;
}