// Wraps a .glb as base64 JSON so it can be served by hosts that only allow text/web file types.
// Usage: node scripts/pack-model.mjs input.glb public/models/name.json
import fs from 'node:fs';
const [, , src, dst] = process.argv;
if (!src || !dst) {
  console.error('Usage: node scripts/pack-model.mjs input.glb output.json');
  process.exit(1);
}
fs.writeFileSync(dst, JSON.stringify({ format: 'glb-base64', glb: fs.readFileSync(src).toString('base64') }));
console.log(`Packed ${src} → ${dst}`);
