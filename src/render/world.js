// Static scenery for a track: asphalt ribbon, curbs, barriers, start gantry,
// instanced props, lights and weather.
import * as THREE from 'three';
import { mulberry32 } from '../game/math.js';
import {
  asphaltTexture,
  checkerTexture,
  curbTexture,
  groundTexture,
  windowsTexture,
} from './textures.js';

const CURB = 1.6;
const WALL_H = 1.1;
const MARKER_GAP = 12; // m between roadside marker posts

/** Flat or vertical strip following the centerline between two lateral offsets. */
function ribbon(track, lat0, lat1, { y0 = 0, y1 = y0, vMeters = 16 } = {}) {
  const n = track.count;
  // Make the texture repeat an integer number of times so the loop seam matches.
  const vScale = track.length / Math.max(1, Math.round(track.length / vMeters));
  const pos = new Float32Array((n + 1) * 2 * 3);
  const uv = new Float32Array((n + 1) * 2 * 2);
  for (let i = 0; i <= n; i++) {
    const k = i % n;
    const rx = -track.tz[k];
    const rz = track.tx[k];
    const cx = track.xs[k];
    const cz = track.zs[k];
    const o = i * 6;
    pos[o] = cx + rx * lat0;
    pos[o + 1] = y0;
    pos[o + 2] = cz + rz * lat0;
    pos[o + 3] = cx + rx * lat1;
    pos[o + 4] = y1;
    pos[o + 5] = cz + rz * lat1;
    const v = (i * track.step) / vScale;
    uv.set([0, v, 1, v], i * 4);
  }
  const idx = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    // Counter-clockwise seen from above when lat0 < lat1, so flat strips face up.
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function trackBounds(track) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < track.count; i++) {
    minX = Math.min(minX, track.xs[i]);
    maxX = Math.max(maxX, track.xs[i]);
    minZ = Math.min(minZ, track.zs[i]);
    maxZ = Math.max(maxZ, track.zs[i]);
  }
  return { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
}

/** Random spots off the track, at least `clearance` meters from the barriers. */
function scatter(track, rnd, count, clearance, margin = 160) {
  const b = trackBounds(track);
  const spots = [];
  let attempts = 0;
  while (spots.length < count && attempts < count * 20) {
    attempts++;
    const x = b.minX - margin + rnd() * (b.maxX - b.minX + margin * 2);
    const z = b.minZ - margin + rnd() * (b.maxZ - b.minZ + margin * 2);
    const near = track.nearest(x, z);
    if (near.dist < track.halfWidth + CURB + clearance) continue;
    spots.push({ x, z, dist: near.dist });
  }
  return spots;
}

function instanced(geometry, material, items, place) {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const color = new THREE.Color();
  items.forEach((it, i) => {
    const r = place(it, p, q, s, color);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    if (r?.color) mesh.setColorAt(i, color);
  });
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

const yaw = (q, a) => q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);

/**
 * Marker posts just outside both barriers. Closely spaced roadside objects are
 * what make speed readable: open scenery alone barely moves on screen.
 */
function buildMarkers(group, track, theme) {
  const posts = [];
  const count = Math.round(track.length / MARKER_GAP); // even spacing across the loop seam
  for (let i = 0; i < count; i++) {
    for (const side of [-1, 1]) {
      const pt = track.pointAt((i * track.length) / count, side * (track.halfWidth + CURB + 0.5));
      posts.push({ x: pt.x, z: pt.z, side });
    }
  }
  group.add(
    instanced(new THREE.BoxGeometry(0.3, 1.7, 0.3), new THREE.MeshLambertMaterial({ color: theme.wall }), posts, (it, p, q, s) => {
      p.set(it.x, 0.85, it.z);
      q.identity();
      s.set(1, 1, 1);
    }),
  );
  // Bright reflector caps; on the neon track they match the barrier strips.
  group.add(
    instanced(new THREE.BoxGeometry(0.36, 0.36, 0.36), new THREE.MeshBasicMaterial(), posts, (it, p, q, s, c) => {
      p.set(it.x, 1.6, it.z);
      q.identity();
      s.set(1, 1, 1);
      c.setHex(theme.wallEmissive ? (it.side > 0 ? 0x2bf0ff : 0xff2bd6) : theme.marker);
      return { color: true };
    }),
  );
}

function buildScenery(group, track, theme, seed) {
  const rnd = mulberry32(seed);
  if (theme.scenery === 'harbor') {
    const palette = [0xe76f51, 0x2a9d8f, 0xe9c46a, 0x264653, 0xf4a261, 0x3d5a80];
    const containers = scatter(track, rnd, 140, 6);
    group.add(
      instanced(new THREE.BoxGeometry(6, 2.6, 2.4), new THREE.MeshLambertMaterial(), containers, (it, p, q, s, c) => {
        const stack = 1 + Math.floor(rnd() * 3);
        p.set(it.x, 1.3 * stack, it.z);
        yaw(q, rnd() * Math.PI);
        s.set(1, stack, 1);
        c.setHex(palette[Math.floor(rnd() * palette.length)]);
        return { color: true };
      }),
    );
    const palms = scatter(track, rnd, 90, 3, 60);
    group.add(
      instanced(new THREE.CylinderGeometry(0.25, 0.35, 7, 6), new THREE.MeshLambertMaterial({ color: 0x8b5a2b }), palms, (it, p, q, s) => {
        p.set(it.x, 3.5, it.z);
        q.identity();
        s.set(1, 1, 1);
      }),
    );
    group.add(
      instanced(new THREE.ConeGeometry(2.6, 2.2, 7), new THREE.MeshLambertMaterial({ color: 0x2d6a4f }), palms, (it, p, q, s) => {
        p.set(it.x, 7.4, it.z);
        q.identity();
        s.set(1, 1, 1);
      }),
    );
  } else if (theme.scenery === 'canyon') {
    const rocks = scatter(track, rnd, 170, 8);
    group.add(
      instanced(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ flatShading: true }), rocks, (it, p, q, s, c) => {
        const size = 3 + rnd() * 10 + Math.min(it.dist, 120) * 0.12;
        p.set(it.x, size * 0.35, it.z);
        q.setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd()));
        s.set(size, size * (0.6 + rnd()), size);
        c.setHSL(0.05 + rnd() * 0.03, 0.55, 0.32 + rnd() * 0.15);
        return { color: true };
      }),
    );
    const cacti = scatter(track, rnd, 70, 3, 40);
    group.add(
      instanced(new THREE.CylinderGeometry(0.4, 0.5, 4, 7), new THREE.MeshLambertMaterial({ color: 0x3a7d44 }), cacti, (it, p, q, s) => {
        p.set(it.x, 2, it.z);
        q.identity();
        s.set(1, 0.7 + rnd() * 0.6, 1);
      }),
    );
  } else if (theme.scenery === 'neon') {
    const facade = windowsTexture();
    const towers = scatter(track, rnd, 120, 10);
    const mat = new THREE.MeshLambertMaterial({ map: facade, emissiveMap: facade, emissive: 0xffffff, emissiveIntensity: 0.9 });
    group.add(
      instanced(new THREE.BoxGeometry(1, 1, 1), mat, towers, (it, p, q, s) => {
        const h = 15 + rnd() * 60;
        const w = 8 + rnd() * 10;
        p.set(it.x, h / 2, it.z);
        yaw(q, rnd() * Math.PI);
        s.set(w, h, w);
      }),
    );
    const poles = [];
    for (let s = 0; s < track.length; s += 36) {
      for (const side of [-1, 1]) {
        const pt = track.pointAt(s, side * (track.halfWidth + CURB + 2.5));
        poles.push({ x: pt.x, z: pt.z, side });
      }
    }
    group.add(
      instanced(new THREE.BoxGeometry(0.3, 6, 0.3), new THREE.MeshBasicMaterial(), poles, (it, p, q, s, c) => {
        p.set(it.x, 3, it.z);
        q.identity();
        s.set(1, 1, 1);
        c.setHex(it.side > 0 ? 0x2bf0ff : 0xff2bd6);
        return { color: true };
      }),
    );
  }
}

function buildRain() {
  const N = 1400;
  const pos = new Float32Array(N * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x9fb4ff, transparent: true, opacity: 0.45 });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  const rnd = mulberry32(5);
  const drops = Array.from({ length: N }, () => ({ x: rnd() * 120 - 60, y: rnd() * 40, z: rnd() * 120 - 60 }));
  return {
    object: lines,
    update(dt, center) {
      for (let i = 0; i < N; i++) {
        const d = drops[i];
        d.y -= 38 * dt;
        if (d.y < 0) d.y += 40;
        const x = center.x + d.x;
        const z = center.z + d.z;
        const o = i * 6;
        pos[o] = x;
        pos[o + 1] = d.y;
        pos[o + 2] = z;
        pos[o + 3] = x + 0.15;
        pos[o + 4] = d.y + 1.1;
        pos[o + 5] = z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

export function buildWorld(scene, track, def, { shadows = true } = {}) {
  const theme = def.theme;
  const group = new THREE.Group();
  scene.add(group);
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);

  const hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemiIntensity);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(theme.sun, theme.sunIntensity);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -40;
  sc.right = 40;
  sc.top = 40;
  sc.bottom = -40;
  sc.near = 1;
  sc.far = 200;
  sun.shadow.bias = -0.0005;
  group.add(sun, sun.target);

  const b = trackBounds(track);
  const gtex = groundTexture(theme.ground);
  gtex.repeat.set(120, 120);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ map: gtex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(b.cx, -0.02, b.cz);
  ground.receiveShadow = true;
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ map: asphaltTexture(theme.asphalt) });
  if (theme.weather === 'rain') {
    roadMat.color = new THREE.Color(0xb8b8d8); // wet sheen tint
  }
  const road = new THREE.Mesh(ribbon(track, -track.halfWidth, track.halfWidth, { y0: 0.01, vMeters: 8 }), roadMat);
  road.receiveShadow = true;
  group.add(road);

  const curbMat = new THREE.MeshLambertMaterial({ map: curbTexture() });
  for (const side of [-1, 1]) {
    const a = side * track.halfWidth;
    const c = side * (track.halfWidth + CURB);
    const curb = new THREE.Mesh(ribbon(track, Math.min(a, c), Math.max(a, c), { y0: 0.03, vMeters: 4 }), curbMat);
    curb.receiveShadow = true;
    group.add(curb);

    const wallMat = new THREE.MeshLambertMaterial({
      color: theme.wall,
      emissive: theme.wallEmissive,
      emissiveIntensity: theme.wallEmissive ? 0.35 : 0,
      side: THREE.DoubleSide,
    });
    group.add(new THREE.Mesh(ribbon(track, c, c, { y0: 0, y1: WALL_H }), wallMat));
    if (theme.wallEmissive) {
      // Glowing strip along the top of the barrier.
      const strip = new THREE.Mesh(
        ribbon(track, c - side * 0.15, c + side * 0.15, { y0: WALL_H + 0.01 }),
        new THREE.MeshBasicMaterial({ color: side > 0 ? 0x2bf0ff : 0xff2bd6, side: THREE.DoubleSide }),
      );
      group.add(strip);
    }
  }

  // Start / finish line and gantry
  const start = track.pointAt(0);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(3, track.width), new THREE.MeshLambertMaterial({ map: checkerTexture() }));
  line.rotation.x = -Math.PI / 2;
  line.rotation.z = -start.heading;
  line.position.set(start.x, 0.04, start.z);
  group.add(line);

  const gantry = new THREE.Group();
  const postMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const span = track.width + CURB * 2 + 2;
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 0.6), postMat);
    post.position.set(0, 3.5, (side * span) / 2);
    gantry.add(post);
  }
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.4, span),
    new THREE.MeshLambertMaterial({ color: 0xff3d71, emissive: 0xff3d71, emissiveIntensity: 0.4 }),
  );
  beam.position.y = 7;
  gantry.add(beam);
  gantry.position.set(start.x, 0, start.z);
  gantry.rotation.y = -start.heading;
  group.add(gantry);

  buildMarkers(group, track, theme);
  buildScenery(group, track, theme, def.seed);

  const rain = theme.weather === 'rain' ? buildRain() : null;
  if (rain) group.add(rain.object);

  return {
    bounds: b,
    setShadows(on) {
      sun.castShadow = on;
    },
    /** Keep the shadow camera and weather centered on the focus point. */
    update(dt, focus) {
      sun.position.set(focus.x + 30, 60, focus.z + 20);
      sun.target.position.set(focus.x, 0, focus.z);
      rain?.update(dt, focus);
    },
    dispose() {
      scene.remove(group);
      group.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          m.map?.dispose();
          m.emissiveMap?.dispose();
          m.dispose();
        }
      });
    },
  };
}
