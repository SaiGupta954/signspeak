import { useEffect, useRef, useState } from 'react';
import { useStore, type View } from './store';

const MENUS = ['View', 'Settings', 'Alphabet', 'History', 'Avatar', 'Help'] as const;
type Menu = (typeof MENUS)[number];

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
const VIEWS: { id: View; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side angle' },
  { id: 'hand', label: 'Hand close-up' },
];

export function MenuBar() {
  const [open, setOpen] = useState<Menu | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const { view, speed, useWordSigns, history, customModel, modelError, sign, set } = useStore();

  // close when clicking outside the menu bar
  useEffect(() => {
    const close = (e: MouseEvent) => !bar.current?.contains(e.target as Node) && setOpen(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const loadModel = (file?: File) => {
    if (!file) return;
    if (customModel) URL.revokeObjectURL(customModel);
    set({ customModel: URL.createObjectURL(file), modelError: null });
  };

  return (
    <div className="menubar" ref={bar}>
      {MENUS.map((m) => (
        <div key={m} className="menu">
          <button className={open === m ? 'on' : ''} onClick={() => setOpen(open === m ? null : m)}>
            {m}
          </button>

          {open === m && (
            <div className="dropdown">
              {m === 'View' &&
                VIEWS.map((v) => (
                  <button key={v.id} className={`item ${view === v.id ? 'checked' : ''}`} onClick={() => (set({ view: v.id }), setOpen(null))}>
                    {v.label}
                  </button>
                ))}

              {m === 'Settings' && (
                <>
                  <label className="row">
                    Speed <b>{speed.toFixed(1)}×</b>
                    <input type="range" min={0.5} max={2.5} step={0.1} value={speed} onChange={(e) => set({ speed: +e.target.value })} />
                  </label>
                  <label className="row check">
                    <input type="checkbox" checked={useWordSigns} onChange={(e) => set({ useWordSigns: e.target.checked })} />
                    Use word signs (HELLO, THANK YOU…)
                  </label>
                </>
              )}

              {m === 'Alphabet' && (
                <div className="grid">
                  {CHARS.map((c) => (
                    <button key={c} onClick={() => sign(c, false)}>
                      {c}
                    </button>
                  ))}
                </div>
              )}

              {m === 'History' &&
                (history.length ? (
                  <>
                    {history.map((h) => (
                      <button key={h} className="item" onClick={() => (sign(h, false), setOpen(null))}>
                        ▶ {h}
                      </button>
                    ))}
                    <button className="item muted" onClick={() => set({ history: [] })}>
                      Clear history
                    </button>
                  </>
                ) : (
                  <p className="muted">Nothing signed yet.</p>
                ))}

              {m === 'Avatar' && (
                <>
                  <button className={`item ${!customModel ? 'checked' : ''}`} onClick={() => set({ customModel: null, modelError: null })}>
                    Michelle (built-in)
                  </button>
                  <label className="item upload">
                    Load my own avatar (.glb)…
                    <input type="file" accept=".glb,.gltf" onChange={(e) => loadModel(e.target.files?.[0])} />
                  </label>
                  <p className="muted">Needs a Mixamo-style rig with finger bones.</p>
                  {modelError && <p className="error">{modelError}</p>}
                </>
              )}

              {m === 'Help' && (
                <div className="help">
                  <p>
                    <b>🎤</b> Speak, and each sentence is signed when you finish it.
                  </p>
                  <p>
                    <b>Type</b> a sentence and press Enter.
                  </p>
                  <p>Drag the 3D view to look around.</p>
                  <p className="muted">Voice needs Chrome or Edge on localhost. Handshapes are simplified, so this is a learning tool, not a full translator.</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
