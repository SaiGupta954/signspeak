import * as THREE from 'three';
import type { Expression, HandPose } from '../sign/types';

const DEG = Math.PI / 180;
const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'] as const;

/** "mixamorig:RightHand", "mixamorig1RightHand", "RightHand" → "RightHand" */
const clean = (n: string) => (n.split(':').pop() ?? n).replace(/^mixamorig\d*_?/i, '');

// scratch
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const q3 = new THREE.Quaternion();
const e1 = new THREE.Euler();
const IDENT = new THREE.Quaternion();

/** Rotate `bone` (in world space) so the direction bone → child points along `dirW`. */
function aim(bone: THREE.Object3D, child: THREE.Object3D, dirW: THREE.Vector3) {
  bone.updateMatrixWorld(true);
  const from = bone.getWorldPosition(v1);
  const to = child.getWorldPosition(v2);
  const cur = to.sub(from).normalize();
  q1.setFromUnitVectors(cur, v3.copy(dirW).normalize());
  bone.getWorldQuaternion(q2);
  q2.premultiply(q1); // new world rotation
  bone.parent!.getWorldQuaternion(q3).invert();
  bone.quaternion.copy(q3.multiply(q2));
  bone.updateMatrixWorld(true);
}

/** Set a bone's world rotation. */
function setWorldQuat(bone: THREE.Object3D, worldQ: THREE.Quaternion) {
  bone.parent!.getWorldQuaternion(q3).invert();
  bone.quaternion.copy(q3.multiply(worldQ));
  bone.updateMatrixWorld(true);
}

/** Two-bone IK: returns the elbow position for shoulder S, wrist target W and a pole direction. */
function solveElbow(S: THREE.Vector3, W: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3, out: THREE.Vector3) {
  const dir = v1.subVectors(W, S);
  const d = Math.min(Math.max(dir.length(), 1e-4), (l1 + l2) * 0.999);
  dir.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const p = v2.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
  return out.copy(S).addScaledVector(dir, a).addScaledVector(p, h);
}

interface HandRig {
  hand: THREE.Object3D;
  fingers: THREE.Object3D[][]; // [finger][joint 0..2]
  tips: THREE.Object3D[];
  thumb: THREE.Object3D[]; // 4 incl. end
  flexAxis: THREE.Vector3[][]; // bone-local
  spreadAxis: THREE.Vector3[]; // bone-local, at the knuckle
  qOffInv: THREE.Quaternion; // world hand bone rotation = frame * qOffInv
}

export class RigError extends Error {}

/**
 * Drives a Mixamo-compatible humanoid (Mixamo, Ready Player Me, most rigged GLBs)
 * from a HandPose: right arm via two-bone IK, wrist orientation, every finger joint.
 */
export class HumanRig {
  private b = new Map<string, THREE.Object3D>();
  private rest = new Map<THREE.Object3D, THREE.Quaternion>();
  private R: HandRig;
  private L: HandRig;
  private l1: number;
  private l2: number;
  private ll1: number;
  private ll2: number;
  private W0 = new THREE.Vector3();
  private LW = new THREE.Vector3();
  private k: number; // world metres per pose unit
  private axes = new Map<THREE.Object3D, { x: THREE.Vector3; y: THREE.Vector3; z: THREE.Vector3 }>();
  private wrist = new THREE.Vector3();
  private elbow = new THREE.Vector3();
  private frame = new THREE.Quaternion();

  constructor(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if ((o as THREE.Bone).isBone || /mixamorig|Hand|Arm|Head|Spine/i.test(o.name)) {
        const n = clean(o.name);
        if (!this.b.has(n)) this.b.set(n, o);
      }
    });
    const need = ['RightArm', 'RightForeArm', 'RightHand', 'RightHandIndex1', 'RightHandMiddle1', 'RightHandPinky1', 'RightHandThumb1', 'LeftArm', 'LeftForeArm', 'LeftHand'];
    const missing = need.filter((n) => !this.b.has(n));
    if (missing.length) throw new RigError(`This model is missing bones: ${missing.join(', ')}. Use a Mixamo or Ready Player Me rig with finger bones.`);

    this.b.forEach((o) => this.rest.set(o, o.quaternion.clone()));

    this.R = this.buildHand('Right');
    this.L = this.buildHand('Left');

    const wp = (n: string) => this.get(n).getWorldPosition(new THREE.Vector3());
    this.l1 = wp('RightArm').distanceTo(wp('RightForeArm'));
    this.l2 = wp('RightForeArm').distanceTo(wp('RightHand'));
    this.ll1 = wp('LeftArm').distanceTo(wp('LeftForeArm'));
    this.ll2 = wp('LeftForeArm').distanceTo(wp('LeftHand'));
    const handLen = wp('RightHand').distanceTo(this.R.tips[1].getWorldPosition(new THREE.Vector3()));
    this.k = handLen / 2.0;

    // where fingerspelling happens: in front of the right shoulder
    const S = wp('RightArm');
    this.W0.copy(S).add(new THREE.Vector3(-0.09, 0.01, 0.3));
    const LS = wp('LeftArm');
    this.LW.copy(LS).add(new THREE.Vector3(0.06, -0.5, 0.1));

    // world-aligned rotation axes for head / spine, expressed in each bone's local frame
    for (const n of ['Head', 'Neck', 'Spine2', 'Spine1']) {
      const o = this.b.get(n);
      if (!o) continue;
      const inv = o.getWorldQuaternion(new THREE.Quaternion()).invert();
      this.axes.set(o, {
        x: new THREE.Vector3(1, 0, 0).applyQuaternion(inv),
        y: new THREE.Vector3(0, 1, 0).applyQuaternion(inv),
        z: new THREE.Vector3(0, 0, 1).applyQuaternion(inv),
      });
    }
  }

  private get(n: string) {
    const o = this.b.get(n);
    if (!o) throw new RigError(`Missing bone ${n}`);
    return o;
  }

  private buildHand(side: 'Right' | 'Left'): HandRig {
    const hand = this.get(`${side}Hand`);
    const opt = (n: string) => this.b.get(n);
    const fingers = FINGERS.map((f) => [1, 2, 3].map((i) => opt(`${side}Hand${f}${i}`)).filter(Boolean) as THREE.Object3D[]);
    const tips = FINGERS.map((f, i) => opt(`${side}Hand${f}4`) ?? fingers[i][fingers[i].length - 1]);
    const thumb = [1, 2, 3, 4].map((i) => opt(`${side}HandThumb${i}`)).filter(Boolean) as THREE.Object3D[];

    const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
    const across = wp(fingers[0][0]).sub(wp(fingers[3][0] ?? fingers[2][0])).normalize();
    const finger = wp(fingers[1][0]).sub(wp(hand)).normalize();
    const palmR = new THREE.Vector3().crossVectors(across, finger).normalize(); // = palm for the right hand
    const fingerOrtho = new THREE.Vector3().crossVectors(palmR, across).normalize();

    const frameQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, fingerOrtho, palmR));
    const handWQ = hand.getWorldQuaternion(new THREE.Quaternion());
    const qOffInv = handWQ.clone().invert().multiply(frameQ).invert();

    const flexW = side === 'Right' ? across : across.clone().negate();
    const flexAxis = fingers.map((chain) =>
      chain.map((bone) => flexW.clone().applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize()),
    );
    const spreadAxis = fingers.map((chain) => palmR.clone().applyQuaternion(chain[0].getWorldQuaternion(new THREE.Quaternion()).invert()).normalize());
    return { hand, fingers, tips, thumb, flexAxis, spreadAxis, qOffInv };
  }

  private restore() {
    this.rest.forEach((q, o) => o.quaternion.copy(q));
  }

  private curl(h: HandRig, f: number[][], s: number[]) {
    h.fingers.forEach((chain, i) => {
      chain.forEach((bone, j) => {
        const r = this.rest.get(bone)!;
        bone.quaternion.copy(r);
        if (j === 0) bone.quaternion.multiply(q1.setFromAxisAngle(h.spreadAxis[i], -s[i] * DEG));
        bone.quaternion.multiply(q1.setFromAxisAngle(h.flexAxis[i][j], f[i][j] * DEG));
      });
    });
  }

  private turn(name: string, pitch: number, yaw: number, roll: number) {
    const o = this.b.get(name);
    const a = o && this.axes.get(o);
    if (!o || !a) return;
    o.quaternion
      .copy(this.rest.get(o)!)
      .multiply(q1.setFromAxisAngle(a.x, pitch))
      .multiply(q1.setFromAxisAngle(a.y, yaw))
      .multiply(q1.setFromAxisAngle(a.z, roll));
  }

  apply(p: HandPose, t: number, expression: Expression, signing: boolean, idle: number) {
    this.restore();

    // ---- body + head ----
    this.turn('Spine1', Math.sin(t * 1.5) * 0.01, 0, 0);
    this.turn('Spine2', 0.02 + Math.sin(t * 1.5) * 0.012, -0.04, 0);
    const pitch = expression === 'yesno' ? 0.14 : expression === 'wh' ? 0.07 : 0;
    const roll = expression === 'wh' ? 0.07 : 0;
    this.turn(
      'Head',
      pitch + (signing ? Math.sin(t * 2.6) * 0.02 : Math.sin(t * 0.6) * 0.015),
      Math.sin(t * 0.45) * 0.05 * idle + (signing ? -0.04 : 0),
      roll + Math.sin(t * 0.7) * 0.015,
    );
    this.turn('Neck', pitch * 0.4, 0, 0);

    const root = this.get('RightArm').parent!;
    root.updateMatrixWorld(true);

    // ---- right arm: IK to the wrist target ----
    const arm = this.get('RightArm');
    const fore = this.get('RightForeArm');
    const hand = this.R.hand;
    this.wrist.set(this.W0.x + p.pos.x * this.k, this.W0.y + p.pos.y * this.k, this.W0.z + p.pos.z * this.k);
    this.wrist.y += Math.sin(t * 1.3) * 0.004 * idle;
    const S = arm.getWorldPosition(new THREE.Vector3());
    solveElbow(S, this.wrist, this.l1, this.l2, v3.set(-0.55, -1, -0.35).normalize(), this.elbow);
    aim(arm, fore, new THREE.Vector3().subVectors(this.elbow, S));
    const E = fore.getWorldPosition(new THREE.Vector3());
    aim(fore, hand, new THREE.Vector3().subVectors(this.wrist, E));

    // ---- wrist orientation (palm toward the viewer, fingers up, plus the pose's rotation) ----
    this.frame.setFromEuler(e1.set(0, 0.16, -0.12)).multiply(q2.setFromEuler(e1.set(p.rot.x * DEG, p.rot.y * DEG, p.rot.z * DEG, 'ZXY')));
    const target = this.frame.clone().multiply(this.R.qOffInv);
    // move half of the forearm twist into the forearm so the wrist doesn't candy-wrap
    fore.getWorldQuaternion(q2).invert();
    const local = q2.multiply(target);
    const twist = new THREE.Quaternion(0, local.y, 0, local.w).normalize();
    fore.quaternion.multiply(new THREE.Quaternion().slerpQuaternions(IDENT, twist, 0.55));
    fore.updateMatrixWorld(true);
    setWorldQuat(hand, target);

    // ---- fingers ----
    this.curl(this.R, p.f, p.s);

    // ---- thumb: aim the first bone, then bend the rest toward the palm ----
    const th = this.R.thumb;
    if (th.length >= 3) {
      const a = p.t.a * DEG;
      const e = p.t.e * DEG;
      const dW = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)).normalize().applyQuaternion(this.frame);
      th[0].quaternion.copy(this.rest.get(th[0])!);
      aim(th[0], th[1], dW);
      const T = new THREE.Vector3(-0.65, 0.35, 0.68).normalize().applyQuaternion(this.frame);
      const axisW = new THREE.Vector3().crossVectors(dW, T);
      if (axisW.lengthSq() < 1e-6) axisW.set(0, 0, 1).applyQuaternion(this.frame);
      axisW.normalize();
      [p.t.j1, p.t.j2].forEach((ang, i) => {
        const bone = th[i + 1];
        if (!bone || i + 2 > th.length) return;
        const inv = bone.getWorldQuaternion(q2).invert();
        const ax = axisW.clone().applyQuaternion(inv).normalize();
        bone.quaternion.copy(this.rest.get(bone)!).multiply(q1.setFromAxisAngle(ax, ang * DEG));
        bone.updateMatrixWorld(true);
      });
    }

    // ---- left arm: relaxed at the side ----
    const la = this.get('LeftArm');
    const lf = this.get('LeftForeArm');
    const LS = la.getWorldPosition(new THREE.Vector3());
    const lw = v1.copy(this.LW);
    lw.y += Math.sin(t * 1.5) * 0.004;
    const lwc = lw.clone();
    const LE = solveElbow(LS, lwc, this.ll1, this.ll2, new THREE.Vector3(0.6, -0.2, -1).normalize(), new THREE.Vector3());
    aim(la, lf, LE.clone().sub(LS));
    aim(lf, this.L.hand, lwc.clone().sub(lf.getWorldPosition(new THREE.Vector3())));
    this.curl(this.L, [[18, 26, 14], [20, 28, 16], [22, 30, 16], [24, 32, 18]], [0, 0, 0, 0]);
  }

  /** Useful anchor points (world) for tuning word signs. */
  debug() {
    const wp = (n: string) => this.b.get(n)?.getWorldPosition(new THREE.Vector3()).toArray().map((x) => +x.toFixed(3));
    return { W0: this.W0.toArray().map((x) => +x.toFixed(3)), k: +this.k.toFixed(4), head: wp('Head'), rArm: wp('RightArm'), neck: wp('Neck') };
  }
}
