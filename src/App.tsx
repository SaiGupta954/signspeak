import { useState } from 'react';
import { Stage } from './three/Stage';
import { MenuBar } from './MenuBar';
import { useStore } from './store';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';

export default function App() {
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
