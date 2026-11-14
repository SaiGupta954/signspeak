import { useEffect, useState } from 'react';
import { Stage } from './three/Stage';
import { MenuBar } from './MenuBar';
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
  const [text, setText] = useState('');
  const { playing, tokens, words, current, sign, enqueue, stop } = useStore();
  const mic = useSpeechRecognition(enqueue, 'en-US');
  const tok = current >= 0 ? tokens[current] : null;

  const submit = () => {
    if (!text.trim()) return;
    sign(text);
    setText('');
  };

  return (
    <div className="app">
      <header>
        <h1>🤟 SignSpeak</h1>
        <MenuBar />
      </header>
      <p className="sub">Speak or type, and she signs it in ASL.</p>

      <div className="stage">
        <Stage />
        {tok && tok.kind !== 'pause' && <div className="letter">{tok.label}</div>}
      </div>

      <div className="words">
        {words.map((w, i) => (
          <span key={i} className={tok?.wordIndex === i ? 'on' : ''}>
            {w.text}
          </span>
        ))}
      </div>

      <div className="controls">
        <button className={`mic ${mic.listening ? 'live' : ''}`} onClick={mic.listening ? mic.stop : mic.start} title="Speak">
          🎤
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={mic.listening ? 'Listening… ' + mic.interim : 'Type something, e.g. Hello'}
        />
        <button onClick={submit}>Sign</button>
        {playing && <button onClick={stop}>Stop</button>}
      </div>

      {mic.error && (
        <p className="note">
          {mic.error === 'unsupported' || mic.error === 'blocked'
            ? 'Voice needs Chrome or Edge on localhost. Typing works everywhere.'
            : `Mic error: ${mic.error}`}
        </p>
      )}
    </div>
  );
}
