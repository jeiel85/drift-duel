// Rival driver: follows a look-ahead point on the centerline and brakes for
// upcoming curvature. It drives with the exact same physics as the player.

import { clamp, wrapAngle } from './math.js';

export const SKILLS = {
  easy: { label: 'Easy', speedMul: 0.8, cornerAcc: 13, lineOffset: 0 },
  normal: { label: 'Normal', speedMul: 0.87, cornerAcc: 17, lineOffset: 0 },
  hard: { label: 'Hard', speedMul: 1, cornerAcc: 34, lineOffset: 0 },
};

export function botInput(entrant, track, skill) {
  const car = entrant.car;
  const s = entrant.near.s;
  const speed = Math.max(car.forwardSpeed, 0);

  const look = 7 + speed * 0.45;
  const target = track.pointAt(s + look, skill.lineOffset);
  const want = Math.atan2(target.z - car.z, target.x - car.x);
  // Steer against existing slide so it recovers instead of spinning.
  const diff = wrapAngle(want - car.heading) - car.slip * 0.35;
  const steer = clamp(diff * 2.4, -1, 1);

  const brakeZone = 12 + speed * 1.1;
  const k = track.maxCurvature(s, s + brakeZone);
  const cap = car.spec.maxSpeed * skill.speedMul;
  const targetSpeed = Math.min(cap, Math.sqrt(skill.cornerAcc / Math.max(k, 1e-4)));

  const over = speed - targetSpeed;
  const throttle = over > 0 ? 0 : speed > cap ? 0 : 1;
  const brake = over > 4 ? clamp(over / 12, 0.2, 1) : 0;
  const nitro = car.nitro > 0.5 && k < 0.012 && speed < cap * 1.05;
  return { steer, throttle, brake, nitro };
}
