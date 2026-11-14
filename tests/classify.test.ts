import { describe, expect, it } from 'vitest';
import { classify } from '../src/recognize/classify';
import { makeHand, toImage, rotateWorld, mirror, scale, type HandSpec } from './helpers/hand';

type F3 = [number, number, number];
const E: F3 = [0, 0, 0];
const F: F3 = [88, 100, 62];
const ACROSS = { dir: [-0.8, 0.35, 0.6] as F3 };
const OUT = { dir: [1, 0.1, 0] as F3 };

const SPECS: Record<string, HandSpec & { roll?: number }> = {
  A: { f: [F, F, F, F], thumb: { dir: [0.15, 1, 0.2] } },
  B: { f: [E, E, E, E], spread: [2, 0, -1, -3], thumb: ACROSS },
  D: { f: [E, [40, 70, 40], [40, 70, 40], [40, 70, 40]], thumb: { dir: [-0.3, 0.8, 0.6] } },
  F: { f: [[40, 60, 40], E, E, E], spread: [0, 3, -2, -7], thumb: { dir: [-0.2, 0.9, 0.5] } },
  G: { f: [E, F, F, F], thumb: { dir: [0.1, 1, 0.3] }, roll: -90 },
  H: { f: [E, E, F, F], thumb: ACROSS, roll: -90 },
  I: { f: [F, F, F, E], thumb: ACROSS },
  L: { f: [E, F, F, F], thumb: OUT },
  P: { f: [E, [45, 0, 0], F, F], thumb: { dir: [-0.1, 1, 0.5] }, roll: 180 },
  Q: { f: [E, F, F, F], thumb: { dir: [0.1, 1, 0.3] }, roll: 180 },
  S: { f: [F, F, F, F], thumb: { dir: [-0.6, 0.45, 0.65] } },
  U: { f: [E, E, F, F], spread: [1, -1, 0, 0], thumb: ACROSS },
  V: { f: [E, E, F, F], spread: [12, -12, 0, 0], thumb: ACROSS },
  W: { f: [E, E, E, F], spread: [12, 0, -12, 0], thumb: ACROSS },
  X: { f: [[10, 95, 70], F, F, F], thumb: ACROSS },
  Y: { f: [F, F, F, E], spread: [0, 0, 0, -20], thumb: OUT },
  ILY: { f: [E, F, F, E], spread: [2, 0, 0, -10], thumb: OUT },
  C: { f: [[40, 40, 30], [40, 40, 30], [40, 40, 30], [40, 40, 30]], thumb: { dir: [0.3, 0.6, 0.75], bend: 30 } },
};

function label(spec: HandSpec & { roll?: number }) {
  const w = makeHand(spec);
  return classify(w, toImage(w, spec.roll ?? 0));
}

describe('classify: idealized hands', () => {
  for (const [want, spec] of Object.entries(SPECS)) {
    it(`reads ${want}`, () => expect(label(spec)).toBe(want));
  }

  it('reads O when the fingertips curve onto the thumb', () => {
    const fingers: F3[] = [[50, 70, 50], [50, 70, 50], [50, 70, 50], [50, 70, 50]];
    const probe = makeHand({ f: fingers, thumb: ACROSS });
    const tip = probe[8];
    const base = { x: 0.022, y: 0.025, z: 0.008 };
    const dir: F3 = [tip.x - base.x, tip.y - base.y, tip.z - base.z];
    expect(label({ f: fingers, thumb: { dir } })).toBe('O');
  });
});

describe('classify: robustness', () => {
  const upright = ['A', 'B', 'D', 'F', 'I', 'L', 'S', 'U', 'V', 'W', 'Y', 'ILY'];

  it('gives the same letter when the hand is turned (3D world points rotated)', () => {
    for (const c of upright) {
      const w = makeHand(SPECS[c]);
      const img = toImage(w);
      for (const [axis, deg] of [[[1, 0, 0], 35], [[0, 1, 0], 60], [[0, 0, 1], 25], [[1, 1, 0], 40]] as [F3, number][]) {
        expect(classify(rotateWorld(w, axis, deg), img), `${c} rotated ${deg}° about ${axis}`).toBe(c);
      }
    }
  });

  it('works for a left hand (mirror image)', () => {
    for (const c of upright) {
      const w = makeHand(SPECS[c]);
      expect(classify(mirror(w), mirror(toImage(w), 0.5)), c).toBe(c);
    }
  });

  it('works for bigger and smaller hands', () => {
    for (const c of upright) {
      const w = makeHand(SPECS[c]);
      for (const s of [0.7, 1.4]) expect(classify(scale(w, s), toImage(w)), `${c} x${s}`).toBe(c);
    }
  });

  it('never throws on junk input', () => {
    const zeros = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
    expect(() => classify(zeros, zeros)).not.toThrow();
    for (let k = 0; k < 200; k++) {
      const r = Array.from({ length: 21 }, () => ({ x: Math.random() - 0.5, y: Math.random() - 0.5, z: Math.random() - 0.5 }));
      const out = classify(r, r);
      expect(out === null || typeof out === 'string').toBe(true);
    }
  });
});
