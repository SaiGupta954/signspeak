import { describe, expect, it } from 'vitest';
import { LetterTyper, HOLD_MS, REPEAT_MS, SPACE_MS } from '../src/recognize/typer';

/** feed the same label every 33 ms (≈30 fps) from t0 for ms */
function hold(t: LetterTyper, label: string | null, t0: number, ms: number, hand = true) {
  let now = t0;
  for (; now <= t0 + ms; now += 33) t.update(label, hand, now);
  return now;
}

describe('LetterTyper: hold-to-type', () => {
  it('types a letter after holding it', () => {
    const t = new LetterTyper();
    hold(t, 'A', 0, HOLD_MS - 100);
    expect(t.text).toBe('');
    hold(t, 'A', HOLD_MS - 67, 200);
    expect(t.text).toBe('A');
  });

  it('reports progress toward typing', () => {
    const t = new LetterTyper();
    t.update('B', true, 0);
    const p = t.update('B', true, HOLD_MS / 2);
    expect(p).toBeGreaterThan(0.4);
    expect(p).toBeLessThan(0.6);
  });

  it('does not type a letter that flickers', () => {
    const t = new LetterTyper();
    let now = 0;
    for (let i = 0; i < 40; i++, now += 100) t.update(i % 2 ? 'M' : 'N', true, now);
    expect(t.text).toBe('');
  });

  it('repeats a letter only after holding longer', () => {
    const t = new LetterTyper();
    hold(t, 'L', 0, HOLD_MS + 50);
    expect(t.text).toBe('L');
    hold(t, 'L', HOLD_MS + 83, REPEAT_MS - 200);
    expect(t.text).toBe('L');
    hold(t, 'L', HOLD_MS + REPEAT_MS - 100, 300);
    expect(t.text).toBe('LL');
  });

  it('types a double letter by changing shape in between', () => {
    const t = new LetterTyper();
    let now = hold(t, 'O', 0, HOLD_MS + 50);
    now = hold(t, null, now, 200);
    hold(t, 'O', now, HOLD_MS + 50);
    expect(t.text).toBe('OO');
  });

  it('adds one space when the hand leaves the view', () => {
    const t = new LetterTyper();
    let now = hold(t, 'H', 0, HOLD_MS + 50);
    now = hold(t, 'I', now, HOLD_MS + 50);
    now = hold(t, null, now, SPACE_MS + 400, false);
    hold(t, null, now, 3000, false);
    expect(t.text).toBe('HI ');
  });

  it('never starts the text with a space', () => {
    const t = new LetterTyper();
    hold(t, null, 0, 5000, false);
    expect(t.text).toBe('');
  });

  it('types I LOVE YOU for the ILY handshape', () => {
    const t = new LetterTyper();
    const now = hold(t, 'H', 0, HOLD_MS + 50);
    hold(t, 'ILY', now + 33, HOLD_MS + 50);
    expect(t.text).toBe('H I LOVE YOU ');
  });

  it('ignores "no letter" frames while the hand is visible', () => {
    const t = new LetterTyper();
    hold(t, null, 0, 5000, true);
    expect(t.text).toBe('');
  });

  it('space, backspace and clear', () => {
    const t = new LetterTyper();
    hold(t, 'A', 0, HOLD_MS + 50);
    t.space();
    expect(t.text).toBe('A ');
    t.backspace();
    t.backspace();
    expect(t.text).toBe('');
    t.backspace();
    expect(t.text).toBe('');
    hold(t, 'B', 2000, HOLD_MS + 50);
    t.clear();
    expect(t.text).toBe('');
  });
});
