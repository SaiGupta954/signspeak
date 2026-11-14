import { describe, expect, it } from 'vitest';
import { SHAPES, REST } from '../src/sign/handshapes';
import { LEXICON } from '../src/sign/lexicon';
import type { HandPose } from '../src/sign/types';

const numbers = (p: HandPose) => [...p.f.flat(), ...p.s, p.t.a, p.t.e, p.t.j1, p.t.j2, p.rot.x, p.rot.y, p.rot.z, p.pos.x, p.pos.y, p.pos.z];

describe('handshapes', () => {
  it('defines every letter A–Z and digit 0–9', () => {
    for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') expect(SHAPES[c], c).toBeDefined();
  });

  it('has finite numbers and realistic joint angles', () => {
    for (const [c, s] of Object.entries(SHAPES)) {
      expect(numbers(s.pose).every(Number.isFinite), c).toBe(true);
      for (const f of s.pose.f) for (const a of f) expect(a, c).toBeGreaterThanOrEqual(0), expect(a, c).toBeLessThanOrEqual(120);
      expect(s.desc.length, c).toBeGreaterThan(5);
    }
    expect(numbers(REST).every(Number.isFinite)).toBe(true);
  });

  it('only J and Z have movement', () => {
    const moving = Object.entries(SHAPES).filter(([, s]) => s.motion).map(([c]) => c);
    expect(moving.sort()).toEqual(['J', 'Z']);
  });

  it('J and Z motions move the hand and stay finite', () => {
    for (const c of ['J', 'Z']) {
      const p = structuredClone(SHAPES[c].pose);
      const start = { ...p.pos };
      SHAPES[c].motion!(1, p);
      expect(Math.hypot(p.pos.x - start.x, p.pos.y - start.y)).toBeGreaterThan(0.1);
      expect(numbers(p).every(Number.isFinite)).toBe(true);
    }
  });

  it('word signs have frames with positive durations', () => {
    for (const [k, e] of Object.entries(LEXICON)) {
      expect(e.frames.length, k).toBeGreaterThan(0);
      for (const f of e.frames) expect(f.dur, k).toBeGreaterThan(0);
    }
  });
});
