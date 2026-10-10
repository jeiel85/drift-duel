// Per-device progress in localStorage. Storage can be unavailable (private
// mode, blocked site data), so every access falls back to in-memory defaults.

const KEY = 'drift-duel:v1';

const defaults = () => ({ best: {}, wins: 0, hardWins: 0, races: 0, muted: false, assist: true, haptics: true, last: {} });

const isCount = (v) => Number.isInteger(v) && v >= 0;
const isTime = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * Keep only well-formed fields from stored data. Anything corrupted, edited by
 * hand or written by an older/newer version falls back to its default, so a bad
 * value can never break the menu or a race.
 */
export function sanitizeSave(data) {
  const save = defaults();
  if (!data || typeof data !== 'object' || Array.isArray(data)) return save;
  if (data.best && typeof data.best === 'object' && !Array.isArray(data.best)) {
    for (const [track, time] of Object.entries(data.best)) if (isTime(time)) save.best[track] = time;
  }
  for (const k of ['wins', 'hardWins', 'races']) if (isCount(data[k])) save[k] = data[k];
  for (const k of ['muted', 'assist', 'haptics']) if (typeof data[k] === 'boolean') save[k] = data[k];
  if (data.last && typeof data.last === 'object' && !Array.isArray(data.last)) {
    for (const k of ['track', 'car', 'skill']) if (typeof data.last[k] === 'string') save.last[k] = data.last[k];
  }
  return save;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return sanitizeSave(JSON.parse(raw));
  } catch {
    return defaults(); // unreadable storage or invalid JSON
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false; // progress for this session only
  }
}

/** Record a finished race. Returns { newBest, unlocked } for the results screen. */
export function recordResult(save, { trackId, time, won, skill }) {
  save.races += 1;
  const prev = save.best[trackId];
  const newBest = prev == null || time < prev;
  if (newBest) save.best[trackId] = time;
  let unlocked = null;
  if (won) {
    save.wins += 1;
    if (skill === 'hard') {
      if (save.hardWins === 0) unlocked = 'zenith';
      save.hardWins += 1;
    }
  }
  return { newBest, unlocked };
}

export function isUnlocked(save, car) {
  if (!car.unlock) return true;
  if (car.unlock === 'win-hard') return save.hardWins > 0;
  return false;
}
