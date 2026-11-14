import { useCallback, useEffect, useRef, useState } from 'react';
import { classify, type Pt } from './classify';

// MediaPipe Hands is loaded as a classic script from /mediapipe (copied there at build time)
interface HandsResults {
  image: CanvasImageSource;
  multiHandLandmarks?: Pt[][];
  multiHandWorldLandmarks?: Pt[][];
}
interface HandsApi {
  setOptions(o: Record<string, unknown>): void;
  onResults(cb: (r: HandsResults) => void): void;
  initialize(): Promise<void>;
  send(i: { image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement }): Promise<void>;
  close(): Promise<void>;
}
type HandsCtor = new (o: { locateFile: (f: string) => string }) => HandsApi;

const BASE = `${import.meta.env.BASE_URL}mediapipe/`;
let scriptPromise: Promise<HandsCtor> | null = null;
function loadHands(): Promise<HandsCtor> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${BASE}hands.js`;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve((window as unknown as { Hands: HandsCtor }).Hands);
    s.onerror = () => reject(new Error('Could not load hand tracking'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export async function createHands(onResults: (r: HandsResults) => void) {
  const Hands = await loadHands();
  const hands = new Hands({ locateFile: (f) => `${BASE}${f}` });
  hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
  hands.onResults(onResults);
  await hands.initialize();
  return hands;
}

// connections for drawing the hand skeleton
const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const HOLD_MS = 700; // hold a letter this long to type it
const REPEAT_MS = 1600; // keep holding to type it again
const SPACE_MS = 1300; // hand out of view this long adds a space

export type CamStatus = 'off' | 'loading' | 'ready' | 'error';

/** Webcam → hand landmarks → letters → text. */
export function useSignRecognizer(enabled: boolean) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<CamStatus>('off');
  const [error, setError] = useState('');
  const [guess, setGuess] = useState<string | null>(null);
  const [hold, setHold] = useState(0); // 0..1 progress toward typing the current guess
  const [text, setText] = useState('');

  const st = useRef({ label: null as string | null, since: 0, committedAt: 0, lastHand: 0 });

  const append = useCallback((s: string) => setText((t) => t + s), []);

  useEffect(() => {
    if (!enabled) return;
    let stream: MediaStream | null = null;
    let hands: HandsApi | null = null;
    let raf = 0;
    let busy = false;
    let alive = true;
    setStatus('loading');
    setError('');

    const onResults = (r: HandsResults) => {
      const now = performance.now();
      const c = canvas.current;
      const lm = r.multiHandLandmarks?.[0];
      const wl = r.multiHandWorldLandmarks?.[0];
      if (c) {
        const ctx = c.getContext('2d')!;
        ctx.clearRect(0, 0, c.width, c.height);
        if (lm) {
          ctx.strokeStyle = 'rgba(34,211,238,0.9)';
          ctx.lineWidth = 3;
          for (const [a, b] of BONES) {
            ctx.beginPath();
            ctx.moveTo(lm[a].x * c.width, lm[a].y * c.height);
            ctx.lineTo(lm[b].x * c.width, lm[b].y * c.height);
            ctx.stroke();
          }
          ctx.fillStyle = '#ffffff';
          for (const p of lm) {
            ctx.beginPath();
            ctx.arc(p.x * c.width, p.y * c.height, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      const s = st.current;
      if (!lm || !wl) {
        setGuess(null);
        setHold(0);
        s.label = null;
        if (s.lastHand && now - s.lastHand > SPACE_MS) {
          setText((t) => (t && !t.endsWith(' ') ? t + ' ' : t));
          s.lastHand = 0;
        }
        return;
      }
      s.lastHand = now;
      const label = classify(wl, lm);
      setGuess(label);
      if (label !== s.label) {
        s.label = label;
        s.since = now;
        s.committedAt = 0;
        setHold(0);
        return;
      }
      if (!label) return;
      const wait = s.committedAt ? REPEAT_MS : HOLD_MS;
      const from = s.committedAt || s.since;
      setHold(Math.min(1, (now - from) / wait));
      if (now - from >= wait) {
        append(label === 'ILY' ? 'I LOVE YOU ' : label);
        s.committedAt = now;
        setHold(0);
      }
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
        if (!alive) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        hands = await createHands(onResults);
        if (!alive) return;
        setStatus('ready');
        const loop = async () => {
          if (!alive) return;
          if (!busy && v.readyState >= 2 && hands) {
            busy = true;
            try {
              await hands.send({ image: v });
            } catch {
              /* skip frame */
            }
            busy = false;
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        const msg = (e as Error).name === 'NotAllowedError' ? 'Camera access was blocked. Allow the camera in your browser and try again.' : (e as Error).message || 'Could not start the camera.';
        setError(msg);
        setStatus('error');
      }
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      hands?.close().catch(() => {});
      setStatus('off');
      setGuess(null);
      setHold(0);
    };
  }, [enabled, append]);

  return {
    video,
    canvas,
    status,
    error,
    guess,
    hold,
    text,
    space: () => append(' '),
    backspace: () => setText((t) => t.slice(0, -1)),
    clear: () => setText(''),
  };
}
