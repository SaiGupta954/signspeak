import { SHAPES } from './handshapes';
import { LEXICON, MAX_PHRASE_WORDS } from './lexicon';
import { withPose } from './pose';
import type { DisplayWord, Expression, Token } from './types';

const WH = new Set(['WHO', 'WHAT', 'WHEN', 'WHERE', 'WHY', 'HOW', 'WHICH']);

export interface Sequence {
  tokens: Token[];
  words: DisplayWord[];
  expression: Expression;
}

/** Turns an English sentence into a timeline of sign tokens. */
export function sequence(text: string, useLexicon: boolean): Sequence {
  const raw = text.trim();
  const words = raw
    .toUpperCase()
    .replace(/'/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const isQuestion = /\?\s*$/.test(raw) || WH.has(words[0] ?? '');
  const expression: Expression = !isQuestion ? 'neutral' : WH.has(words[0] ?? '') ? 'wh' : 'yesno';

  const tokens: Token[] = [];
  const display: DisplayWord[] = [];
  let i = 0;

  while (i < words.length) {
    const wordIndex = display.length;
    if (wordIndex > 0) {
      tokens.push({ kind: 'pause', label: '·', desc: 'Short pause between words.', wordIndex, charIndex: -1, frames: [] });
    }

    // Longest phrase match against the sign dictionary
    let matched = 0;
    if (useLexicon) {
      for (let n = Math.min(MAX_PHRASE_WORDS, words.length - i); n >= 1; n--) {
        const key = words.slice(i, i + n).join(' ');
        const entry = LEXICON[key];
        if (entry) {
          tokens.push({ kind: 'word', label: entry.gloss, desc: entry.desc, wordIndex, charIndex: -1, frames: entry.frames });
          display.push({ text: entry.gloss, kind: 'sign' });
          matched = n;
          break;
        }
      }
    }

    if (!matched) {
      const w = words[i];
      [...w].forEach((c, ci) => {
        const shape = SHAPES[c];
        if (!shape) return;
        const repeated = ci > 0 && w[ci - 1] === c;
        // Repeated letters slide sideways so you can see there are two
        const p = repeated ? withPose(shape.pose, { pos: { x: shape.pose.pos.x - 0.32 } }) : shape.pose;
        tokens.push({
          kind: 'letter',
          label: c,
          desc: shape.desc + (repeated ? ' (Repeated letter: slide sideways.)' : ''),
          wordIndex,
          charIndex: ci,
          frames: [{ pose: p, dur: 1, motion: shape.motion }],
        });
      });
      display.push({ text: w, kind: 'spelled' });
      matched = 1;
    }
    i += matched;
  }

  return { tokens, words: display, expression };
}
