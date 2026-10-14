// Error observability without a backend: keep the last few runtime errors on the
// device and let the player file a pre-filled GitHub issue when something breaks.
// Nothing is sent anywhere unless the player opens the report link themselves.

import { t } from '../i18n.js';

export const ISSUE_URL = 'https://github.com/jeiel85/drift-duel/issues/new';
const MAX_ENTRIES = 5;
const MAX_BODY = 1800; // keep the URL well under browser/GitHub limits

function describe(err) {
  if (err instanceof Error) {
    return { message: err.message || err.name, stack: (err.stack ?? '').split('\n').slice(0, 4).join('\n') };
  }
  return { message: String(err ?? 'unknown error'), stack: '' };
}

export function createErrorLog() {
  const entries = [];
  return {
    entries,
    record(kind, err) {
      const { message, stack } = describe(err);
      entries.push({ kind, message: message.slice(0, 300), stack: stack.slice(0, 600) });
      if (entries.length > MAX_ENTRIES) entries.shift();
    },
    /** Capture uncaught errors and unhandled promise rejections from now on. */
    listen(target = window) {
      target.addEventListener('error', (e) => this.record('error', e.error ?? e.message));
      target.addEventListener('unhandledrejection', (e) => this.record('promise', e.reason));
    },
  };
}

/** Link to a new GitHub issue pre-filled with what the player was doing and the recent errors. */
export function buildReportUrl({ version, userAgent, context = {}, entries = [] }) {
  const lines = [
    t('report.what'),
    t('report.whatHint'),
    '',
    t('report.auto'),
    `- ${t('report.version')}: ${version}`,
    `- ${t('report.device')}: ${userAgent}`,
    ...Object.entries(context).map(([k, v]) => `- ${k}: ${v}`),
    '',
    t('report.recent'),
    ...(entries.length
      ? entries.map((e) => `- [${e.kind}] ${e.message}${e.stack ? `\n\`\`\`\n${e.stack}\n\`\`\`` : ''}`)
      : [`- ${t('report.none')}`]),
  ];
  let body = lines.join('\n');
  if (body.length > MAX_BODY) {
    const cut = `\n${t('report.cut')}`;
    body = `${body.slice(0, MAX_BODY - cut.length)}${cut}`;
  }
  const title = t('report.title', { msg: entries.at(-1)?.message.slice(0, 80) ?? t('report.untitled') });
  return `${ISSUE_URL}?${new URLSearchParams({ title, body, labels: 'bug' })}`;
}
