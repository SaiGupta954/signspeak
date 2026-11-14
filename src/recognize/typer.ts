/**
 * Hold-to-type logic, kept separate from the camera so it can be tested.
 * Feed it one label per camera frame (null = no letter / no hand).
 */
export const HOLD_MS = 650; // hold a letter this long to type it
export const REPEAT_MS = 1500; // keep holding to type it again
export const SPACE_MS = 1200; // hand out of view this long adds a space

export class LetterTyper {
  text = '';
  private label: string | null = null;
  private since = 0;
  private committedAt = 0;
  private lastHand = 0;

  /** Returns progress 0..1 toward typing the current label. */
  update(label: string | null, handVisible: boolean, now: number): number {
    if (!handVisible) {
      this.label = null;
      if (this.lastHand && now - this.lastHand > SPACE_MS) {
        if (this.text && !this.text.endsWith(' ')) this.text += ' ';
        this.lastHand = 0;
      }
      return 0;
    }
    this.lastHand = now;
    if (label !== this.label) {
      this.label = label;
      this.since = now;
      this.committedAt = 0;
      return 0;
    }
    if (!label) return 0;
    const from = this.committedAt || this.since;
    const wait = this.committedAt ? REPEAT_MS : HOLD_MS;
    if (now - from >= wait) {
      this.text += label === 'ILY' ? (this.text && !this.text.endsWith(' ') ? ' ' : '') + 'I LOVE YOU ' : label;
      this.committedAt = now;
      return 0;
    }
    return Math.min(1, (now - from) / wait);
  }

  space() {
    this.text += ' ';
  }
  backspace() {
    this.text = this.text.slice(0, -1);
  }
  clear() {
    this.text = '';
  }
}
