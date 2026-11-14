// Copies the MediaPipe Hands runtime + models into public/ so the site hosts them itself
// (no CDN, and camera frames never leave the browser).
import fs from 'node:fs';
const src = 'node_modules/@mediapipe/hands';
const dst = 'public/mediapipe';
fs.mkdirSync(dst, { recursive: true });
for (const f of fs.readdirSync(src)) {
  if (/\.(js|wasm|data|tflite|binarypb)$/.test(f)) fs.copyFileSync(`${src}/${f}`, `${dst}/${f}`);
}
console.log('MediaPipe Hands files copied to public/mediapipe');
