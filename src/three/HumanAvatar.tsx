import { useEffect, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { AvatarLoader } from './loader';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { driver } from '../sign/driver';
import { useStore } from '../store';
import { HumanRig } from './rig';

const TARGET_HEIGHT = 1.7; // metres

export function HumanAvatar({ url }: { url: string }) {
  const gltf = useLoader(AvatarLoader, url);

  const { wrapper, rig, error } = useMemo(() => {
    const scene = cloneSkinned(gltf.scene);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          const s = mat as THREE.MeshStandardMaterial;
          if (s.isMeshStandardMaterial) s.envMapIntensity = 1.1;
        });
      }
    });
    // normalise size and stand the model on the floor, centred
    const wrapper = new THREE.Group();
    wrapper.add(scene);
    wrapper.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const s = TARGET_HEIGHT / (size.y || 1);
    wrapper.scale.setScalar(s);
    const c = box.getCenter(new THREE.Vector3());
    wrapper.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    wrapper.updateMatrixWorld(true);
    try {
      const rig = new HumanRig(wrapper);
      return { wrapper, rig, error: null as string | null };
    } catch (e) {
      return { wrapper, rig: null, error: (e as Error).message };
    }
  }, [gltf.scene]);

  useEffect(() => {
    useStore.setState({ modelError: error, modelReady: !!rig });
    if (rig && import.meta.env.DEV) Object.assign(window, { __rig: rig });
  }, [rig, error]);

  useFrame((state, delta) => {
    const { speed, expression } = useStore.getState();
    const p = driver.tick(delta * 1000, speed);
    if (!rig) return;
    const signing = driver.playing && !driver.paused;
    rig.apply(p, state.clock.elapsedTime, expression, signing, driver.playing ? 0 : 1);
  });

  return <primitive object={wrapper} />;
}
