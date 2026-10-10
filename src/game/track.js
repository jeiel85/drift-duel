// Closed race track built from control points.
// Coordinates are meters on the ground plane (x, z). Tangent t = (tx, tz);
// the "right" normal is (-tz, tx), which matches the car's right-hand side.

const SAMPLE_STEP = 2; // meters between resampled centerline points

function centripetalPoint(p0, p1, p2, p3, t) {
  // Barry–Goldman pyramid for centripetal Catmull–Rom (alpha = 0.5): no cusps or loops.
  const knot = (a, b) => Math.max(Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])), 1e-4);
  const t0 = 0;
  const t1 = t0 + knot(p0, p1);
  const t2 = t1 + knot(p1, p2);
  const t3 = t2 + knot(p2, p3);
  const u = t1 + (t2 - t1) * t;
  const mix = (a, b, ta, tb) => {
    const w = (u - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
  };
  const a1 = mix(p0, p1, t0, t1);
  const a2 = mix(p1, p2, t1, t2);
  const a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, t0, t2);
  const b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

export function buildTrack(def) {
  const pts = def.points;
  const n = pts.length;
  if (n < 4) throw new Error(`track "${def.id}" needs at least 4 control points`);

  // 1. Dense polyline along the spline.
  const dense = [];
  const perSegment = 48;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let j = 0; j < perSegment; j++) dense.push(centripetalPoint(p0, p1, p2, p3, j / perSegment));
  }
  const denseLen = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i % dense.length];
    denseLen.push(denseLen[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const length = denseLen[dense.length];

  // 2. Resample at uniform arc length.
  const count = Math.round(length / SAMPLE_STEP);
  const step = length / count;
  const xs = new Float64Array(count);
  const zs = new Float64Array(count);
  let k = 0;
  for (let i = 0; i < count; i++) {
    const s = i * step;
    while (denseLen[k + 1] < s) k++;
    const a = dense[k];
    const b = dense[(k + 1) % dense.length];
    const w = (s - denseLen[k]) / (denseLen[k + 1] - denseLen[k]);
    xs[i] = a[0] + (b[0] - a[0]) * w;
    zs[i] = a[1] + (b[1] - a[1]) * w;
  }

  // 3. Tangents and signed curvature (positive = bending right).
  const tx = new Float64Array(count);
  const tz = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const nx = xs[(i + 1) % count] - xs[(i - 1 + count) % count];
    const nz = zs[(i + 1) % count] - zs[(i - 1 + count) % count];
    const len = Math.hypot(nx, nz);
    tx[i] = nx / len;
    tz[i] = nz / len;
  }
  const rawCurv = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const cross = tx[i] * tz[j] - tz[i] * tx[j];
    const dot = tx[i] * tx[j] + tz[i] * tz[j];
    rawCurv[i] = Math.atan2(cross, dot) / step;
  }
  const curvature = new Float64Array(count);
  const W = 3;
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let d = -W; d <= W; d++) sum += rawCurv[(i + d + count) % count];
    curvature[i] = sum / (W * 2 + 1);
  }

  const wrapS = (s) => ((s % length) + length) % length;

  function projectOnSegment(i, x, z) {
    const j = (i + 1) % count;
    const ax = xs[i];
    const az = zs[i];
    const dx = xs[j] - ax;
    const dz = zs[j] - az;
    const lenSq = dx * dx + dz * dz;
    let w = ((x - ax) * dx + (z - az) * dz) / lenSq;
    w = w < 0 ? 0 : w > 1 ? 1 : w;
    const px = ax + dx * w;
    const pz = az + dz * w;
    return { w, distSq: (x - px) ** 2 + (z - pz) ** 2 };
  }

  /**
   * Closest centerline location to (x, z). Pass the previous `index` as `hint`
   * to search locally (cheap and immune to jumping across nearby track sections).
   */
  function nearest(x, z, hint = null) {
    let best = -1;
    let bestDist = Infinity;
    let bestW = 0;
    const scan = (i) => {
      const r = projectOnSegment(i, x, z);
      if (r.distSq < bestDist) {
        bestDist = r.distSq;
        best = i;
        bestW = r.w;
      }
    };
    if (hint == null) {
      for (let i = 0; i < count; i++) scan(i);
    } else {
      const R = 30;
      for (let d = -R; d <= R; d++) scan((hint + d + count) % count);
    }
    const s = wrapS((best + bestW) * step);
    const j = (best + 1) % count;
    let ttx = tx[best] + (tx[j] - tx[best]) * bestW;
    let ttz = tz[best] + (tz[j] - tz[best]) * bestW;
    const tl = Math.hypot(ttx, ttz);
    ttx /= tl;
    ttz /= tl;
    const cx = xs[best] + (xs[j] - xs[best]) * bestW;
    const cz = zs[best] + (zs[j] - zs[best]) * bestW;
    // Right normal = (-tz, tx)
    const lateral = (x - cx) * -ttz + (z - cz) * ttx;
    return { index: best, s, lateral, dist: Math.sqrt(bestDist), tx: ttx, tz: ttz };
  }

  /** World position at arc length `s`, offset `lateral` meters to the right. */
  function pointAt(s, lateral = 0) {
    s = wrapS(s);
    const f = s / step;
    const i = Math.floor(f) % count;
    const j = (i + 1) % count;
    const w = f - Math.floor(f);
    let ttx = tx[i] + (tx[j] - tx[i]) * w;
    let ttz = tz[i] + (tz[j] - tz[i]) * w;
    const tl = Math.hypot(ttx, ttz);
    ttx /= tl;
    ttz /= tl;
    return {
      x: xs[i] + (xs[j] - xs[i]) * w - ttz * lateral,
      z: zs[i] + (zs[j] - zs[i]) * w + ttx * lateral,
      tx: ttx,
      tz: ttz,
      heading: Math.atan2(ttz, ttx),
    };
  }

  /** Largest |curvature| (1/m) between arc lengths s0 and s1. */
  function maxCurvature(s0, s1) {
    let m = 0;
    for (let s = s0; s <= s1; s += step) {
      const c = Math.abs(curvature[Math.floor(wrapS(s) / step) % count]);
      if (c > m) m = c;
    }
    return m;
  }

  return {
    id: def.id,
    width: def.width,
    halfWidth: def.width / 2,
    length,
    step,
    count,
    xs,
    zs,
    tx,
    tz,
    curvature,
    wrapS,
    nearest,
    pointAt,
    maxCurvature,
  };
}
