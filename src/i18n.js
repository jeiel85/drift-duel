/**
 * Game UI text in Korean and English. The language comes from ?lang=, then the
 * saved choice, then the browser languages (the first of Korean/English listed,
 * else English). Static markup carries data-i18n keys that applyStatic() fills;
 * code calls t(key, vars) when it builds text.
 */
export const LANGS = ['ko', 'en'];

const STRINGS = {
  ko: {
    'doc.title': 'Drift Duel — 플레이',

    'aria.pause': '일시정지',
    'aria.nitro': '니트로',
    'aria.mute': '소리 끄기/켜기',
    'aria.lang': 'Switch to English',
    'hud.nitroHint': '탭 · ↑스와이프',

    'guide.left': '꾹 누르면 왼쪽',
    'guide.right': '꾹 누르면 오른쪽',
    'guide.tap': '짧게 탭 = 살짝',
    'guide.nitro': '위로 쓸어올리기 = 니트로',
    'guide.more': '양쪽 동시에 누르기 = 브레이크 · GO 직전에 터치 = 출발 부스터',

    'menu.track': '트랙',
    'menu.car': '자동차',
    'menu.skill': '라이벌 난이도',
    'menu.assist': '주행 보조',
    'menu.assistSub': '스핀·벽 충돌 방지',
    'menu.haptics': '진동',
    'menu.hapticsSub': '충돌·드리프트·니트로',
    'menu.start': '레이스 시작',
    'menu.back': '← 소개 페이지',
    'menu.lang': 'English',
    'menu.laps': '{n}랩',
    'menu.rain': '빗길',
    'menu.best': '베스트 {t}',
    'menu.noRecord': '기록 없음',
    'menu.lock': '🔒 Hard 라이벌에게 1승',
    'stat.speed': '속도',
    'stat.accel': '가속',
    'stat.handling': '핸들링',
    'stat.drift': '드리프트',
    'hint.touch':
      '왼쪽/오른쪽 누르기 = 조향(짧게 탭하면 살짝) · 위로 쓸어올리기 = 니트로 · 양쪽 동시에 = 브레이크 · GO 직전 터치 = 출발 부스터 · 드리프트 후 코너를 빠져나오며 손을 떼면 순간 부스터 · 노란 화살표를 밟으면 대시',
    'hint.keys':
      '←/→ 또는 A/D 조향 · ↓ 브레이크 · Space 니트로 · P 일시정지 — 코너에서 꺾으면 드리프트, 드리프트로 니트로 충전 · GO 직전 ↑/Space = 출발 부스터 · 드리프트 후 코너를 빠져나오며 핸들을 풀면 순간 부스터 · 노란 화살표를 밟으면 대시',

    'pause.title': '일시정지',
    'pause.resume': '계속하기',
    'pause.restart': '다시 시작',
    'toMenu': '메뉴로',

    'res.win': '1위! 승리',
    'res.place': '{n}위',
    'res.sub': '{track} · {car} · 라이벌 {skill}',
    'res.time': '기록',
    'res.lap': '베스트 랩',
    'res.drift': '드리프트 점수',
    'res.combo': '최고 콤보',
    'res.again': '한 판 더',
    'res.newBest': '🏁 트랙 신기록!',
    'res.unlocked': '🔓 {car} 잠금 해제!',

    'pop.pad': '대시!',
    'pop.kick': '순간 부스터!',
    'pop.start': '출발 부스터!',
    'pop.early': '너무 빨라요!',
    'pop.respawn': '트랙으로 복귀',

    'gl.title': '그래픽 복구 중…',
    'gl.msg': '기기가 그래픽 메모리를 잠시 회수했어요. 복구되면 일시정지 상태로 이어져요.',
    'gl.reload': '새로고침',

    'err.title': '실행할 수 없어요',
    'err.restart': '다시 시작',
    'err.report': '문제 신고하기',
    'err.reportNote': '신고 버튼은 버전·브라우저·오류 내용이 채워진 GitHub 이슈 작성 화면을 열어요. 직접 제출하기 전에는 아무것도 전송되지 않아요.',
    'err.noWebgl': '이 브라우저나 기기에서 WebGL을 사용할 수 없어요. 최신 Chrome, Safari, Edge에서 다시 열어 주세요.',
    'err.crashTitle': '문제가 생겨 멈췄어요',
    'err.crashMsg': '게임 진행 중 오류가 발생했어요. 다시 시작하거나, 신고해 주시면 고칠게요.',

    'report.what': '### 무슨 일이 있었나요?',
    'report.whatHint': '(어떤 화면에서 무엇을 하다가 문제가 생겼는지 적어 주세요)',
    'report.auto': '### 자동 수집 정보',
    'report.version': '버전',
    'report.device': '기기/브라우저',
    'report.recent': '### 최근 오류',
    'report.none': '(기록 없음)',
    'report.cut': '…(잘림)',
    'report.title': '[버그] {msg}',
    'report.untitled': '게임 오류',
    'report.screen': '화면',
    'report.track': '트랙',
    'report.car': '차',
    'report.rival': '라이벌',
    'report.quality': '화질단계',
  },
  en: {
    'doc.title': 'Drift Duel — Play',

    'aria.pause': 'Pause',
    'aria.nitro': 'Nitro',
    'aria.mute': 'Sound on/off',
    'aria.lang': '한국어로 바꾸기',
    'hud.nitroHint': 'Tap · swipe ↑',

    'guide.left': 'Hold to steer left',
    'guide.right': 'Hold to steer right',
    'guide.tap': 'Quick tap = small nudge',
    'guide.nitro': 'Swipe up = nitro',
    'guide.more': 'Press both sides = brake · Touch just before GO = start boost',

    'menu.track': 'Track',
    'menu.car': 'Car',
    'menu.skill': 'Rival skill',
    'menu.assist': 'Driving assist',
    'menu.assistSub': 'Prevents spins and wall hits',
    'menu.haptics': 'Vibration',
    'menu.hapticsSub': 'Crashes · drifts · nitro',
    'menu.start': 'Start race',
    'menu.back': '← About the game',
    'menu.lang': '한국어',
    'menu.laps': '{n} laps',
    'menu.rain': 'wet',
    'menu.best': 'Best {t}',
    'menu.noRecord': 'No record yet',
    'menu.lock': '🔒 Beat a Hard rival once',
    'stat.speed': 'Speed',
    'stat.accel': 'Accel',
    'stat.handling': 'Handling',
    'stat.drift': 'Drift',
    'hint.touch':
      'Press left/right = steer (a quick tap nudges) · Swipe up = nitro · Both sides = brake · Touch just before GO = start boost · Let go as you exit a corner after a drift for a drift boost · Drive over the yellow arrows to dash',
    'hint.keys':
      '←/→ or A/D steer · ↓ brake · Space nitro · P pause — Turn hard into a corner to drift; drifting charges nitro · ↑/Space just before GO = start boost · Straighten up as you exit a corner after a drift for a drift boost · Drive over the yellow arrows to dash',

    'pause.title': 'Paused',
    'pause.resume': 'Resume',
    'pause.restart': 'Restart',
    'toMenu': 'Menu',

    'res.win': '1st place! You win',
    'res.place': 'Finished #{n}',
    'res.sub': '{track} · {car} · {skill} rival',
    'res.time': 'Time',
    'res.lap': 'Best lap',
    'res.drift': 'Drift score',
    'res.combo': 'Best combo',
    'res.again': 'Race again',
    'res.newBest': '🏁 New track record!',
    'res.unlocked': '🔓 {car} unlocked!',

    'pop.pad': 'DASH!',
    'pop.kick': 'DRIFT BOOST!',
    'pop.start': 'START BOOST!',
    'pop.early': 'Too early!',
    'pop.respawn': 'Back on track',

    'gl.title': 'Restoring graphics…',
    'gl.msg': 'Your device briefly took back its graphics memory. The race resumes paused once it is restored.',
    'gl.reload': 'Reload',

    'err.title': 'The game can’t run',
    'err.restart': 'Restart',
    'err.report': 'Report a problem',
    'err.reportNote': 'The report button opens a GitHub issue form pre-filled with the version, browser and error details. Nothing is sent until you submit it yourself.',
    'err.noWebgl': 'WebGL is not available in this browser or on this device. Please open the game in a recent Chrome, Safari or Edge.',
    'err.crashTitle': 'Something went wrong',
    'err.crashMsg': 'An error stopped the game. Restart, or report it so it can be fixed.',

    'report.what': '### What happened?',
    'report.whatHint': '(Which screen were you on, and what were you doing when the problem appeared?)',
    'report.auto': '### Collected automatically',
    'report.version': 'Version',
    'report.device': 'Device/browser',
    'report.recent': '### Recent errors',
    'report.none': '(none recorded)',
    'report.cut': '…(truncated)',
    'report.title': '[Bug] {msg}',
    'report.untitled': 'Game error',
    'report.screen': 'Screen',
    'report.track': 'Track',
    'report.car': 'Car',
    'report.rival': 'Rival',
    'report.quality': 'Quality level',
  },
};

const LANG_KEY = 'drift-duel:lang';

/** Picks the language from a ?lang= value, a saved choice and the browser's language list. */
export function pickLang(param, saved, browserLangs = []) {
  if (LANGS.includes(param)) return param;
  if (LANGS.includes(saved)) return saved;
  for (const l of browserLangs) {
    const base = String(l).toLowerCase().slice(0, 2);
    if (LANGS.includes(base)) return base;
  }
  return 'en';
}

let lang = 'en';
if (typeof window !== 'undefined') {
  let saved = null;
  try {
    saved = localStorage.getItem(LANG_KEY);
  } catch {
    // Storage blocked (private mode, some embedding iframes): fall back to the browser language.
  }
  lang = pickLang(new URLSearchParams(location.search).get('lang'), saved, navigator.languages || [navigator.language]);
}

export const getLang = () => lang;

/** For tests: switch the language served by t(). */
export function setLang(l) {
  if (LANGS.includes(l)) lang = l;
}

/**
 * Saves the choice; the caller reloads so every built string follows.
 * Returns false when storage is blocked (some embedding iframes), so the
 * caller can carry the choice across the reload in ?lang= instead.
 */
export function saveLang(l) {
  if (!LANGS.includes(l)) return false;
  try {
    localStorage.setItem(LANG_KEY, l);
    return true;
  } catch {
    return false;
  }
}

/** Text for `key` with {name} placeholders filled from `vars`. */
export function t(key, vars) {
  let s = STRINGS[lang][key] ?? STRINGS.ko[key];
  if (s === undefined) throw new Error(`missing UI string: ${key}`);
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

/** Fills data-i18n (text) and data-i18n-attr ("attr:key;…") in the page. */
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  document.title = t('doc.title');
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr, t(key));
    }
  }
}

/** For tests: the tables themselves. */
export const STRING_TABLES = STRINGS;
