import { describe, expect, it, vi } from 'vitest';
import { SignDriver } from '../src/sign/driver';
import { sequence } from '../src/sign/sequencer';

const run = (d: SignDriver, ms: number, speed = 1, step = 16) => {
  for (let t = 0; t < ms; t += step) d.tick(step, speed);
};

describe('SignDriver: timing and playback', () => {
  it('reports each token in order and finishes once', () => {
    const d = new SignDriver();
    const seen: number[] = [];
    const done = vi.fn();
    d.onToken = (i) => seen.push(i);
    d.onDone = done;
    d.load(sequence('ab c', false).tokens); // A, B, pause, C
    expect(d.playing).toBe(true);
    run(d, 5000);
    expect(seen).toEqual([0, 1, 2, 3]);
    expect(done).toHaveBeenCalledTimes(1);
    expect(d.playing).toBe(false);
  });

  it('takes about one second per letter at speed 1', () => {
    const d = new SignDriver();
    const done = vi.fn();
    d.onDone = done;
    d.load(sequence('abc', false).tokens);
    run(d, 2900);
    expect(done).not.toHaveBeenCalled();
    run(d, 300);
    expect(done).toHaveBeenCalled();
  });

  it('plays faster at higher speed', () => {
    const d = new SignDriver();
    const done = vi.fn();
    d.onDone = done;
    d.load(sequence('abc', false).tokens);
    run(d, 1600, 2);
    expect(done).toHaveBeenCalled();
  });

  it('does not advance while paused, and resumes', () => {
    const d = new SignDriver();
    const seen: number[] = [];
    d.onToken = (i) => seen.push(i);
    d.load(sequence('ab', false).tokens);
    d.pause();
    run(d, 5000);
    expect(seen).toEqual([0]);
    d.resume();
    run(d, 5000);
    expect(seen).toEqual([0, 1]);
  });

  it('stop() ends playback without calling onDone', () => {
    const d = new SignDriver();
    const done = vi.fn();
    d.onDone = done;
    d.load(sequence('hello there', false).tokens);
    run(d, 500);
    d.stop();
    run(d, 5000);
    expect(d.playing).toBe(false);
    expect(done).not.toHaveBeenCalled();
  });

  it('always returns a finite pose, including big frame gaps', () => {
    const d = new SignDriver();
    d.load(sequence('jazz 9', false).tokens);
    for (const dt of [16, 16, 5000, 16, 250, 16]) {
      const p = d.tick(dt, 1.2);
      const all = [...p.f.flat(), ...p.s, p.t.a, p.t.e, p.rot.x, p.rot.y, p.rot.z, p.pos.x, p.pos.y, p.pos.z];
      expect(all.every(Number.isFinite)).toBe(true);
    }
  });

  it('loading an empty list does nothing', () => {
    const d = new SignDriver();
    d.load([]);
    expect(d.playing).toBe(false);
  });
});
