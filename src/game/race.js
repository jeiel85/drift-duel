// Race bookkeeping: progress along the track, laps, drift scoring, ranking.

import { collideWithWalls, stepCar, wallAssist } from './physics.js';

const NITRO_PER_SLIP = 0.4;
const CHAIN_GAP = 0.7; // seconds without sliding before a drift chain is banked
const CRASH_IMPACT = 4; // m/s into a wall that breaks a drift chain
export const STUCK_SPEED = 2; // m/s — slower than this while driving counts as stuck
export const STUCK_SECONDS = 2.5; // then the car is put back on the racing line

export function createDriftState() {
  return { chain: 0, chainTime: 0, idle: 0, multiplier: 1, total: 0, best: 0 };
}

/**
 * Score drifting and charge nitro. Returns an event when a chain ends:
 *   { type: 'bank', points } or { type: 'crash', lost }
 */
export function updateDrift(d, car, dt, impact) {
  if (impact > CRASH_IMPACT && d.chain > 0) {
    const lost = Math.round(d.chain * d.multiplier);
    d.chain = 0;
    d.chainTime = 0;
    d.idle = 0;
    d.multiplier = 1;
    return { type: 'crash', lost };
  }
  const slip = Math.abs(car.slip);
  if (car.drifting && slip > 0.18 && car.speed > 12) {
    d.chain += car.speed * slip * dt * 6;
    d.chainTime += dt;
    d.idle = 0;
    d.multiplier = Math.min(4, 1 + Math.floor(d.chainTime / 1.5) * 0.5);
    car.nitro = Math.min(1, car.nitro + slip * dt * NITRO_PER_SLIP * car.spec.nitroGain);
    return null;
  }
  if (d.chain > 0) {
    d.idle += dt;
    if (d.idle > CHAIN_GAP) {
      const points = Math.round(d.chain * d.multiplier);
      d.total += points;
      d.best = Math.max(d.best, points);
      d.chain = 0;
      d.chainTime = 0;
      d.idle = 0;
      d.multiplier = 1;
      return { type: 'bank', points };
    }
  }
  return null;
}

export function createEntrant(car, track, { name, isBot = false }) {
  const near = track.nearest(car.x, car.z);
  // Cars start just behind the line, so map the start into (-L/2, L/2].
  const progress = near.s > track.length / 2 ? near.s - track.length : near.s;
  return {
    name,
    isBot,
    car,
    near,
    lastS: near.s,
    progress,
    lapsDone: 0,
    lapStart: 0,
    lapTimes: [],
    finished: false,
    finishTime: null,
    impact: 0,
    stuck: 0,
    respawned: false,
    drift: createDriftState(),
  };
}

/** Unwrap arc length into continuous progress and count completed laps. */
export function updateProgress(e, track, raceTime, laps) {
  const L = track.length;
  let ds = e.near.s - e.lastS;
  if (ds > L / 2) ds -= L;
  else if (ds < -L / 2) ds += L;
  e.lastS = e.near.s;
  e.progress += ds;

  const done = Math.max(0, Math.floor(e.progress / L));
  if (done > e.lapsDone && !e.finished) {
    e.lapTimes.push(raceTime - e.lapStart);
    e.lapStart = raceTime;
    e.lapsDone = done;
    if (done >= laps) {
      e.finished = true;
      e.finishTime = raceTime;
    }
  }
}

/** Put the car back on the centerline at its current track position, facing forward. */
export function respawn(e, track) {
  const p = track.pointAt(e.near.s, 0);
  const car = e.car;
  car.x = p.x;
  car.z = p.z;
  car.heading = p.heading;
  car.vx = 0;
  car.vz = 0;
  car.yawRate = 0;
  car.steer = 0;
  car.slip = 0;
  car.speed = 0;
  car.forwardSpeed = 0;
  car.drifting = false;
  car.grip = car.spec.grip;
  e.near = track.nearest(car.x, car.z, e.near.index);
  e.stuck = 0;
}

/**
 * Physics + walls + progress + drift scoring for one entrant. Returns a drift
 * event or null; `e.respawned` is true on the step the car was rescued.
 */
export function stepEntrant(e, input, dt, track, env, raceTime, laps) {
  stepCar(e.car, input, dt, env);
  e.near = track.nearest(e.car.x, e.car.z, e.near.index);
  if (env.assist) wallAssist(e.car, e.near, track.halfWidth, dt);
  e.impact = collideWithWalls(e.car, e.near, track.halfWidth);
  if (e.impact > 0) e.near = track.nearest(e.car.x, e.car.z, e.near.index);

  // Stuck rescue: only while the driver is actually trying to move (not during
  // the countdown or when coasting to a stop on purpose).
  const trying = input.throttle > 0 || input.brake > 0;
  e.stuck = trying && e.car.speed < STUCK_SPEED ? e.stuck + dt : 0;
  e.respawned = e.stuck >= STUCK_SECONDS;
  if (e.respawned) {
    respawn(e, track);
    e.drift.chain = 0; // a rescue never banks points
    e.drift.chainTime = 0;
    e.drift.multiplier = 1;
  }

  updateProgress(e, track, raceTime, laps);
  return updateDrift(e.drift, e.car, dt, e.impact);
}

/** Finished entrants by finish time first, then everyone else by progress. */
export function rank(entrants) {
  return [...entrants].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
}

/** Grid slot behind the start line: index 0 on the left, 1 on the right. */
export function gridPosition(track, slot) {
  const p = track.pointAt(track.length - 10 - slot * 6, slot % 2 === 0 ? -track.halfWidth / 3 : track.halfWidth / 3);
  return { x: p.x, z: p.z, heading: p.heading };
}
