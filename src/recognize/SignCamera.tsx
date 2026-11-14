import type { ReactNode } from 'react';
import { useSignRecognizer } from './useSignRecognizer';

/** "Sign → Text": the user fingerspells to the webcam and the letters are typed out. */
export function SignCamera({ onSignBack, tabs }: { onSignBack: (text: string) => void; tabs: ReactNode }) {
  const r = useSignRecognizer(true);

  const speak = () => {
    if (!r.text.trim() || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(r.text.toLowerCase()));
  };

  return (
    <>
      <div className="cam">
        <video ref={r.video} playsInline muted />
        <canvas ref={r.canvas} width={640} height={480} />
        {r.status === 'loading' && <div className="cam-msg">Starting camera and hand tracking…</div>}
        {r.status === 'error' && <div className="cam-msg err">{r.error}</div>}
        {r.status === 'ready' && <div className="fps">{r.fps} fps</div>}
        {r.status === 'ready' && (
          <div className="guess">
            <svg viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" className="ring-bg" />
              <circle cx="18" cy="18" r="16" className="ring" style={{ strokeDashoffset: 100.5 * (1 - r.hold) }} />
            </svg>
            <span>{r.guess === 'ILY' ? '🤟' : r.guess ?? '–'}</span>
          </div>
        )}
      </div>

      <div className="panel">
        {tabs}
        <div className="out" aria-live="polite">
          {r.text || <span className="placeholder">Fingerspell to your camera. Hold each letter until the ring fills.</span>}
          <i className="caret" />
        </div>
        <div className="actions">
          <button onClick={r.space}>Space</button>
          <button onClick={r.backspace}>⌫</button>
          <button onClick={r.clear}>Clear</button>
          <button onClick={speak} disabled={!r.text.trim()}>
            🔊 Say it
          </button>
          <button className="primary" onClick={() => onSignBack(r.text)} disabled={!r.text.trim()}>
            Sign it back
          </button>
        </div>
        <p className="tip">Works for still letters (not J or Z). Good light, one hand, palm facing the camera. Lower your hand to add a space.</p>
      </div>
    </>
  );
}
