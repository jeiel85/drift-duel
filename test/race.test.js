import { describe, expect, it } from 'vitest';
import { botInput, SKILLS } from '../src/game/ai.js';
import { CARS, carById } from '../src/game/cars.js';
import { createCar } from '../src/game/physics.js';
import {
  createDriftState,
  createEntrant,
  gridPosition,
  rank,
  stepEntrant,
  updateDrift,
  updateProgress,
} from '../src/game/race.js';
import { buildTrack } from '../src/game/track.js';
import { TRACKS } from '../src/game/tracks.js';

const DT = 1 / 120;

describe('progress and laps', () => {
  const track = buildTrack(TRACKS[0]);
  const entrantAt = (s) => {
    const p = track.pointAt(s);
    return createEntrant(createCar(carById('vela'), p.x, p.z, p.heading), track, { name: 'p' });
  };
  const moveTo = (e, s, time, laps = 2) => {
    const p = track.pointAt(s);
    e.near = track.nearest(p.x, p.z, e.near.index);
    updateProgress(e, track, time, laps);
  };

  it('starts slightly negative when placed behind the line', () => {
    expect(entrantAt(track.length - 10).progress).toBeCloseTo(-10, 0);
  });

  it('counts a lap only after a full loop and finishes after the last one', () => {
    const e = entrantAt(track.length - 10);
    let time = 0;
    for (let lap = 0; lap < 2; lap++) {
      for (let s = 0; s <= track.length; s += 20) moveTo(e, s, (time += 1));
    }
    moveTo(e, 15, (time += 1));
    expect(e.lapsDone).toBe(2);
    expect(e.finished).toBe(true);
    expect(e.lapTimes).toHaveLength(2);
  });

  it('crossing the line backwards does not count', () => {
    const e = entrantAt(20);
    for (let s = 20; s >= -200; s -= 10) moveTo(e, s, 1);
    for (let s = -200; s <= 30; s += 10) moveTo(e, s, 2);
    expect(e.lapsDone).toBe(0);
  });

  it('ranks finished entrants by time, then the rest by progress', () => {
    const a = { finished: false, progress: 500 };
    const b = { finished: true, finishTime: 90, progress: 0 };
    const c = { finished: true, finishTime: 80, progress: 0 };
    const d = { finished: false, progress: 700 };
    expect(rank([a, b, c, d])).toEqual([c, b, d, a]);
  });
});

describe('drift scoring', () => {
  const sliding = () => ({ drifting: true, slip: 0.5, speed: 30, nitro: 0, spec: carById('vela') });

  it('builds a chain while sliding and banks it after a pause', () => {
    const d = createDriftState();
    const car = sliding();
    for (let t = 0; t < 2; t += DT) expect(updateDrift(d, car, DT, 0)).toBeNull();
    expect(d.chain).toBeGreaterThan(0);
    expect(d.multiplier).toBeGreaterThan(1);
    expect(car.nitro).toBeGreaterThan(0);
    car.drifting = false;
    let event = null;
    for (let t = 0; t < 1 && !event; t += DT) event = updateDrift(d, car, DT, 0);
    expect(event?.type).toBe('bank');
    expect(d.total).toBe(event.points);
  });

  it('a hard wall hit wipes the current chain', () => {
    const d = createDriftState();
    const car = sliding();
    for (let t = 0; t < 1; t += DT) updateDrift(d, car, DT, 0);
    const event = updateDrift(d, car, DT, 10);
    expect(event?.type).toBe('crash');
    expect(d.chain).toBe(0);
    expect(d.total).toBe(0);
  });
});

// The rival uses the same physics as the player, so this doubles as an
// end-to-end check that every track is drivable with every car.
describe.each(TRACKS)('rival on $id', (def) => {
  const track = buildTrack(def);
  const raceBot = (skillKey, spec) => {
    const g = gridPosition(track, 1);
    const e = createEntrant(createCar(spec, g.x, g.z, g.heading), track, { name: 'bot', isBot: true });
    let time = 0;
    let hardHits = 0;
    while (!e.finished && time < 300) {
      stepEntrant(e, botInput(e, track, SKILLS[skillKey]), DT, track, { gripMul: def.gripMul }, time, def.laps);
      if (e.impact > 6) hardHits++;
      time += DT;
    }
    return { e, hardHits };
  };

  it.each(CARS.map((c) => c.id))('finishes cleanly on hard with %s', (id) => {
    const { e, hardHits } = raceBot('hard', carById(id));
    expect(e.finished).toBe(true);
    expect(hardHits).toBeLessThanOrEqual(2);
  });

  it('easy is clearly slower than hard', () => {
    const easy = raceBot('easy', carById('vela')).e.finishTime;
    const hard = raceBot('hard', carById('vela')).e.finishTime;
    expect(easy).toBeGreaterThan(hard * 1.08);
  });
});
