/**
 * Rule-based ASL fingerspelling recognizer.
 * Input: MediaPipe Hands landmarks for one hand (21 points).
 *  - world: 3D points in metres (used for finger shape)
 *  - image: normalized image points, y pointing down (used for which way the hand points)
 * Works for static letters held still; J and Z need motion and aren't recognized.
 */
export interface Pt {
  x: number;
  y: number;
  z: number;
}

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Pt) => Math.hypot(a.x, a.y, a.z);
const dist = (a: Pt, b: Pt) => len(sub(a, b));
const norm = (a: Pt): Pt => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const cross = (a: Pt, b: Pt): Pt => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const angle = (a: Pt, b: Pt) => (Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) * 180) / Math.PI;

// landmark indices
const WRIST = 0;
const TH = { cmc: 1, mcp: 2, ip: 3, tip: 4 };
const F = [5, 9, 13, 17]; // MCP of index, middle, ring, pinky (pip = +1, dip = +2, tip = +3)

type State = 'ext' | 'half' | 'curl';

export interface Features {
  state: State[];
  straight: number[];
  hook: boolean;
  thumbOut: boolean;
  thumb: { sx: number; ty: number };
  palm: number;
  indexTipY: number;
  spread: number;
}

export function features(w: Pt[]): Features {
  const palm = dist(w[WRIST], w[9]);
  const straight = F.map((m) => {
    const chain = dist(w[m], w[m + 1]) + dist(w[m + 1], w[m + 2]) + dist(w[m + 2], w[m + 3]);
    return dist(w[m], w[m + 3]) / chain;
  });
  const mcpBend = F.map((m) => angle(sub(w[m], w[WRIST]), sub(w[m + 1], w[m])));
  const state: State[] = straight.map((s, i) => (s > 0.86 && mcpBend[i] < 32 ? 'ext' : s < 0.62 ? 'curl' : 'half'));
  // X: index knuckle straight, middle joint bent
  const hook = mcpBend[0] < 50 && angle(sub(w[6], w[5]), sub(w[8], w[6])) > 65 && state[0] !== 'ext';

  // hand frame: up = wrist → middle knuckle, side = pinky knuckle → index knuckle
  const up = norm(sub(w[9], w[WRIST]));
  let side = sub(w[5], w[17]);
  side = norm(sub(side, { x: up.x * dot(side, up), y: up.y * dot(side, up), z: up.z * dot(side, up) }));
  const sideSpan = dot(sub(w[5], w[17]), side) || 1;
  const sx = dot(sub(w[TH.tip], w[17]), side) / sideSpan; // 0 = pinky knuckle, 1 = index knuckle
  const ty = dot(sub(w[TH.tip], w[WRIST]), up) / palm; // 1 = knuckle height
  const thumbAngle = angle(sub(w[TH.tip], w[TH.mcp]), up);
  const thumbOut = thumbAngle > 50 && sx > 1.25 && dist(w[TH.tip], w[5]) / palm > 0.55;
  void cross;
  const indexTipY = dot(sub(w[8], w[WRIST]), up) / palm; // how high the index tip reaches
  const spread = angle(sub(w[8], w[5]), sub(w[12], w[9]));
  return { state, straight, hook, thumbOut, thumb: { sx, ty }, palm, indexTipY, spread };
}

/** Returns a letter (A–Z except J/Z), "ILY" for I-love-you, or null if unsure. */
export function classify(world: Pt[], image: Pt[]): string | null {
  const f = features(world);
  const [I, M, R, P] = f.state;
  const ext = f.state.map((s) => s === 'ext');
  const curled = f.state.map((s) => s !== 'ext');
  const touch = (tip: number) => dist(world[TH.tip], world[tip]) / f.palm < 0.38;

  // which way the index finger points on screen (image y grows downward)
  const d = sub(image[8], image[5]);
  const horizontal = Math.abs(d.x) > Math.abs(d.y) * 1.2;
  const down = d.y > Math.abs(d.x) * 0.8;

  // pointing sideways / down
  if (ext[0] && curled[2] && curled[3]) {
    if (horizontal) return ext[1] ? 'H' : 'G';
    if (down) return M !== 'curl' ? 'P' : 'Q';
  }

  if (ext[0] && ext[3] && curled[1] && curled[2] && f.thumbOut) return 'ILY';
  if (ext.every(Boolean)) return f.thumbOut ? null : 'B';
  if (ext[0] && ext[1] && ext[2] && !ext[3]) return 'W';
  if (!ext[0] && ext[1] && ext[2] && ext[3]) return 'F';
  void touch;

  // index + middle up (middle may lean forward for K / P)
  if (ext[0] && f.straight[1] > 0.85 && M !== 'curl' && f.straight[2] < 0.8 && f.straight[3] < 0.8) {
    // crossed fingers: index tip ends up on the pinky side of the middle tip
    const up = norm(sub(world[9], world[WRIST]));
    let side = sub(world[5], world[17]);
    side = norm(sub(side, { x: up.x * dot(side, up), y: up.y * dot(side, up), z: up.z * dot(side, up) }));
    if (dot(sub(world[8], world[12]), side) < -0.004) return 'R';
    if (f.thumb.ty > 0.95 && f.thumb.sx > 0.55 && f.thumb.sx < 1.15) return 'K';
    return f.spread > 20 ? 'V' : 'U';
  }

  if (ext[0] && curled[1] && curled[2] && curled[3]) return f.thumbOut ? 'L' : 'D';
  if (f.hook && R === 'curl' && P === 'curl' && f.indexTipY > 1.15) return 'X';
  if (ext[3] && curled[0] && curled[1] && curled[2]) return f.thumbOut ? 'Y' : 'I';

  // rounded shapes: fingers bent but not closed into a fist
  const mean = f.straight.reduce((a, b) => a + b, 0) / 4;
  if (!f.state.includes('curl') && !ext.some(Boolean) && mean > 0.6) {
    const gap = dist(world[TH.tip], world[8]) / f.palm;
    if (gap < 0.55) return 'O';
    if (gap < 1.3) return 'C';
  }

  // fist family: tell apart by where the thumb tip is
  if (curled.every(Boolean)) {
    const { sx, ty } = f.thumb;
    if (sx > 1.0 && ty > 0.5) return 'A';
    if (I === 'curl' && ty < 0.55 && f.straight[0] > 0.45 && dist(world[8], world[TH.tip]) / f.palm < 0.55) return 'E';
    if (ty > 0.75) {
      if (sx > 0.72) return 'T';
      if (sx > 0.42) return 'N';
      return 'M';
    }
    return 'S';
  }
  return null;
}
