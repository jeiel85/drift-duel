import { describe, expect, it } from 'vitest';
import { buildTrack } from '../src/game/track.js';
import { TRACKS } from '../src/game/tracks.js';

describe.each(TRACKS)('track $id', (def) => {
  const t = buildTrack(def);

  it('resamples the centerline at a uniform ~2 m step', () => {
    expect(t.length).toBeGreaterThan(500);
    for (let i = 0; i < t.count; i++) {
      const j = (i + 1) % t.count;
      const d = Math.hypot(t.xs[j] - t.xs[i], t.zs[j] - t.zs[i]);
      expect(d).toBeGreaterThan(t.step * 0.95);
      expect(d).toBeLessThan(t.step * 1.05);
    }
  });

  it('never overlaps itself (separate sections stay a full width apart)', () => {
    for (let i = 0; i < t.count; i += 2) {
      for (let j = 0; j < t.count; j += 2) {
        let arc = Math.abs(i - j) * t.step;
        arc = Math.min(arc, t.length - arc);
        if (arc < def.width * 4) continue;
        expect(Math.hypot(t.xs[i] - t.xs[j], t.zs[i] - t.zs[j])).toBeGreaterThan(def.width + 20);
      }
    }
  });

  it('has no corner tighter than an 18 m radius', () => {
    const maxK = Math.max(...Array.from(t.curvature, Math.abs));
    expect(1 / maxK).toBeGreaterThan(18);
  });

  it('nearest() recovers arc length and signed lateral offset', () => {
    for (const s of [0, 37.5, t.length / 3, t.length - 1]) {
      for (const lat of [-5, 0, 5]) {
        const p = t.pointAt(s, lat);
        const n = t.nearest(p.x, p.z);
        const ds = Math.abs(t.wrapS(n.s - s + t.length / 2) - t.length / 2);
        expect(ds).toBeLessThan(0.5);
        expect(n.lateral).toBeCloseTo(lat, 0);
      }
    }
  });

  it('local search with a hint matches the full search', () => {
    const p = t.pointAt(200, 3);
    const full = t.nearest(p.x, p.z);
    const local = t.nearest(p.x, p.z, full.index + 5);
    expect(local.index).toBe(full.index);
  });

  it('pointAt wraps around the loop', () => {
    const a = t.pointAt(10);
    const b = t.pointAt(10 + t.length);
    const c = t.pointAt(10 - t.length);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(c.z).toBeCloseTo(a.z, 6);
  });
});

it('rejects a track with too few control points', () => {
  expect(() => buildTrack({ id: 'bad', width: 10, points: [[0, 0], [1, 0], [1, 1]] })).toThrow();
});
