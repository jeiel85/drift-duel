// Race bookkeeping: progress along the track, laps, drift scoring, ranking.

import { collideWithWalls, kick, stepCar, wallAssist } from './physics.js';

const NITRO_PER_SLIP = 0.4;
const CHAIN_GAP = 0.7; // seconds without sliding before a drift chain is banked
const CRASH_IMPACT = 4; // m/s into a wall that breaks a drift chain
export const STUCK_SPEED = 2; // m/s — slower than this while driving counts as stuck
export const STUCK_SECONDS = 2.5; // then the car is put back on the racing line

// Kicks (see physics.js). Only granted with straight road ahead, so a burst never
// carries a car with no brake finger (touch auto-throttle) into the next wall.
export const MINI_KICK = 0.5; // s, for straightening out of a held drift...
export const MINI_KICK_SPEED = 1.1; // ...a gentler burst, as it comes off every corner
export const PAD_KICK = 1.0; // s, for driving over a dash pad
export const PAD_LENGTH = 6; // m along the track
export const PAD_WIDTH = 0.4; // fraction of the road width, centered
export const STRAIGHT_K = 1 / 60; // 1/m: gentler than this counts as straight
export const START_WINDOW = 0.4; // s before "GO" in which a press earns a start boost
export const START_KICK = 1.2; // s

/** Room for a kick: no bend sharper than STRAIGHT_K in the next 20 m + 1 s of travel. */
export function straightAhead(track, s, speed) {
  return track.maxCurvature(s, s + 20 + speed) < STRAIGHT_K;
}

/** Start boost verdict for a press with `left` seconds of countdown remaining. */
export function judgeStart(left) {
  return left <= START_WINDOW ? 'boost' : 'early';
}

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
    kicked: null, // 'mini' | 'pad' on the step a kick was granted
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

  const lastS = e.lastS;
  updateProgress(e, track, raceTime, laps);
  e.kicked = null;
  const car = e.car;
  if (car.driftExit && straightAhead(track, e.near.s, car.speed)) {
    kick(car, MINI_KICK, MINI_KICK_SPEED);
    e.kicked = 'mini';
  }
  if (crossedPad(track, lastS, e.near)) {
    kick(car, PAD_KICK);
    e.kicked = 'pad';
  }
  return updateDrift(e.drift, car, dt, e.impact);
}

/** True when this step moved forward onto a dash pad, within its width. */
export function crossedPad(track, lastS, near) {
  if (Math.abs(near.lateral) > track.halfWidth * PAD_WIDTH) return false;
  const L = track.length;
  for (const p of track.pads) {
    // Distance into the pad now vs. last step, wrapped to (-L/2, L/2].
    const now = ((near.s - p + L * 1.5) % L) - L / 2;
    const before = ((lastS - p + L * 1.5) % L) - L / 2;
    if (now >= 0 && now < PAD_LENGTH && (before < 0 || before >= PAD_LENGTH)) return true;
  }
  return false;
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
