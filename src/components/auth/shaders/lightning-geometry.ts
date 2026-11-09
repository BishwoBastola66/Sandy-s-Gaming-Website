import * as THREE from 'three';

export interface ActiveBolt {
  lines: THREE.Line[];
  materials: THREE.LineBasicMaterial[];
  glowLines: THREE.Line[];
  glowMaterials: THREE.LineBasicMaterial[];
  startTime: number;
  duration: number;
  flickerPattern: number[];
  origin: THREE.Vector3;
}

export interface StrikeBranchPath {
  points: THREE.Vector3[];
  depth: number;
}

export const DEFAULT_FLICKER_PATTERN = [1.0, 0.85, 0.2, 0.95, 0.7, 0.15, 0.8, 0.4, 0.1, 0.05, 0];

/**
 * Step-wise branch generation (fractal stepped leader)
 */
export function buildSteppedBranch(
  start: THREE.Vector3,
  direction: THREE.Vector3,
  totalLength: number,
  depth: number = 0,
  subtle: boolean = false
): { points: THREE.Vector3[]; branches: { start: THREE.Vector3; dir: THREE.Vector3; len: number }[] } {
  const points: THREE.Vector3[] = [start.clone()];
  const branches: { start: THREE.Vector3; dir: THREE.Vector3; len: number }[] = [];

  const stepSize = Math.max(3.5, 7.5 - depth * 1.5);
  const totalSteps = Math.max(4, Math.floor(totalLength / stepSize));
  let current = start.clone();
  const currentDir = direction.clone().normalize();

  for (let i = 0; i < totalSteps; i++) {
    const jitterAngle = (Math.random() - 0.5) * 0.9;
    const perp = new THREE.Vector3(-currentDir.y, currentDir.x, (Math.random() - 0.5) * 0.6).normalize();

    currentDir.applyAxisAngle(new THREE.Vector3(0, 0, 1), jitterAngle * 0.45);
    currentDir.addScaledVector(perp, (Math.random() - 0.5) * 0.35).normalize();

    const actualStep = stepSize * (0.7 + Math.random() * 0.6);
    current = current.clone().addScaledVector(currentDir, actualStep);
    points.push(current.clone());

    if (depth < 2 && Math.random() < (depth === 0 ? (subtle ? 0.22 : 0.28) : 0.15) && i > 2 && i < totalSteps - 2) {
      const branchAngle = (Math.random() > 0.5 ? 1 : -1) * (0.45 + Math.random() * 0.4);
      const branchDir = currentDir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), branchAngle);
      branchDir.z += (Math.random() - 0.5) * 0.4;
      branchDir.normalize();

      const branchLength = totalLength * (0.35 + Math.random() * 0.35);
      branches.push({
        start: current.clone(),
        dir: branchDir,
        len: branchLength,
      });
    }
  }

  return { points, branches };
}

/**
 * Generates a full natural lightning strike tree across the visible frustum.
 */
export function generateNaturalStrikePaths(
  visibleWidth: number,
  visibleHeight: number,
  subtle: boolean
): { start: THREE.Vector3; allPaths: StrikeBranchPath[] } {
  const originType = Math.random();
  let start: THREE.Vector3;
  let primaryDir: THREE.Vector3;
  let totalLength: number;

  if (originType < 0.55) {
    const startX = (Math.random() - 0.5) * visibleWidth * 0.95;
    const startY = visibleHeight * 0.52;
    start = new THREE.Vector3(startX, startY, (Math.random() - 0.5) * 15);
    primaryDir = new THREE.Vector3((Math.random() - 0.5) * 0.5, -1, (Math.random() - 0.5) * 0.2).normalize();
    totalLength = visibleHeight * (subtle ? 0.75 : 0.85 + Math.random() * 0.25);
  } else if (originType < 0.78) {
    const startX = -visibleWidth * 0.52;
    const startY = (Math.random() * 0.4 + 0.1) * visibleHeight;
    start = new THREE.Vector3(startX, startY, (Math.random() - 0.5) * 15);
    primaryDir = new THREE.Vector3(1, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.2).normalize();
    totalLength = visibleWidth * (0.55 + Math.random() * 0.35);
  } else {
    const startX = visibleWidth * 0.52;
    const startY = (Math.random() * 0.4 + 0.1) * visibleHeight;
    start = new THREE.Vector3(startX, startY, (Math.random() - 0.5) * 15);
    primaryDir = new THREE.Vector3(-1, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.2).normalize();
    totalLength = visibleWidth * (0.55 + Math.random() * 0.35);
  }

  const allPaths: StrikeBranchPath[] = [];

  function processBranch(bStart: THREE.Vector3, bDir: THREE.Vector3, bLen: number, depth: number) {
    const { points, branches } = buildSteppedBranch(bStart, bDir, bLen, depth, subtle);
    if (points.length >= 2) {
      allPaths.push({ points, depth });
    }
    for (const sub of branches) {
      processBranch(sub.start, sub.dir, sub.len, depth + 1);
    }
  }

  processBranch(start, primaryDir, totalLength, 0);

  return { start, allPaths };
}

export function disposeBolt(scene: THREE.Scene, bolt: ActiveBolt) {
  bolt.lines.forEach((l) => {
    scene.remove(l);
    l.geometry.dispose();
  });
  bolt.materials.forEach((m) => m.dispose());
  bolt.glowLines.forEach((gl) => {
    scene.remove(gl);
    gl.geometry.dispose();
  });
  bolt.glowMaterials.forEach((gm) => gm.dispose());
}

