import { pose, THUMB as T, ease, clamp01 } from './pose';
import type { Finger, HandPose, Motion } from './types';

// Finger presets: [knuckle, middle joint, tip joint] flexion in degrees
const E: Finger = [0, 0, 0]; // extended
const F: Finger = [88, 100, 62]; // curled into a fist
const HK: Finger = [6, 95, 75]; // hooked (X)
const CV: Finger = [28, 42, 28]; // C curve
const OC: Finger = [48, 62, 42]; // O curl, tips meet the thumb
const EB: Finger = [30, 108, 72]; // E: bent down onto the thumb
const TK: Finger = [78, 72, 30]; // folded over a tucked thumb (M, N)
const KM: Finger = [42, 0, 0]; // middle angled toward the viewer (K, P)

export interface Shape {
  pose: HandPose;
  desc: string;
  motion?: Motion;
}

/** Relaxed hand, lowered — used between sentences. */
export const REST = pose(
  [
    [18, 24, 12],
    [20, 26, 14],
    [22, 28, 14],
    [24, 30, 16],
  ],
  [4, 1, -2, -6],
  { a: 38, e: 22, j1: 8, j2: 6 },
  { x: 95, y: 0, z: 25 },
  { x: -0.4, y: -6.6, z: -0.6 },
);

/** J: the pinky draws a J while the wrist twists. */
const J: Motion = (p, o) => {
  const e = ease(clamp01(p));
  o.rot.y += -80 * e;
  o.pos.y += -0.45 * Math.sin(clamp01(p) * Math.PI * 0.5);
  o.pos.x += 0.3 * clamp01(p * 2 - 1);
};

/** Z: the index draws a Z. Mirrored so it reads correctly from the signer's side. */
const ZPTS: [number, number][] = [
  [0, 0],
  [0.38, 0.32],
  [-0.38, 0.32],
  [0.38, -0.32],
  [-0.38, -0.32],
];
const Z: Motion = (p, o) => {
  const n = ZPTS.length - 1;
  const q = clamp01(p) * n;
  const k = Math.min(n - 1, Math.floor(q));
  const t = ease(clamp01(q - k));
  o.pos.x += ZPTS[k][0] + (ZPTS[k + 1][0] - ZPTS[k][0]) * t;
  o.pos.y += ZPTS[k][1] + (ZPTS[k + 1][1] - ZPTS[k][1]) * t;
};

const BACK = { y: 165 }; // palm facing the signer (numbers 1–5)

export const SHAPES: Record<string, Shape> = {
  A: { pose: pose([F, F, F, F], undefined, T.up), desc: 'Fist, thumb resting against the side of the index finger.' },
  B: { pose: pose([E, E, E, E], [2, 0, -1, -3], T.across), desc: 'Flat hand, fingers together and up, thumb folded across the palm.' },
  C: { pose: pose([CV, CV, CV, CV], [4, 1, -1, -3], T.c, { y: -55 }), desc: 'Fingers and thumb curved into a C.' },
  D: { pose: pose([E, OC, OC, OC], [2, 0, 0, 0], T.touch), desc: 'Index up; the other fingertips touch the thumb.' },
  E: { pose: pose([EB, EB, EB, EB], undefined, { a: -70, e: 22, j1: 10, j2: 6 }), desc: 'Fingertips bent down to rest on the tucked thumb.' },
  F: { pose: pose([[40, 60, 40], E, E, E], [0, 3, -2, -7], T.touch), desc: 'Index touches the thumb; the other three fingers are up and spread.' },
  G: { pose: pose([E, F, F, F], undefined, T.g, { y: 150, z: -90 }), desc: 'Index and thumb point sideways, parallel.' },
  H: { pose: pose([E, E, F, F], [1, -1, 0, 0], T.across, { y: 150, z: -90 }), desc: 'Index and middle together, pointing sideways.' },
  I: { pose: pose([F, F, F, E], [0, 0, 0, -3], T.front), desc: 'Fist with the pinky raised.' },
  J: { pose: pose([F, F, F, E], [0, 0, 0, -3], T.front), desc: 'Pinky raised, then trace a J in the air.', motion: J },
  K: { pose: pose([E, KM, F, F], [-3, 6, 0, 0], T.k), desc: 'Index up, middle angled out, thumb between them.' },
  L: { pose: pose([E, F, F, F], undefined, T.out), desc: 'Index up and thumb out: an L shape.' },
  M: { pose: pose([TK, TK, TK, F], undefined, T.tuck), desc: 'Thumb tucked under the first three fingers.' },
  N: { pose: pose([TK, TK, F, F], undefined, T.tuck), desc: 'Thumb tucked under the index and middle fingers.' },
  O: { pose: pose([OC, OC, OC, OC], [3, 1, -1, -3], T.touch, { y: -40 }), desc: 'All fingertips curve to meet the thumb: an O.' },
  P: { pose: pose([E, KM, F, F], [-3, 6, 0, 0], T.k, { x: 130 }, { y: 0.55 }), desc: 'Like K, but the hand points down.' },
  Q: { pose: pose([E, F, F, F], undefined, T.g, { x: 145 }, { y: 0.6 }), desc: 'Like G, but index and thumb point down.' },
  R: { pose: pose([[0, 0, 0], [10, 0, 0], F, F], [-9, 9, 0, 0], T.across), desc: 'Index and middle fingers crossed.' },
  S: { pose: pose([F, F, F, F], undefined, T.front), desc: 'Fist with the thumb across the front of the fingers.' },
  T: { pose: pose([[70, 90, 60], F, F, F], undefined, T.between), desc: 'Thumb tucked between the index and middle fingers.' },
  U: { pose: pose([E, E, F, F], [1, -1, 0, 0], T.across), desc: 'Index and middle fingers up, together.' },
  V: { pose: pose([E, E, F, F], [10, -9, 0, 0], T.across), desc: 'Index and middle fingers up, spread apart.' },
  W: { pose: pose([E, E, E, F], [12, 0, -11, 0], T.w), desc: 'Index, middle and ring fingers up and spread.' },
  X: { pose: pose([HK, F, F, F], undefined, T.front), desc: 'Index finger raised and hooked.' },
  Y: { pose: pose([F, F, F, E], [0, 0, 0, -18], T.out), desc: 'Thumb and pinky out, other fingers closed.' },
  Z: { pose: pose([E, F, F, F], undefined, T.across), desc: 'Index finger draws a Z in the air.', motion: Z },
  '0': { pose: pose([OC, OC, OC, OC], [3, 1, -1, -3], T.touch, { y: -40 }), desc: 'Number 0: an O shape.' },
  '1': { pose: pose([E, F, F, F], undefined, T.across, BACK), desc: 'Number 1: index up, palm facing in.' },
  '2': { pose: pose([E, E, F, F], [10, -9, 0, 0], T.across, BACK), desc: 'Number 2: index and middle up, palm in.' },
  '3': { pose: pose([E, E, F, F], [10, -9, 0, 0], T.out, BACK), desc: 'Number 3: thumb, index and middle out.' },
  '4': { pose: pose([E, E, E, E], [9, 3, -4, -11], T.across, BACK), desc: 'Number 4: four fingers up, thumb in.' },
  '5': { pose: pose([E, E, E, E], [9, 3, -4, -11], T.out, BACK), desc: 'Number 5: all five fingers spread.' },
  '6': { pose: pose([E, E, E, F], [12, 0, -11, 0], T.w), desc: 'Number 6: pinky touches the thumb.' },
  '7': { pose: pose([E, E, [45, 60, 40], E], [10, 2, 0, -12], T.touch), desc: 'Number 7: ring finger touches the thumb.' },
  '8': { pose: pose([E, [45, 60, 40], E, E], [10, 0, -3, -12], T.touch), desc: 'Number 8: middle finger touches the thumb.' },
  '9': { pose: pose([[40, 60, 40], E, E, E], [0, 3, -2, -7], T.touch), desc: 'Number 9: index touches the thumb (like F).' },
};

export const ILY = pose([E, F, F, E], [2, 0, 0, -10], T.out);
export const FLAT = pose([E, E, E, E], [1, 0, -1, -2], T.across);
export const FLAT_OPEN = pose([E, E, E, E], [1, 0, -1, -2], { a: 30, e: 15, j1: 0, j2: 0 });
export { E, F };
