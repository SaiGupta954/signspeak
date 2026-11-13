import { pose, withPose, THUMB as T } from './pose';
import { SHAPES, ILY, FLAT, FLAT_OPEN, E, F } from './handshapes';
import type { Keyframe } from './types';

export interface LexEntry {
  gloss: string;
  desc: string;
  frames: Keyframe[];
}

const NO_OPEN = pose([E, E, F, F], [1, -1, 0, 0], T.open);
const NO_SHUT = pose([[45, 40, 20], [45, 40, 20], F, F], [1, -1, 0, 0], { a: -10, e: 55, j1: 25, j2: 15 });
const S = SHAPES.S.pose;

/**
 * A few whole-word signs, simplified. Positions are offsets from the normal
 * fingerspelling spot in hand-length units (~8 cm); rotations are wrist degrees.
 * Anything not listed here is fingerspelled.
 */
export const LEXICON: Record<string, LexEntry> = {
  HELLO: {
    gloss: 'HELLO',
    desc: 'Flat hand starts at the side of the forehead and moves outward, like a salute.',
    frames: [
      { pose: withPose(FLAT, { rot: { z: -22 }, pos: { x: 0.85, y: 0.9, z: -1.5 } }), dur: 0.7 },
      { pose: withPose(FLAT, { rot: { z: 8 }, pos: { x: -0.9, y: 0.65, z: 0.5 } }), dur: 0.9 },
    ],
  },
  'THANK YOU': {
    gloss: 'THANK-YOU',
    desc: 'Fingertips of a flat hand start at the chin and move forward toward the other person.',
    frames: [
      { pose: withPose(FLAT_OPEN, { rot: { y: 175, z: -10 }, pos: { x: 2.2, y: -0.65, z: -1.4 } }), dur: 0.75 },
      { pose: withPose(FLAT_OPEN, { rot: { y: 175, x: 55, z: -10 }, pos: { x: 1.6, y: -1.1, z: 1.4 } }), dur: 1.0 },
    ],
  },
  YES: {
    gloss: 'YES',
    desc: 'A fist (S hand) nods up and down at the wrist, like a head nodding.',
    frames: [
      { pose: withPose(S, { rot: { x: 0 } }), dur: 0.35 },
      { pose: withPose(S, { rot: { x: 40 } }), dur: 0.3 },
      { pose: withPose(S, { rot: { x: 0 } }), dur: 0.3 },
      { pose: withPose(S, { rot: { x: 40 } }), dur: 0.3 },
      { pose: withPose(S, { rot: { x: 5 } }), dur: 0.35 },
    ],
  },
  NO: {
    gloss: 'NO',
    desc: 'Index and middle fingers snap closed onto the thumb, twice.',
    frames: [
      { pose: NO_OPEN, dur: 0.35 },
      { pose: NO_SHUT, dur: 0.3 },
      { pose: NO_OPEN, dur: 0.3 },
      { pose: NO_SHUT, dur: 0.45 },
    ],
  },
  'I LOVE YOU': {
    gloss: 'I-LOVE-YOU',
    desc: 'Thumb, index and pinky extended together, palm facing out.',
    frames: [
      { pose: ILY, dur: 0.5 },
      { pose: withPose(ILY, { pos: { z: 0.5, y: 0.1 } }), dur: 1.0 },
    ],
  },
};
LEXICON.HI = { ...LEXICON.HELLO, gloss: 'HI' };
LEXICON.THANKS = { ...LEXICON['THANK YOU'], gloss: 'THANKS' };
LEXICON.ILY = LEXICON['I LOVE YOU'];

export const MAX_PHRASE_WORDS = 3;
