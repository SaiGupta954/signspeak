import type { Finger, HandPose, Thumb, Vec3 } from './types';

export const THUMB = {
  up: { a: 8, e: 14, j1: 0, j2: 0 },
  across: { a: -72, e: 30, j1: 10, j2: 8 },
  front: { a: -80, e: 44, j1: 12, j2: 6 },
  out: { a: 80, e: 8, j1: 0, j2: 0 },
  tuck: { a: -42, e: 16, j1: 18, j2: 12 },
  between: { a: -14, e: 42, j1: 8, j2: 0 },
  touch: { a: -22, e: 56, j1: 28, j2: 18 },
  c: { a: 22, e: 62, j1: 22, j2: 8 },
  k: { a: -6, e: 44, j1: 8, j2: 0 },
  g: { a: 4, e: 40, j1: 4, j2: 0 },
  w: { a: -55, e: 48, j1: 32, j2: 16 },
  open: { a: 50, e: 20, j1: 0, j2: 0 },
} satisfies Record<string, Thumb>;

export function pose(
  f: Finger[],
  s: number[] = [0, 0, 0, 0],
  t: Thumb = THUMB.across,
  rot: Partial<Vec3> = {},
  pos: Partial<Vec3> = {},
): HandPose {
  return {
    f: f.map((x) => [x[0], x[1], x[2]]) as HandPose['f'],
    s: [s[0], s[1], s[2], s[3]],
    t: { ...t },
    rot: { x: 0, y: 0, z: 0, ...rot },
    pos: { x: 0, y: 0, z: 0, ...pos },
  };
}

export const clonePose = (p: HandPose): HandPose => pose(p.f, p.s, p.t, p.rot, p.pos);

/** Same pose with some fields overridden. */
export function withPose(p: HandPose, o: { rot?: Partial<Vec3>; pos?: Partial<Vec3> }): HandPose {
  const c = clonePose(p);
  Object.assign(c.rot, o.rot);
  Object.assign(c.pos, o.pos);
  return c;
}

const L = (a: number, b: number, t: number) => a + (b - a) * t;

export function mixPose(a: HandPose, b: HandPose, t: number, out: HandPose): HandPose {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) out.f[i][j] = L(a.f[i][j], b.f[i][j], t);
    out.s[i] = L(a.s[i], b.s[i], t);
  }
  out.t.a = L(a.t.a, b.t.a, t);
  out.t.e = L(a.t.e, b.t.e, t);
  out.t.j1 = L(a.t.j1, b.t.j1, t);
  out.t.j2 = L(a.t.j2, b.t.j2, t);
  out.rot.x = L(a.rot.x, b.rot.x, t);
  out.rot.y = L(a.rot.y, b.rot.y, t);
  out.rot.z = L(a.rot.z, b.rot.z, t);
  out.pos.x = L(a.pos.x, b.pos.x, t);
  out.pos.y = L(a.pos.y, b.pos.y, t);
  out.pos.z = L(a.pos.z, b.pos.z, t);
  return out;
}

export const copyPose = (src: HandPose, out: HandPose) => mixPose(src, src, 0, out);

export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
