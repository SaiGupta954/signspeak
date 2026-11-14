import { useEffect, useRef, useState } from 'react';
import { classify, type Pt } from './classify';
import { LetterTyper } from './typer';

// MediaPipe Hands is loaded as a classic script from /mediapipe (copied there at build time)
interface HandsResults {
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
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load hand tracking'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Downloads the hand-tracking files in the background so Sign → Text opens fast. */
export function prefetchHands() {
  const files = ['hands.js', 'hands_solution_packed_assets_loader.js', 'hands_solution_simd_wasm_bin.js', 'hands_solution_simd_wasm_bin.wasm', 'hands_solution_packed_assets.data', 'hand_landmark_lite.tflite', 'hands.binarypb'];
  files.forEach((f) => fetch(BASE + f, { priority: 'low' } as RequestInit).catch(() => {}));
}

export async function createHands(onResults: (r: HandsResults) => void, modelComplexity = 0) {
  const Hands = await loadHands();
  const hands = new Hands({ locateFile: (f) => `${BASE}${f}` });
  // the "lite" model (complexity 0) is ~2x faster and accurate enough for fingerspelling
  hands.setOptions({ maxNumHands: 1, modelComplexity, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
  hands.onResults(onResults);
  await hands.initialize();
  return hands;
}

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

export type CamStatus = 'off' | 'loading' | 'ready' | 'error';

/** Webcam → hand landmarks → letters → text. */
export function useSignRecognizer(enabled: boolean) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const typer = useRef(new LetterTyper());
  const [status, setStatus] = useState<CamStatus>('off');
  const [error, setError] = useState('');
  const [guess, setGuess] = useState<string | null>(null);
  const [hold, setHold] = useState(0);
  const [text, setText] = useState('');
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let stream: MediaStream | null = null;
    let hands: HandsApi | null = null;
    let raf = 0;
    let busy = false;
    let alive = true;
    let frames = 0;
    let fpsStart = performance.now();
    setStatus('loading');
    setError('');

    const onResults = (r: HandsResults) => {
      if (!alive) return;
      const now = performance.now();
      const lm = r.multiHandLandmarks?.[0];
      const wl = r.multiHandWorldLandmarks?.[0];

      const c = canvas.current;
      if (c) {
        const ctx = c.getContext('2d')!;
        ctx.clearRect(0, 0, c.width, c.height);
        if (lm) {
          ctx.strokeStyle = 'rgba(34,211,238,0.9)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (const [a, b] of BONES) {
            ctx.moveTo(lm[a].x * c.width, lm[a].y * c.height);
            ctx.lineTo(lm[b].x * c.width, lm[b].y * c.height);
          }
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          for (const p of lm) ctx.fillRect(p.x * c.width - 2.5, p.y * c.height - 2.5, 5, 5);
        }
      }

      const label = lm && wl ? classify(wl, lm) : null;
      const before = typer.current.text;
      const progress = typer.current.update(label, !!lm, now);
      // only re-render React when something visible changed
      setGuess((g) => (g === label ? g : label));
      setHold((h) => {
        const q = Math.round(progress * 20) / 20;
        return h === q ? h : q;
      });
      if (typer.current.text !== before) setText(typer.current.text);

      frames++;
      if (now - fpsStart > 1000) {
        setFps(Math.round((frames * 1000) / (now - fpsStart)));
        frames = 0;
        fpsStart = now;
      }
    };

    (async () => {
      try {
        // start the camera and load hand tracking at the same time
        const [s, h] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 30 } }, audio: false }),
          createHands(onResults),
        ]);
        stream = s;
        hands = h;
        if (!alive) {
          s.getTracks().forEach((t) => t.stop());
          h.close().catch(() => {});
          return;
        }
        const v = video.current!;
        v.srcObject = s;
        await v.play();
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
        if (!alive) return;
        const name = (e as Error).name;
        const msg =
          name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the camera in your browser and try again.'
            : name === 'NotFoundError'
              ? 'No camera was found on this device.'
              : (e as Error).message || 'Could not start the camera.';
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
  }, [enabled]);

  const sync = () => setText(typer.current.text);
  return {
    video,
    canvas,
    status,
    error,
    guess,
    hold,
    text,
    fps,
    space: () => (typer.current.space(), sync()),
    backspace: () => (typer.current.backspace(), sync()),
    clear: () => (typer.current.clear(), sync()),
  };
}
