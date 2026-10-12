// Pooled skid marks, tire smoke and wind streaks.
import * as THREE from 'three';
import { damp } from '../game/math.js';
import { puffTexture } from './textures.js';

const MAX_MARKS = 1600;
const MARK_SPACING = 0.6;

export function createSkids(scene) {
  const geo = new THREE.PlaneGeometry(1, 0.32);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x0a0a0a,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_MARKS);
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  let next = 0;
  const trails = new Map(); // per-wheel last mark position

  function add(key, p) {
    const last = trails.get(key);
    if (!last) {
      trails.set(key, p.clone());
      return;
    }
    const dx = p.x - last.x;
    const dz = p.z - last.z;
    const len = Math.hypot(dx, dz);
    if (len < MARK_SPACING) return;
    if (len > 4) {
      last.copy(p); // teleport / respawn: do not draw a long streak
      return;
    }
    pos.set((p.x + last.x) / 2, 0.035, (p.z + last.z) / 2);
    q.setFromAxisAngle(up, -Math.atan2(dz, dx));
    scale.set(len + 0.05, 1, 1);
    m.compose(pos, q, scale);
    mesh.setMatrixAt(next, m);
    next = (next + 1) % MAX_MARKS;
    mesh.count = Math.max(mesh.count, next === 0 ? MAX_MARKS : next);
    mesh.instanceMatrix.needsUpdate = true;
    last.copy(p);
  }

  return {
    add,
    /** Lift the "pen" so the next mark for this wheel starts fresh. */
    lift(key) {
      trails.delete(key);
    },
    clear() {
      mesh.count = 0;
      next = 0;
      trails.clear();
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
    },
  };
}

export function createSmoke(scene, color = 0xdddddd) {
  const tex = puffTexture();
  const POOL = 90;
  const parts = [];
  for (let i = 0; i < POOL; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.visible = false;
    scene.add(s);
    parts.push({ sprite: s, life: 0, max: 1, vx: 0, vy: 0, vz: 0 });
  }
  let next = 0;
  return {
    emit(p, vx, vz, strength = 1) {
      const it = parts[next];
      next = (next + 1) % POOL;
      it.sprite.position.set(p.x, 0.4, p.z);
      it.vx = vx * 0.15 + (Math.random() - 0.5) * 2;
      it.vz = vz * 0.15 + (Math.random() - 0.5) * 2;
      it.vy = 0.8 + Math.random();
      it.life = 0;
      it.max = 0.7 + Math.random() * 0.5;
      it.strength = strength;
      it.sprite.visible = true;
    },
    update(dt) {
      for (const it of parts) {
        if (!it.sprite.visible) continue;
        it.life += dt;
        const t = it.life / it.max;
        if (t >= 1) {
          it.sprite.visible = false;
          continue;
        }
        it.sprite.position.x += it.vx * dt;
        it.sprite.position.y += it.vy * dt;
        it.sprite.position.z += it.vz * dt;
        const size = 1.2 + t * 3.5;
        it.sprite.scale.set(size, size, 1);
        it.sprite.material.opacity = (1 - t) * 0.55 * it.strength;
      }
    },
    clear() {
      for (const it of parts) it.sprite.visible = false;
    },
    dispose() {
      for (const it of parts) {
        scene.remove(it.sprite);
        it.sprite.material.dispose();
      }
      tex.dispose();
    },
  };
}

/**
 * Wind streaks: short lines fixed in the world around the car's path. The car
 * rushes past them, so they read as speed. They fade in from 60% of top speed
 * and brighten on nitro and kicks.
 */
export function createSpeedLines(scene) {
  const N = 90;
  const AHEAD = 70; // spawn range in front of the car (m)
  const LANE = 4; // m: no streaks closer than this to the car's line of travel
  const pos = new Float32Array(N * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.visible = false;
  scene.add(lines);
  const streaks = Array.from({ length: N }, () => ({ x: 0, y: 0, z: 0, live: false }));

  function place(s, car, fx, fz, near) {
    // Off to the sides, clear of the lane the car and the chase camera travel in.
    const side = Math.random() < 0.5 ? -1 : 1;
    const lat = side * (LANE + Math.random() * 10);
    const fwd = (near ? 0 : AHEAD * 0.3) + Math.random() * AHEAD * (near ? 1 : 0.7);
    s.x = car.x + fx * fwd - fz * lat;
    s.z = car.z + fz * fwd + fx * lat;
    s.y = 0.3 + Math.random() * 4.5;
    s.live = true;
  }

  return {
    update(car, pace, enabled, dt) {
      const surge = car.boosting ? 0.35 : car.kick > 0 ? 0.2 : 0;
      const strength = enabled ? Math.min(1, Math.max(0, (pace - 0.6) / 0.4)) * 0.35 + surge : 0;
      mat.opacity += (strength - mat.opacity) * damp(8, dt);
      lines.visible = mat.opacity > 0.01;
      if (!lines.visible) {
        for (const s of streaks) s.live = false;
        return;
      }
      const speed = Math.max(car.speed, 1);
      const fx = car.vx / speed;
      const fz = car.vz / speed;
      const len = Math.min(9, speed * (car.boosting ? 0.16 : 0.1));
      for (let i = 0; i < N; i++) {
        const s = streaks[i];
        if (!s.live) place(s, car, fx, fz, true);
        else {
          const dx = s.x - car.x;
          const dz = s.z - car.z;
          const ahead = dx * fx + dz * fz;
          const lat = Math.abs(dz * fx - dx * fz);
          // Recycle just after passing the car (before it sweeps across the lens), when far
          // ahead, or when a turn has swung the car's path onto it.
          if (ahead < -4 || ahead > AHEAD * 1.5 || lat < LANE - 1) place(s, car, fx, fz, false);
        }
        const o = i * 6;
        pos[o] = s.x;
        pos[o + 1] = s.y;
        pos[o + 2] = s.z;
        pos[o + 3] = s.x - fx * len;
        pos[o + 4] = s.y;
        pos[o + 5] = s.z - fz * len;
      }
      geo.attributes.position.needsUpdate = true;
    },
    clear() {
      for (const s of streaks) s.live = false;
      mat.opacity = 0;
      lines.visible = false;
    },
    dispose() {
      scene.remove(lines);
      geo.dispose();
      mat.dispose();
    },
  };
}
