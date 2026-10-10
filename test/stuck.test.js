import { describe, expect, it } from 'vitest';
import { carById } from '../src/game/cars.js';
import { wrapAngle } from '../src/game/math.js';
import { createCar } from '../src/game/physics.js';
import { createEntrant, STUCK_SECONDS, stepEntrant } from '../src/game/race.js';
import { buildTrack } from '../src/game/track.js';
import { TRACKS } from '../src/game/tracks.js';

const DT = 1 / 120;
const track = buildTrack(TRACKS[0]);
const env = { gripMul: 1, assist: false };

/** A car parked against the right-hand barrier, nose pointing straight into it. */
function wedged() {
  const s = 300;
  const p = track.pointAt(s, track.halfWidth - 1.05);
  const heading = p.heading + Math.PI / 2; // facing the wall
  return createEntrant(createCar(carById('bruiser'), p.x, p.z, heading), track, { name: 'p' });
}

describe('stuck rescue', () => {
  it('puts a car that cannot move back on the centerline, facing forward', () => {
    const e = wedged();
    const progress0 = e.progress;
    let rescued = false;
    for (let t = 0; t < STUCK_SECONDS + 0.5 && !rescued; t += DT) {
      // Force "no progress": a driver flooring it while something holds the car.
      e.car.vx = 0;
      e.car.vz = 0;
      stepEntrant(e, { steer: 0, throttle: 1, brake: 0, nitro: false }, DT, track, env, t, 3);
      rescued = e.respawned;
    }
    expect(rescued).toBe(true);
    expect(Math.abs(e.near.lateral)).toBeLessThan(0.1);
    expect(Math.abs(wrapAngle(Math.atan2(e.near.tz, e.near.tx) - e.car.heading))).toBeLessThan(0.05);
    expect(Math.abs(e.progress - progress0)).toBeLessThan(3); // same spot on the track, no free distance
  });

  it('does not trigger while the driver is idle (countdown)', () => {
    const e = wedged();
    for (let t = 0; t < 5; t += DT) {
      stepEntrant(e, { steer: 0, throttle: 0, brake: 0, nitro: false }, DT, track, env, t, 3);
      expect(e.respawned).toBe(false);
    }
  });

  it('a car pinned nose-first into the wall gets going again within a few seconds', () => {
    const e = wedged();
    let t = 0;
    for (; t < 6 && e.car.forwardSpeed < 8; t += DT) {
      stepEntrant(e, { steer: 0, throttle: 1, brake: 0, nitro: false }, DT, track, env, t, 3);
    }
    expect(e.car.forwardSpeed).toBeGreaterThanOrEqual(8);
    const along = Math.atan2(e.near.tz, e.near.tx);
    expect(Math.abs(wrapAngle(along - e.car.heading))).toBeLessThan(Math.PI / 2); // heading down the track
  });

  it('never fires for a car that is driving normally', () => {
    const p = track.pointAt(10);
    const e = createEntrant(createCar(carById('vela'), p.x, p.z, p.heading), track, { name: 'p' });
    for (let t = 0; t < 8; t += DT) {
      stepEntrant(e, { steer: 0, throttle: 1, brake: 0, nitro: false }, DT, track, env, t, 3);
      expect(e.respawned).toBe(false);
    }
  });
});
