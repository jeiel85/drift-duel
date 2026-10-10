import { describe, expect, it } from 'vitest';
import { carById } from '../src/game/cars.js';
import { wrapAngle } from '../src/game/math.js';
import { ASSIST_SLIP_CAP, createCar, stepCar } from '../src/game/physics.js';
import { createEntrant, gridPosition, stepEntrant } from '../src/game/race.js';
import { buildTrack } from '../src/game/track.js';
import { TRACKS } from '../src/game/tracks.js';

const DT = 1 / 120;
const FLOOR_IT = { steer: 0, throttle: 1, brake: 0, nitro: false };

describe('driving assist (touch default)', () => {
  const holdThenRelease = (assist) => {
    const car = createCar(carById('vela'), 0, 0, 0);
    const env = { assist };
    for (let t = 0; t < 6; t += DT) stepCar(car, FLOOR_IT, DT, env);
    let maxSlip = 0;
    let drifted = false;
    for (let t = 0; t < 1.6; t += DT) {
      stepCar(car, { ...FLOOR_IT, steer: 1 }, DT, env);
      maxSlip = Math.max(maxSlip, Math.abs(car.slip));
      drifted ||= car.drifting;
    }
    for (let t = 0; t < 0.8; t += DT) stepCar(car, FLOOR_IT, DT, env);
    return { maxSlip, drifted, settled: Math.abs(car.slip), speed: car.speed };
  };

  it('still lets a held turn break into a drift', () => {
    const r = holdThenRelease(true);
    expect(r.drifted).toBe(true);
    expect(r.maxSlip).toBeGreaterThan(0.4);
  });

  it('caps the slide so holding full lock cannot spin the car', () => {
    expect(holdThenRelease(false).maxSlip).toBeGreaterThan(1); // raw physics spins
    expect(holdThenRelease(true).maxSlip).toBeLessThanOrEqual(ASSIST_SLIP_CAP + 0.01);
  });

  it('recovers grip quickly once the thumb lifts, keeping more speed', () => {
    const raw = holdThenRelease(false);
    const assisted = holdThenRelease(true);
    expect(assisted.settled).toBeLessThan(0.02);
    expect(assisted.speed).toBeGreaterThan(raw.speed);
  });

  it('a short tap is a small correction, not full lock', () => {
    const car = createCar(carById('vela'), 0, 0, 0);
    for (let t = 0; t < 4; t += DT) stepCar(car, FLOOR_IT, DT, { assist: true });
    for (let t = 0; t < 0.1; t += DT) stepCar(car, { ...FLOOR_IT, steer: 1 }, DT, { assist: true });
    expect(car.steer).toBeLessThan(0.4);
    expect(car.drifting).toBe(false);
  });
});

// A crude "thumb" driver: full left / full right / nothing, reacting 150 ms late.
// It stands in for an on/off touch player to measure how forgiving the controls are.
function thumbDriver(e, track, history) {
  const c = e.car;
  const t = track.pointAt(e.near.s + 10 + c.forwardSpeed * 0.5);
  const d = wrapAngle(Math.atan2(t.z - c.z, t.x - c.x) - c.heading);
  history.push(Math.abs(d) < 0.08 ? 0 : Math.sign(d));
  return { steer: history.length > 18 ? history.shift() : 0, throttle: 1, brake: 0, nitro: false };
}

function raceThumb(def, carId, assist) {
  const track = buildTrack(def);
  const g = gridPosition(track, 0);
  const e = createEntrant(createCar(carById(carId), g.x, g.z, g.heading), track, { name: 'thumb' });
  const history = [];
  let time = 0;
  let wallHits = 0;
  let maxSlip = 0;
  while (!e.finished && time < 300) {
    stepEntrant(e, thumbDriver(e, track, history), DT, track, { gripMul: def.gripMul, assist }, time, def.laps);
    if (e.impact > 2) wallHits++;
    maxSlip = Math.max(maxSlip, Math.abs(e.car.slip));
    time += DT;
  }
  return { finished: e.finished, wallHits, maxSlip };
}

describe.each(TRACKS)('thumb driver on $id', (def) => {
  it.each(['vela', 'bruiser'])('with assist finishes with at most one wall hit and no spin (%s)', (id) => {
    const r = raceThumb(def, id, true);
    expect(r.finished).toBe(true);
    expect(r.wallHits).toBeLessThanOrEqual(1);
    expect(r.maxSlip).toBeLessThanOrEqual(ASSIST_SLIP_CAP + 0.01);
  });
});

it('assist removes most wall hits on the hardest track', () => {
  const neon = TRACKS.find((t) => t.id === 'neon');
  const raw = raceThumb(neon, 'bruiser', false).wallHits;
  const assisted = raceThumb(neon, 'bruiser', true).wallHits;
  expect(raw).toBeGreaterThan(5);
  expect(assisted).toBeLessThan(raw / 5);
});
