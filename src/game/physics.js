// Arcade drift model. Heading θ: forward = (cos θ, sin θ), right = (-sin θ, cos θ).
// Velocity is split into forward and lateral parts each step; low lateral grip
// while drifting lets the car keep sliding as the heading rotates.

import { approach, clamp, wrapAngle } from './math.js';

export const NITRO_DRAIN = 0.42; // meter per second while boosting
export const NITRO_MIN = 0.15; // minimum meter to start a boost
export const BOOST_SPEED = 1.25;
export const BOOST_ACCEL = 1.7;
export const CAR_HALF_WIDTH = 1.0;

export function createCar(spec, x, z, heading) {
  return {
    spec,
    x,
    z,
    heading,
    vx: 0,
    vz: 0,
    steer: 0,
    yawRate: 0,
    grip: spec.grip,
    drifting: false,
    boosting: false,
    nitro: 0,
    speed: 0, // |v| m/s
    forwardSpeed: 0,
    slip: 0, // signed slip angle (rad), positive = sliding to the right
  };
}

/**
 * Advance one car by dt seconds.
 * input: { steer: -1..1, throttle: 0..1, brake: 0..1, nitro: boolean }
 * env:   { gripMul?: number }
 */
export function stepCar(car, input, dt, env = {}) {
  const spec = car.spec;
  const gripMul = env.gripMul ?? 1;
  const fx = Math.cos(car.heading);
  const fz = Math.sin(car.heading);
  const rx = -fz;
  const rz = fx;
  let vf = car.vx * fx + car.vz * fz;
  let vl = car.vx * rx + car.vz * rz;

  car.steer = approach(car.steer, clamp(input.steer, -1, 1), spec.steerSpeed * dt);

  // Drift state: hard steering at speed breaks traction; it ends once the
  // driver straightens up and the slide has mostly settled.
  const slipNow = Math.abs(Math.atan2(vl, Math.max(Math.abs(vf), 1)));
  if (Math.abs(car.steer) > 0.4 && vf > spec.maxSpeed * 0.4) car.drifting = true;
  else if (car.drifting && ((Math.abs(car.steer) < 0.2 && slipNow < 0.12) || vf < 8)) car.drifting = false;

  const targetGrip = (car.drifting ? spec.driftGrip : spec.grip) * gripMul;
  car.grip = approach(car.grip, targetGrip, (car.drifting ? 60 : 8) * dt);

  // Nitro
  if (input.nitro && !car.boosting && car.nitro >= NITRO_MIN) car.boosting = true;
  if (car.boosting) {
    car.nitro -= NITRO_DRAIN * dt;
    if (car.nitro <= 0 || !input.nitro) {
      car.nitro = Math.max(car.nitro, 0);
      car.boosting = false;
    }
  }
  const maxSpeed = spec.maxSpeed * (car.boosting ? BOOST_SPEED : 1);
  const accel = spec.accel * (car.boosting ? BOOST_ACCEL : 1);

  // Longitudinal
  const throttle = clamp(input.throttle, 0, 1);
  const brake = clamp(input.brake, 0, 1);
  if (brake > 0) {
    vf = approach(vf, -spec.maxSpeed * 0.25, spec.brake * brake * dt);
  } else {
    vf += accel * throttle * Math.max(0, 1 - vf / maxSpeed) * dt;
  }
  if (vf > maxSpeed) vf = approach(vf, maxSpeed, 12 * dt); // bleed off after a boost
  vf -= vf * spec.drag * dt;

  // Lateral grip: the lateral velocity that grip removes is partly paid for in
  // forward speed, so long sideways slides cost a little pace.
  const lost = vl * (1 - Math.exp(-car.grip * dt));
  vl -= lost;
  if (vf > 0) vf = Math.max(0, vf - Math.abs(lost) * 0.12);

  // Yaw: no turning when stationary; oversteer while drifting.
  const speedFactor = clamp(Math.abs(vf) / 8, 0, 1) * (vf >= 0 ? 1 : -1);
  const highSpeedDamp = car.drifting ? 1 : 1 - 0.25 * clamp(vf / spec.maxSpeed, 0, 1);
  const yawTarget = car.steer * spec.turnRate * speedFactor * highSpeedDamp * (car.drifting ? spec.driftTurn : 1);
  car.yawRate = approach(car.yawRate, yawTarget, 9 * dt);
  car.heading = wrapAngle(car.heading + car.yawRate * dt);

  // Velocity keeps its world direction; only the body rotated.
  car.vx = vf * fx + vl * rx;
  car.vz = vf * fz + vl * rz;
  car.x += car.vx * dt;
  car.z += car.vz * dt;

  // Derived values relative to the new heading.
  const nfx = Math.cos(car.heading);
  const nfz = Math.sin(car.heading);
  const nvf = car.vx * nfx + car.vz * nfz;
  const nvl = car.vx * -nfz + car.vz * nfx;
  car.forwardSpeed = nvf;
  car.speed = Math.hypot(car.vx, car.vz);
  car.slip = car.speed > 2 ? Math.atan2(nvl, Math.max(Math.abs(nvf), 1)) : 0;
}

/**
 * Keep the car between the barriers. `near` is track.nearest() for the car.
 * Returns the impact speed into the wall (0 when no contact).
 */
export function collideWithWalls(car, near, halfWidth) {
  const limit = halfWidth - CAR_HALF_WIDTH;
  const over = Math.abs(near.lateral) - limit;
  if (over <= 0) return 0;
  const side = Math.sign(near.lateral);
  const nx = -near.tz * side; // outward normal
  const nz = near.tx * side;
  car.x -= nx * over;
  car.z -= nz * over;
  const vOut = car.vx * nx + car.vz * nz;
  if (vOut <= 0) return 0;

  car.vx -= nx * vOut * 1.3;
  car.vz -= nz * vOut * 1.3;
  const scrub = Math.max(0.55, 1 - vOut * 0.025);
  car.vx *= scrub;
  car.vz *= scrub;
  car.yawRate *= 0.4;

  // Glance the nose along the wall so the car does not stay pinned.
  const along = Math.atan2(near.tz, near.tx);
  const fwd = Math.abs(wrapAngle(along - car.heading)) < Math.PI / 2 ? along : wrapAngle(along + Math.PI);
  const diff = wrapAngle(fwd - car.heading);
  car.heading = wrapAngle(car.heading + clamp(diff, -vOut * 0.03, vOut * 0.03));
  car.speed = Math.hypot(car.vx, car.vz);
  return vOut;
}
