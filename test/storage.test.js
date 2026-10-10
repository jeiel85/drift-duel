import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isUnlocked, loadSave, recordResult, sanitizeSave, writeSave } from '../src/game/storage.js';

const KEY = 'drift-duel:v1';

describe('sanitizeSave', () => {
  it('keeps valid fields', () => {
    const data = {
      best: { harbor: 61.2 },
      wins: 3,
      hardWins: 1,
      races: 7,
      muted: true,
      assist: false,
      haptics: false,
      last: { track: 'neon', car: 'dune', skill: 'hard' },
    };
    expect(sanitizeSave(data)).toEqual(data);
  });

  it('drops corrupted or wrongly typed values back to defaults', () => {
    const s = sanitizeSave({
      best: { harbor: 'fast', canyon: -3, neon: Infinity, ok: 40 },
      wins: '9',
      hardWins: 1.5,
      races: -2,
      muted: 'yes',
      assist: null,
      last: { track: 5, car: 'vela' },
      extra: { evil: true },
    });
    expect(s.best).toEqual({ ok: 40 });
    expect(s).toMatchObject({ wins: 0, hardWins: 0, races: 0, muted: false, assist: true, haptics: true });
    expect(s.last).toEqual({ car: 'vela' });
    expect(s).not.toHaveProperty('extra');
  });

  it.each([null, 42, 'text', [], { best: [] }])('survives non-object input %j', (input) => {
    const s = sanitizeSave(input);
    expect(s.best).toEqual({});
    expect(s.races).toBe(0);
  });
});

describe('loadSave / writeSave', () => {
  let store;
  beforeEach(() => {
    store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    };
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('round-trips a save', () => {
    const save = loadSave();
    recordResult(save, { trackId: 'harbor', time: 50, won: true, skill: 'hard' });
    expect(writeSave(save)).toBe(true);
    const again = loadSave();
    expect(again.best.harbor).toBe(50);
    expect(isUnlocked(again, { unlock: 'win-hard' })).toBe(true);
  });

  it('falls back to defaults on invalid JSON', () => {
    store.set(KEY, '{not json');
    expect(loadSave().races).toBe(0);
  });

  it('works when storage is unavailable', () => {
    globalThis.localStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(loadSave().races).toBe(0);
    expect(writeSave(loadSave())).toBe(false);
  });
});
