import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal typings for the Web Speech API (not in TypeScript's DOM lib everywhere)
interface SRAlternative {
  transcript: string;
}
interface SRResult {
  isFinal: boolean;
  0: SRAlternative;
}
interface SREvent {
  resultIndex: number;
  results: ArrayLike<SRResult>;
}
interface SRErrorEvent {
  error: string;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onresult: ((e: SREvent) => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export type MicError = 'unsupported' | 'blocked' | string | null;

/**
 * Continuous speech recognition. Calls `onFinal` with each finished phrase and
 * restarts itself after silence until `stop()` is called.
 */
export function useSpeechRecognition(onFinal: (text: string) => void, lang: string) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<MicError>(null);
  const recRef = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const cb = useRef(onFinal);
  cb.current = onFinal;
  const supported = !!getCtor();

  const stop = useCallback(() => {
    wanted.current = false;
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError('unsupported');
      return;
    }
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => {
      setListening(true);
      setError(null);
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
      if (wanted.current) {
        try {
          rec.start();
        } catch {
          /* already starting */
        }
      }
    };
    rec.onerror = (e) => {
      if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) {
        wanted.current = false;
        setError('blocked');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError(e.error);
      }
    };
    rec.onresult = (ev) => {
      let partial = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) {
          const t = r[0].transcript.trim();
          if (t) cb.current(t);
        } else {
          partial += r[0].transcript;
        }
      }
      setInterim(partial);
    };
    recRef.current = rec;
    wanted.current = true;
    try {
      rec.start();
    } catch {
      wanted.current = false;
      setError('blocked');
    }
  }, [lang]);

  useEffect(
    () => () => {
      wanted.current = false;
      recRef.current?.abort();
    },
    [],
  );

  return { supported, listening, interim, error, start, stop };
}
