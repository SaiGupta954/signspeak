import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * GLTFLoader that also accepts a .json wrapper ({ glb: "<base64>" }, see scripts/pack-model.mjs)
 * and loads textures through <img> instead of fetch, so models work in strict sandboxes.
 */
export class AvatarLoader extends GLTFLoader {
  constructor(manager?: THREE.LoadingManager) {
    super(manager);
    this.register((parser) => {
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
      return { name: 'img-textures' };
    });
  }

  load(url: string, onLoad: (gltf: GLTF) => void, onProgress?: (e: ProgressEvent) => void, onError?: (err: unknown) => void) {
    if (!/\.json(\?|$)/i.test(url)) {
      super.load(url, onLoad, onProgress, onError);
      return;
    }
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`);
        return r.json() as Promise<{ glb: string }>;
      })
      .then(({ glb }) => {
        const bin = atob(glb);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        this.parse(bytes.buffer, '', onLoad, onError);
      })
      .catch((e) => (onError ? onError(e) : console.error(e)));
  }
}
