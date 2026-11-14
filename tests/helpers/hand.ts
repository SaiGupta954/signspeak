import type { Pt } from '../../src/recognize/classify';

/**
 * Builds MediaPipe-style landmarks (21 points) for an idealized right hand,
 * palm facing the camera, fingers up, thumb on +x. Units: metres.
 * f: flexion per finger [knuckle, middle, tip] in degrees (index, middle, ring, pinky)
 * spread: degrees toward the thumb per finger
 * thumb: direction of the thumb (x: across palm/out, y: up, z: toward camera) and bend in degrees
 */
export interface HandSpec {
  f: [number, number, number][];
  spread?: number[];
  thumb: { dir: [number, number, number]; bend?: number; base?: [number, number, number] };
}

const BASES: [number, number, number][] = [
  [0.025, 0.09, 0],
  [0.005, 0.095, 0],
  [-0.015, 0.09, 0],
  [-0.033, 0.08, 0],
];
const LENS = [
  [0.04, 0.025, 0.02],
  [0.045, 0.028, 0.02],
  [0.042, 0.026, 0.019],
  [0.032, 0.02, 0.018],
];
const THUMB_LENS = [0.035, 0.03, 0.025];
const DEG = Math.PI / 180;

const v = (x: number, y: number, z: number): Pt => ({ x, y, z });
const add = (a: Pt, b: Pt, s = 1): Pt => v(a.x + b.x * s, a.y + b.y * s, a.z + b.z * s);
const norm = (a: Pt): Pt => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return v(a.x / l, a.y / l, a.z / l);
};
/** rotate vector a around unit axis k by angle (Rodrigues) */
function rot(a: Pt, k: Pt, ang: number): Pt {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const d = k.x * a.x + k.y * a.y + k.z * a.z;
  const cx = k.y * a.z - k.z * a.y;
  const cy = k.z * a.x - k.x * a.z;
  const cz = k.x * a.y - k.y * a.x;
  return v(a.x * c + cx * s + k.x * d * (1 - c), a.y * c + cy * s + k.y * d * (1 - c), a.z * c + cz * s + k.z * d * (1 - c));
}

export function makeHand(spec: HandSpec): Pt[] {
  const pts: Pt[] = new Array(21);
  pts[0] = v(0, 0, 0);
  // thumb: CMC, MCP, IP, TIP
  const tb = spec.thumb.base ?? [0.022, 0.025, 0.008];
  pts[1] = v(...tb);
  let d = norm(v(...spec.thumb.dir));
  // bending curls the thumb toward the palm / fingers
  const T = norm(v(-0.6, 0.3, 0.7));
  const bendAxis = norm(v(d.y * T.z - d.z * T.y, d.z * T.x - d.x * T.z, d.x * T.y - d.y * T.x));
  let p = pts[1];
  for (let j = 0; j < 3; j++) {
    if (j > 0 && spec.thumb.bend) d = norm(rot(d, bendAxis, (spec.thumb.bend * DEG) / 2));
    p = add(p, d, THUMB_LENS[j]);
    pts[2 + j] = p;
  }
  // fingers
  for (let i = 0; i < 4; i++) {
    const s = (spec.spread?.[i] ?? 0) * DEG;
    let dir = v(Math.sin(s), Math.cos(s), 0);
    const axis = norm(v(dir.y, -dir.x, 0)); // flexing rotates the finger toward +z (the camera)
    let q = v(...BASES[i]);
    pts[5 + i * 4] = q;
    for (let j = 0; j < 3; j++) {
      dir = norm(rot(dir, axis, -spec.f[i][j] * DEG));
      q = add(q, dir, LENS[i][j]);
      pts[6 + i * 4 + j] = q;
    }
  }
  return pts;
}

/** Simple orthographic "camera" image: x right, y down, normalized-ish. */
export function toImage(world: Pt[], rollDeg = 0): Pt[] {
  const r = rollDeg * DEG;
  return world.map((p) => {
    const x = p.x * Math.cos(r) - p.y * Math.sin(r);
    const y = p.x * Math.sin(r) + p.y * Math.cos(r);
    return v(0.5 + x * 3, 0.5 - y * 3, p.z * 3);
  });
}

export function rotateWorld(world: Pt[], axis: [number, number, number], deg: number): Pt[] {
  const k = norm(v(...axis));
  return world.map((p) => rot(p, k, deg * DEG));
}

export const mirror = (pts: Pt[], cx = 0): Pt[] => pts.map((p) => v(2 * cx - p.x, p.y, p.z));
export const scale = (pts: Pt[], s: number): Pt[] => pts.map((p) => v(p.x * s, p.y * s, p.z * s));
