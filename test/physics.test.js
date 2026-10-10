import { describe, expect, it } from 'vitest';
import { CARS, carById } from '../src/game/cars.js';
import { BOOST_SPEED, collideWithWalls, createCar, NITRO_MIN, stepCar } from '../src/game/physics.js';

const DT = 1 / 120;
const run = (car, input, seconds, env) => {
  for (let t = 0; t < seconds; t += DT) stepCar(car, input, DT, env);
};
const FLOOR_IT = { steer: 0, throttle: 1, brake: 0, nitro: false };

describe('stepCar', () => {
  it.each(CARS)('$name accelerates toward but never past its top speed', (spec) => {
    const car = createCar(spec, 0, 0, 0);
    run(car, FLOOR_IT, 30);
    expect(car.speed).toBeGreaterThan(spec.maxSpeed * 0.85);
    expect(car.speed).toBeLessThanOrEqual(spec.maxSpeed);
    expect(car.z).toBeCloseTo(0, 6); // straight line along +x
    expect(car.x).toBeGreaterThan(500);
  });

  it('does not turn while standing still', () => {
    const car = createCar(carById('vela'), 0, 0, 0);
    run(car, { steer: 1, throttle: 0, brake: 0, nitro: false }, 2);
    expect(car.heading).toBe(0);
  });

  it('positive steer turns right (heading increases)', () => {
    const car = createCar(carById('vela'), 0, 0, 0);
    run(car, FLOOR_IT, 2);
    run(car, { ...FLOOR_IT, steer: 0.3 }, 0.5);
    expect(car.heading).toBeGreaterThan(0);
  });

  it('hard steering at speed starts a drift with slip, and it settles after straightening', () => {
    const car = createCar(carById('vela'), 0, 0, 0);
    run(car, FLOOR_IT, 6);
    run(car, { ...FLOOR_IT, steer: 1 }, 1);
    expect(car.drifting).toBe(true);
    expect(Math.abs(car.slip)).toBeGreaterThan(0.2);
    run(car, FLOOR_IT, 3);
    expect(car.drifting).toBe(false);
    expect(Math.abs(car.slip)).toBeLessThan(0.05);
  });

  it('nitro lifts the speed cap and drains the meter', () => {
    const spec = carById('vela');
    const car = createCar(spec, 0, 0, 0);
    run(car, FLOOR_IT, 20);
    car.nitro = 1;
    run(car, { ...FLOOR_IT, nitro: true }, 1.5);
    expect(car.boosting).toBe(true);
    expect(car.speed).toBeGreaterThan(spec.maxSpeed);
    expect(car.speed).toBeLessThanOrEqual(spec.maxSpeed * BOOST_SPEED);
    expect(car.nitro).toBeLessThan(0.5);
  });

  it('will not start a boost below the minimum meter', () => {
    const car = createCar(carById('vela'), 0, 0, 0);
    car.nitro = NITRO_MIN / 2;
    run(car, { ...FLOOR_IT, nitro: true }, 0.5);
    expect(car.boosting).toBe(false);
  });

  it('braking slows the car down', () => {
    const car = createCar(carById('vela'), 0, 0, 0);
    run(car, FLOOR_IT, 6);
    const before = car.speed;
    run(car, { steer: 0, throttle: 0, brake: 1, nitro: false }, 0.5);
    expect(car.speed).toBeLessThan(before - 10);
  });

  it('wet grip makes the same drift slide wider', () => {
    const slipAfter = (gripMul) => {
      const car = createCar(carById('vela'), 0, 0, 0);
      run(car, FLOOR_IT, 6, { gripMul });
      run(car, { ...FLOOR_IT, steer: 1 }, 0.8, { gripMul });
      return Math.abs(car.slip);
    };
    expect(slipAfter(0.8)).toBeGreaterThan(slipAfter(1));
  });
});

describe('collideWithWalls', () => {
  // Straight track along +x: tangent (1, 0), right normal (0, 1).
  const near = (lateral) => ({ lateral, tx: 1, tz: 0 });

  it('ignores cars inside the barriers', () => {
    const car = createCar(carById('vela'), 0, 3, 0);
    car.vz = 5;
    expect(collideWithWalls(car, near(3), 10)).toBe(0);
    expect(car.vz).toBe(5);
  });

  it('pushes the car back inside and removes outward velocity', () => {
    const car = createCar(carById('vela'), 0, 10, 0.4);
    car.vx = 20;
    car.vz = 8;
    const impact = collideWithWalls(car, near(10), 10);
    expect(impact).toBeCloseTo(8, 6);
    expect(car.z).toBeLessThanOrEqual(9 + 1e-9);
    expect(car.vz).toBeLessThanOrEqual(0);
    expect(car.vx).toBeGreaterThan(0);
    expect(car.heading).toBeLessThan(0.4); // nose deflected along the wall
  });

  it('works on the left wall too', () => {
    const car = createCar(carById('vela'), 0, -11, 0);
    car.vz = -6;
    expect(collideWithWalls(car, near(-11), 10)).toBeCloseTo(6, 6);
    expect(car.z).toBeGreaterThanOrEqual(-9 - 1e-9);
    expect(car.vz).toBeGreaterThanOrEqual(0);
  });
});
