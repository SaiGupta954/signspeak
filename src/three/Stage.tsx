import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { HumanAvatar } from './HumanAvatar';
import { useStore, type View } from '../store';

const MODEL_URL = `${import.meta.env.BASE_URL}models/michelle.json`;

const VIEWS: Record<View, { pos: [number, number, number]; target: [number, number, number] }> = {
  front: { pos: [0, 1.32, 2.75], target: [-0.03, 1.2, 0] },
  side: { pos: [-1.6, 1.48, 1.2], target: [-0.1, 1.38, 0.1] },
  hand: { pos: [-0.38, 1.47, 1.08], target: [-0.2, 1.42, 0.27] },
};

/** Smoothly moves the camera when the View menu changes. */
function Camera() {
  const view = useStore((s) => s.view);
  const controls = useRef<OrbitControlsImpl>(null);
  const moving = useRef(true);
  const { camera } = useThree();
  const goalPos = useRef(new THREE.Vector3());
  const goalTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    goalPos.current.set(...VIEWS[view].pos);
    goalTarget.current.set(...VIEWS[view].target);
    moving.current = true;
  }, [view]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!moving.current || !c) return;
    const k = 1 - Math.exp(-dt * 4);
    camera.position.lerp(goalPos.current, k);
    c.target.lerp(goalTarget.current, k);
    c.update();
    if (camera.position.distanceTo(goalPos.current) < 0.003 && c.target.distanceTo(goalTarget.current) < 0.003) moving.current = false;
  });

  return <OrbitControls ref={controls} enablePan={false} minDistance={0.5} maxDistance={3.5} onStart={() => (moving.current = false)} />;
}

export function Stage() {
  const customModel = useStore((s) => s.customModel);
  const url = customModel ?? MODEL_URL;
  return (
    <Canvas shadows="percentage" camera={{ position: VIEWS.front.pos, fov: 30 }} onCreated={({ camera }) => camera.lookAt(...VIEWS.front.target)}>
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={4.5} position={[-1.5, 2.2, 3]} scale={[3, 2, 1]} target={[0, 1.4, 0]} />
        <Lightformer form="rect" intensity={1.6} position={[3, 1.8, 2]} scale={[2, 3, 1]} target={[0, 1.4, 0]} color="#ffe4d0" />
        <Lightformer form="ring" intensity={2.2} position={[1.5, 2.2, -3]} scale={2} target={[0, 1.4, 0]} color="#9fb6ff" />
      </Environment>
      <hemisphereLight args={['#f1f4ff', '#40324a', 0.8]} />
      <directionalLight position={[-1.2, 2.6, 3.2]} intensity={2.6} castShadow shadow-mapSize={[2048, 2048]} shadow-normalBias={0.02} />
      <spotLight position={[0.2, 1.9, 1.6]} angle={0.5} penumbra={0.8} intensity={6} distance={4} color="#ffe9dc" target-position={[0, 1.45, 0]} />
      <Suspense fallback={null}>
        <HumanAvatar key={url} url={url} />
      </Suspense>
      <Camera />
    </Canvas>
  );
}
