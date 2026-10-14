import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LANGS, pickLang, setLang, STRING_TABLES, t } from '../src/i18n.js';

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const HANGUL = /[가-힣]/;

/** Every key the markup and the code ask for. */
function usedKeys() {
  const used = new Set(['doc.title']); // applyStatic() sets the document title
  const html = readFileSync('play.html', 'utf8');
  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) used.add(m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) for (const pair of m[1].split(';')) used.add(pair.split(':')[1]);
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
  for (const file of walk('src').filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(file, 'utf8');
    // t('key') and t(cond ? 'a.key' : 'b.key')
    for (const m of src.matchAll(/\bt\(\s*(?:[^'()]*\?\s*)?'([\w.]+)'(?:\s*:\s*'([\w.]+)')?/g)) {
      used.add(m[1]);
      if (m[2]) used.add(m[2]);
    }
  }
  return used;
}

describe('i18n', () => {
  afterEach(() => setLang('en'));

  it('picks ?lang= over the saved choice over the browser list', () => {
    expect(pickLang('en', 'ko', ['ko-KR'])).toBe('en');
    expect(pickLang(null, 'ko', ['en-US'])).toBe('ko');
    expect(pickLang('xx', 'yy', ['ko-KR', 'en'])).toBe('ko');
    expect(pickLang(null, null, ['fr-FR', 'en-GB', 'ko'])).toBe('en');
    expect(pickLang(null, null, ['ja-JP'])).toBe('en');
    expect(pickLang(null, null, [])).toBe('en');
  });

  it('has the same keys and placeholders in Korean and English', () => {
    expect(Object.keys(STRING_TABLES.en).sort()).toEqual(Object.keys(STRING_TABLES.ko).sort());
    for (const key of Object.keys(STRING_TABLES.ko)) {
      expect(placeholders(STRING_TABLES.en[key]), key).toEqual(placeholders(STRING_TABLES.ko[key]));
    }
  });

  it('keeps Korean out of the English table (except the switch back to Korean)', () => {
    const korean = Object.entries(STRING_TABLES.en).filter(([k, v]) => HANGUL.test(v) && !['menu.lang', 'aria.lang'].includes(k));
    expect(korean).toEqual([]);
  });

  it('defines every key the markup and the code use, and nothing unused', () => {
    const used = usedKeys();
    const known = new Set(Object.keys(STRING_TABLES.ko));
    expect([...used].filter((k) => !known.has(k))).toEqual([]);
    expect([...known].filter((k) => !used.has(k))).toEqual([]);
    expect(used.size).toBeGreaterThan(60);
  });

  it('leaves no hard-coded Korean in the game page or game code', () => {
    const files = ['play.html', 'src/play.js', ...readdirSync('src/game').map((f) => `src/game/${f}`)];
    const hits = [];
    for (const f of files) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (HANGUL.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) hits.push(`${f}:${i + 1}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it('fills placeholders and serves both languages', () => {
    expect(t('menu.laps', { n: 3 })).toBe('3 laps');
    expect(t('res.unlocked', { car: 'Zenith R' })).toBe('🔓 Zenith R unlocked!');
    expect(t('res.sub', { track: 'Neon Rain' })).toBe('Neon Rain · {car} · {skill} rival');
    setLang('ko');
    expect(t('menu.laps', { n: 3 })).toBe('3랩');
    expect(() => t('no.such.key')).toThrow();
    expect(LANGS).toEqual(['ko', 'en']);
  });
});
