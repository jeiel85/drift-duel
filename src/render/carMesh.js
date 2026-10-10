// Low-poly car built from primitives. Local +x is forward, +z is right.
import * as THREE from 'three';

const WHEEL_X = 1.35;
const WHEEL_Z = 0.95;

export function createCarMesh(spec) {
  const root = new THREE.Group(); // positioned/rotated in the world
  const body = new THREE.Group(); // leans with drift and acceleration
  root.add(body);

  const paint = new THREE.MeshStandardMaterial({ color: spec.color, metalness: 0.4, roughness: 0.35 });
  const trim = new THREE.MeshStandardMaterial({ color: spec.accent, metalness: 0.2, roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1b2433, metalness: 0.6, roughness: 0.15 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.62, 1.95), paint);
  chassis.position.y = 0.7;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 1.85), paint);
  nose.position.set(1.75, 0.95, 0);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 1.6), glass);
  cabin.position.set(-0.35, 1.28, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.5), paint);
  roof.position.set(-0.4, 1.58, 0);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.32, 0.05, 0.4), trim);
  stripe.position.set(0, 1.02, 0);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 1.9), trim);
  wing.position.set(-2.05, 1.38, 0);
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.08), trim);
  wingL.position.set(-2.05, 1.18, -0.7);
  const wingR = wingL.clone();
  wingR.position.z = 0.7;
  for (const m of [chassis, nose, cabin, roof, stripe, wing, wingL, wingR]) {
    m.castShadow = true;
    body.add(m);
  }

  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d5 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1f3d });
  for (const z of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.42), headMat);
    h.position.set(2.31, 0.82, z);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.5), tailMat);
    t.position.set(-2.16, 0.86, z);
    body.add(h, t);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 14);
  wheelGeo.rotateX(Math.PI / 2);
  const tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.8, roughness: 0.3 });
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.38, 8);
  rimGeo.rotateX(Math.PI / 2);
  const wheels = [];
  const steerPivots = [];
  for (const x of [WHEEL_X, -WHEEL_X]) {
    for (const z of [-WHEEL_Z, WHEEL_Z]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.42, z);
      const spin = new THREE.Group();
      const w = new THREE.Mesh(wheelGeo, tire);
      w.castShadow = true;
      spin.add(w, new THREE.Mesh(rimGeo, rim));
      pivot.add(spin);
      root.add(pivot);
      wheels.push(spin);
      if (x > 0) steerPivots.push(pivot);
    }
  }

  // Nitro flames behind the exhausts
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0.85 });
  const flames = [];
  for (const z of [-0.45, 0.45]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.2, 8), flameMat);
    f.rotation.z = Math.PI / 2;
    f.position.set(-2.75, 0.55, z);
    f.visible = false;
    body.add(f);
    flames.push(f);
  }

  let roll = 0;
  let pitch = 0;
  let spinAngle = 0;
  let lastSpeed = 0;

  return {
    object: root,
    /** Rear wheel world positions, used for skid marks and smoke. */
    rearWheels(out) {
      const c = Math.cos(root.rotation.y);
      const s = Math.sin(root.rotation.y);
      // rotation.y = -heading, so local (x, z) maps to world via heading.
      let i = 0;
      for (const z of [-WHEEL_Z, WHEEL_Z]) {
        const lx = -WHEEL_X;
        out[i].set(root.position.x + lx * c + z * s, 0.05, root.position.z - lx * s + z * c);
        i++;
      }
      return out;
    },
    update(car, dt, time) {
      root.position.set(car.x, 0, car.z);
      root.rotation.y = -car.heading;
      for (const p of steerPivots) p.rotation.y = -car.steer * 0.45;
      spinAngle -= (car.forwardSpeed / 0.42) * dt;
      for (const w of wheels) w.rotation.z = spinAngle;

      const accel = dt > 0 ? (car.speed - lastSpeed) / dt : 0;
      lastSpeed = car.speed;
      const k = 1 - Math.exp(-8 * dt);
      roll += (Math.max(-0.12, Math.min(0.12, -car.slip * 0.25)) - roll) * k;
      pitch += (Math.max(-0.05, Math.min(0.05, accel * 0.004)) - pitch) * k;
      body.rotation.x = roll;
      body.rotation.z = pitch;

      for (const f of flames) {
        f.visible = car.boosting;
        if (car.boosting) f.scale.set(1, 0.8 + Math.sin(time * 60 + f.position.z * 9) * 0.25, 1);
      }
    },
    dispose() {
      root.traverse((o) => {
        o.geometry?.dispose();
        if (o.material && o.material !== flameMat) o.material.dispose();
      });
      flameMat.dispose();
    },
  };
}
