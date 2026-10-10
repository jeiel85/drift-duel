// Per-device progress in localStorage. Storage can be unavailable (private
// mode, blocked site data), so every access falls back to in-memory defaults.

const KEY = 'drift-duel:v1';

const defaults = () => ({ best: {}, wins: 0, hardWins: 0, races: 0, muted: false, assist: true, haptics: true, last: {} });

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    return defaults();
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
