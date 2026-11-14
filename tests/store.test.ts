import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../src/store';
import { driver } from '../src/sign/driver';

const S = () => useStore.getState();
const finish = () => {
  for (let i = 0; i < 2000 && driver.playing; i++) driver.tick(50, 2.5);
};

describe('store', () => {
  beforeEach(() => {
    S().stop();
    useStore.setState({ history: [], words: [], tokens: [], useWordSigns: true });
  });

  it('sign() starts playback and shows the words', () => {
    S().sign('Hello Sam');
    expect(S().playing).toBe(true);
    expect(S().words.map((w) => w.text)).toEqual(['HELLO', 'SAM']);
    expect(driver.playing).toBe(true);
  });

  it('ignores empty input', () => {
    S().sign('  ?! ');
    expect(S().playing).toBe(false);
    expect(S().history).toEqual([]);
  });

  it('records history without duplicates, newest first, max 20', () => {
    S().sign('one');
    S().sign('two');
    S().sign('one');
    expect(S().history).toEqual(['one', 'two']);
    for (let i = 0; i < 30; i++) S().sign(`w${i}`);
    expect(S().history).toHaveLength(20);
    expect(S().history[0]).toBe('w29');
  });

  it('sign(text, false) does not touch history', () => {
    S().sign('secret', false);
    expect(S().history).toEqual([]);
  });

  it('respects the word-signs setting', () => {
    useStore.setState({ useWordSigns: false });
    S().sign('hello');
    expect(S().words[0]).toEqual({ text: 'HELLO', kind: 'spelled' });
  });

  it('queues voice sentences while signing and plays them next', () => {
    vi.useFakeTimers();
    S().enqueue('first');
    S().enqueue('second');
    expect(S().queue).toEqual(['second']);
    finish();
    expect(S().playing).toBe(false);
    vi.advanceTimersByTime(300);
    expect(S().playing).toBe(true);
    expect(S().words[0].text).toBe('SECOND');
    vi.useRealTimers();
  });

  it('stop() clears playback and the queue', () => {
    S().sign('abc');
    S().enqueue('later');
    S().stop();
    expect(S().playing).toBe(false);
    expect(S().queue).toEqual([]);
    expect(S().current).toBe(-1);
    expect(driver.playing).toBe(false);
  });

  it('tracks the current token while signing', () => {
    S().sign('ab', false);
    expect(S().current).toBe(0);
    for (let i = 0; i < 30; i++) driver.tick(50, 1);
    expect(S().current).toBe(1);
  });
});
