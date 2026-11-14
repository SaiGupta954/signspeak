import { create } from 'zustand';
import { driver } from './sign/driver';
import { sequence } from './sign/sequencer';
import type { DisplayWord, Expression, Token } from './sign/types';

export type View = 'front' | 'side' | 'hand';

interface State {
  playing: boolean;
  tokens: Token[];
  words: DisplayWord[];
  current: number;
  expression: Expression;
  queue: string[];
  // settings (menu bar)
  speed: number;
  useWordSigns: boolean;
  view: View;
  history: string[];
  customModel: string | null;
  modelError: string | null;
  modelReady: boolean;

  sign: (text: string, save?: boolean) => void;
  enqueue: (text: string) => void;
  stop: () => void;
  set: (s: Partial<State>) => void;
}

export const useStore = create<State>()((set, get) => ({
  playing: false,
  tokens: [],
  words: [],
  current: -1,
  expression: 'neutral',
  queue: [],
  speed: 1.2,
  useWordSigns: true,
  view: 'front',
  history: [],
  customModel: null,
  modelError: null,
  modelReady: false,

  sign: (text, save = true) => {
    const seq = sequence(text, get().useWordSigns);
    if (!seq.tokens.length) return;
    set((s) => ({
      playing: true,
      tokens: seq.tokens,
      words: seq.words,
      expression: seq.expression,
      current: -1,
      history: save ? [text, ...s.history.filter((h) => h !== text)].slice(0, 20) : s.history,
    }));
    driver.load(seq.tokens);
  },

  // used by voice input: wait for the current sentence to finish
  enqueue: (text) => {
    if (get().playing) set((s) => ({ queue: [...s.queue, text] }));
    else get().sign(text);
  },

  stop: () => {
    driver.stop();
    set({ playing: false, queue: [], current: -1, expression: 'neutral' });
  },

  set: (s) => set(s),
}));

driver.onToken = (i) => useStore.setState({ current: i });
driver.onDone = () => {
  const [next, ...rest] = useStore.getState().queue;
  useStore.setState({ playing: false, current: -1, expression: 'neutral', queue: rest });
  if (next) setTimeout(() => useStore.getState().sign(next), 250);
};
