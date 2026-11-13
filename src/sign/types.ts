export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Flexion of one finger in degrees: [knuckle (MCP), middle joint (PIP), tip joint (DIP)]. */
export type Finger = [number, number, number];

/**
 * Thumb as a short chain.
 * a  – direction in the palm plane, degrees from "fingers up" toward the thumb side (+90 = straight out)
 * e  – elevation out of the palm plane toward the viewer (degrees)
 * j1 – bend at the middle joint, j2 – bend at the tip (degrees, curling toward the palm)
 */
export interface Thumb {
  a: number;
  e: number;
  j1: number;
  j2: number;
}

export interface HandPose {
  /** index, middle, ring, pinky */
  f: [Finger, Finger, Finger, Finger];
  /** side spread per finger, degrees (+ = toward the thumb) */
  s: [number, number, number, number];
  t: Thumb;
  /** wrist orientation in degrees, applied as twist (y) → flex (x) → tilt (z) */
  rot: Vec3;
  /** wrist position offset in world units */
  pos: Vec3;
}

/** Mutates `out` while a keyframe is held; p runs 0 → 1. */
export type Motion = (p: number, out: HandPose) => void;

export interface Keyframe {
  pose: HandPose;
  /** duration in "letter units" (1 = one fingerspelled letter at the current speed) */
  dur: number;
  motion?: Motion;
}

export type TokenKind = 'letter' | 'word' | 'pause';

export interface Token {
  kind: TokenKind;
  label: string;
  desc: string;
  wordIndex: number;
  charIndex: number;
  frames: Keyframe[];
}

export interface DisplayWord {
  text: string;
  kind: 'spelled' | 'sign';
}

/** Non-manual marker shown on the face for the whole sentence. */
export type Expression = 'neutral' | 'yesno' | 'wh';
