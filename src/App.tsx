import { useEffect, useState } from 'react';
import { Stage } from './three/Stage';
import { MenuBar } from './MenuBar';
import { Wave } from './Wave';
import { SignCamera } from './recognize/SignCamera';
import { useStore } from './store';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';

/**
 * Recording mode for clean screen captures: open the site with #record
 * (or #record=Your phrase). Only the signer is shown, the cursor is hidden,
 * and the phrase plays 1.5 s after the model loads. Click anywhere to replay.
 */
function RecordView() {
  const phrase = decodeURIComponent(location.hash.split('=')[1] ?? '') || 'Hello, nice to meet you';
  const { tokens, current, modelReady, sign } = useStore();
  const tok = current >= 0 ? tokens[current] : null;

  useEffect(() => {
    if (!modelReady) return;
    const t = setTimeout(() => sign(phrase, false), 1500);
    return () => clearTimeout(t);
  }, [modelReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="record" onClick={() => sign(phrase, false)}>
      <Stage />
      {tok && tok.kind !== 'pause' && <div className="letter">{tok.label}</div>}
    </div>
  );
}

export default function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onHash = () => setHash(location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash.startsWith('#record') ? <RecordView /> : <MainView />;
}

function MainView() {
  const [mode, setMode] = useState<'speak' | 'sign'>('speak');
  const [text, setText] = useState('');
  const [toast, setToast] = useState('');
  const { playing, tokens, words, current, sign, enqueue, stop, set } = useStore();
  const mic = useSpeechRecognition(enqueue, 'en-US');
  const tok = current >= 0 ? tokens[current] : null;
  const progress = playing && tokens.length ? (current + 1) / tokens.length : 0;

  const submit = () => {
    if (!text.trim()) return;
    sign(text);
    setText('');
  };

  const clear = () => {
    stop();
    set({ words: [], tokens: [] });
  };

  const share = async () => {
    const url = location.href.split('#')[0];
    try {
      await navigator.clipboard.writeText(url);
      setToast('Link copied');
    } catch {
      setToast(url);
    }
    setTimeout(() => setToast(''), 2200);
  };

  return (
    <div className="screen">
      <Stage />

      <div className="top-left">
        <MenuBar />
      </div>
      <button className="close" onClick={clear} title="Stop and clear">
        ✕
      </button>

      {/* caption: the sentence, with the word and letter being signed highlighted */}
      <div className="caption">
        {words.map((w, i) => (
          <span key={i} className={tok?.wordIndex === i ? 'on' : ''}>
            {w.kind === 'spelled' && tok?.wordIndex === i && tok.kind === 'letter'
              ? [...w.text].map((c, ci) => (
                  <b key={ci} className={ci === tok.charIndex ? 'cur' : ''}>
                    {c}
                  </b>
                ))
              : w.text}
          </span>
        ))}
      </div>

      <Wave listening={mic.listening} />

      {mode === 'sign' ? (
        <SignCamera onSignBack={(t) => sign(t)} tabs={<ModeTabs mode={mode} setMode={setMode} />} />
      ) : (
        <div className="panel">
          <ModeTabs mode={mode} setMode={setMode} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={mic.listening ? mic.interim || 'Listening…' : 'Type your message…'}
        />
        <div className="track">
          <i style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="panel-row">
          <span className="hint">{mic.error ? 'Voice needs Chrome or Edge (HTTPS). Typing works everywhere.' : playing ? 'Signing…' : 'Press Enter or tap the mic'}</span>
          <button className={`mic ${mic.listening ? 'live' : ''}`} onClick={mic.listening ? mic.stop : mic.start} title={mic.listening ? 'Stop listening' : 'Speak'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
          <button className="icon" onClick={share} title="Copy link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
          </button>
        </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function ModeTabs({ mode, setMode }: { mode: 'speak' | 'sign'; setMode: (m: 'speak' | 'sign') => void }) {
  return (
    <div className="modes">
      <button className={mode === 'speak' ? 'on' : ''} onClick={() => setMode('speak')}>
        🗣️ Speak → Sign
      </button>
      <button className={mode === 'sign' ? 'on' : ''} onClick={() => setMode('sign')}>
        🤟 Sign → Text
      </button>
    </div>
  );
}
