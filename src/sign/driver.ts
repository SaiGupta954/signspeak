import { REST } from './handshapes';
import { clonePose, copyPose, ease, mixPose, withPose } from './pose';
import type { HandPose, Keyframe, Token } from './types';

interface Frame {
  kf: Keyframe;
  token: number;
}

/**
 * Framework-free animation engine. The 3D scene calls `tick()` every frame and
 * gets back the hand pose to draw; React only hears about token changes.
 */
export class SignDriver {
  private frames: Frame[] = [];
  private fi = -1;
  private elapsed = 0;
  private restT = 1;
  private from = clonePose(REST);
  private target = clonePose(REST);
  private lastPose = clonePose(REST);
  readonly cur = clonePose(REST);

  playing = false;
  paused = false;
  currentToken = -1;

  onToken?: (index: number) => void;
  onDone?: () => void;

  load(tokens: Token[]) {
    this.frames = [];
    let prev: HandPose = this.cur;
    tokens.forEach((tok, ti) => {
      if (tok.kind === 'pause') {
        // drop the hand slightly between words
        this.frames.push({ kf: { pose: withPose(prev, { pos: { y: prev.pos.y - 0.18 } }), dur: 0.55 }, token: ti });
        return;
      }
      tok.frames.forEach((kf) => {
        this.frames.push({ kf, token: ti });
        prev = kf.pose;
      });
    });
    this.fi = -1;
    this.currentToken = -1;
    this.playing = this.frames.length > 0;
    this.paused = false;
    if (this.playing) this.next();
  }

  pause() {
    if (this.playing) this.paused = true;
  }
  resume() {
    this.paused = false;
  }

  stop() {
    this.playing = false;
    this.paused = false;
    this.frames = [];
    this.currentToken = -1;
    this.from = clonePose(this.cur);
    this.restT = 0;
  }

  private next() {
    this.fi++;
    if (this.fi >= this.frames.length) {
      this.playing = false;
      this.from = clonePose(this.cur);
      this.restT = 0;
      this.currentToken = -1;
      this.onDone?.();
      return;
    }
    const fr = this.frames[this.fi];
    this.from = clonePose(this.cur);
    this.target = fr.kf.pose;
    this.elapsed = 0;
    if (fr.token !== this.currentToken) {
      this.currentToken = fr.token;
      this.onToken?.(fr.token);
    }
  }

  /** Advance by dt milliseconds. `speed` is letters per second. */
  tick(dtMs: number, speed: number): HandPose {
    const dt = Math.min(dtMs, 250); // keep pace on slow machines, but don't jump after a tab switch
    if (this.playing && !this.paused) {
      this.elapsed += dt;
      const fr = this.frames[this.fi];
      const D = (fr.kf.dur * 1000) / speed;
      const tr = Math.min(D * 0.4, 300);
      if (this.elapsed < tr) {
        mixPose(this.from, this.target, ease(this.elapsed / tr), this.cur);
      } else {
        copyPose(this.target, this.cur);
        fr.kf.motion?.((this.elapsed - tr) / Math.max(1, D - tr - 60), this.cur);
      }
      if (this.elapsed >= D) this.next();
    } else if (!this.playing) {
      this.restT = Math.min(1, this.restT + dt / 650);
      mixPose(this.from, REST, ease(this.restT), this.cur);
    }
    copyPose(this.cur, this.lastPose);
    return this.cur;
  }
}

export const driver = new SignDriver();
