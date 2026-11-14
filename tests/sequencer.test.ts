import { describe, expect, it } from 'vitest';
import { sequence } from '../src/sign/sequencer';

const labels = (text: string, lex = true) => sequence(text, lex).tokens.map((t) => t.label);

describe('sequencer: text → signs', () => {
  it('fingerspells a single word letter by letter', () => {
    expect(labels('cat')).toEqual(['C', 'A', 'T']);
  });

  it('puts a pause between words', () => {
    const s = sequence('hi you', false);
    expect(s.tokens.map((t) => t.kind)).toEqual(['letter', 'letter', 'pause', 'letter', 'letter', 'letter']);
    expect(s.words.map((w) => w.text)).toEqual(['HI', 'YOU']);
  });

  it('uses whole-word signs from the dictionary', () => {
    const s = sequence('Hello', true);
    expect(s.tokens).toHaveLength(1);
    expect(s.tokens[0].kind).toBe('word');
    expect(s.words[0]).toEqual({ text: 'HELLO', kind: 'sign' });
  });

  it('matches multi-word phrases before single words', () => {
    expect(labels('thank you')).toEqual(['THANK-YOU']);
    expect(labels('I love you!')).toEqual(['I-LOVE-YOU']);
  });

  it('fingerspells dictionary words when word signs are off', () => {
    expect(labels('yes', false)).toEqual(['Y', 'E', 'S']);
  });

  it('mixes signs and spelling in one sentence', () => {
    const s = sequence('Hello Sam', true);
    expect(s.words).toEqual([
      { text: 'HELLO', kind: 'sign' },
      { text: 'SAM', kind: 'spelled' },
    ]);
  });

  it('ignores punctuation, apostrophes and extra spaces', () => {
    expect(sequence("  it's   ok... ", true).words.map((w) => w.text)).toEqual(['ITS', 'OK']);
  });

  it('spells numbers digit by digit', () => {
    expect(labels('2026')).toEqual(['2', '0', '2', '6']);
  });

  it('returns nothing for empty or symbol-only input', () => {
    expect(sequence('', true).tokens).toEqual([]);
    expect(sequence('?!.,', true).tokens).toEqual([]);
  });

  it('slides repeated letters sideways', () => {
    const t = sequence('all', false).tokens;
    expect(t[1].frames[0].pose.pos.x).toBe(t[2].frames[0].pose.pos.x + 0.32);
    expect(t[2].desc).toMatch(/Repeated letter/);
  });

  it('keeps word and letter indexes for highlighting', () => {
    const t = sequence('ab cd', false).tokens.filter((x) => x.kind === 'letter');
    expect(t.map((x) => [x.wordIndex, x.charIndex])).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });

  it('marks questions for facial grammar', () => {
    expect(sequence('Are you ready?', true).expression).toBe('yesno');
    expect(sequence('What is your name?', true).expression).toBe('wh');
    expect(sequence('where are you', true).expression).toBe('wh');
    expect(sequence('I am ready.', true).expression).toBe('neutral');
  });
});
