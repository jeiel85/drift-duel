// Pooled skid marks and tire smoke.
import * as THREE from 'three';
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
