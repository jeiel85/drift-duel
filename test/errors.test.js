import { describe, expect, it } from 'vitest';
import { buildReportUrl, createErrorLog, ISSUE_URL } from '../src/game/errors.js';

describe('error log', () => {
  it('keeps only the most recent entries', () => {
    const log = createErrorLog();
    for (let i = 0; i < 8; i++) log.record('error', new Error(`boom ${i}`));
    expect(log.entries).toHaveLength(5);
    expect(log.entries[0].message).toBe('boom 3');
    expect(log.entries.at(-1).message).toBe('boom 7');
  });

  it('records non-Error rejections too', () => {
    const log = createErrorLog();
    log.record('promise', 'NotAllowedError');
    log.record('promise', undefined);
    expect(log.entries.map((e) => e.message)).toEqual(['NotAllowedError', 'unknown error']);
  });

  it('listens for uncaught errors and rejections', () => {
    const handlers = {};
    const target = { addEventListener: (t, fn) => (handlers[t] = fn) };
    const log = createErrorLog();
    log.listen(target);
    handlers.error({ error: new TypeError('x is undefined') });
    handlers.unhandledrejection({ reason: new Error('fetch failed') });
    expect(log.entries.map((e) => [e.kind, e.message])).toEqual([
      ['error', 'x is undefined'],
      ['promise', 'fetch failed'],
    ]);
  });
});

describe('buildReportUrl', () => {
  it('pre-fills a GitHub issue with version, device, context and errors', () => {
    const url = new URL(
      buildReportUrl({
        version: '0.2.1',
        userAgent: 'TestAgent/1.0',
        context: { 화면: 'race', 트랙: 'neon' },
        entries: [{ kind: 'frame', message: 'cannot read x', stack: 'at frame' }],
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(ISSUE_URL);
    expect(url.searchParams.get('title')).toBe('[버그] cannot read x');
    expect(url.searchParams.get('labels')).toBe('bug');
    const body = url.searchParams.get('body');
    for (const s of ['0.2.1', 'TestAgent/1.0', '트랙: neon', '[frame] cannot read x', 'at frame']) expect(body).toContain(s);
  });

  it('caps the body length so the link always works', () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({ kind: 'error', message: 'x'.repeat(300), stack: `s${i}`.repeat(200) }));
    const body = new URL(buildReportUrl({ version: '1', userAgent: 'ua', entries })).searchParams.get('body');
    expect(body.length).toBeLessThanOrEqual(1800 + 10);
    expect(body.endsWith('…(잘림)')).toBe(true);
  });

  it('works with no errors recorded', () => {
    const url = new URL(buildReportUrl({ version: '1', userAgent: 'ua' }));
    expect(url.searchParams.get('title')).toBe('[버그] 게임 오류');
    expect(url.searchParams.get('body')).toContain('(기록 없음)');
  });
});
