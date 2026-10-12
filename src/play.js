import * as THREE from 'three';
import { botInput, SKILLS } from './game/ai.js';
import { createAudio } from './game/audio.js';
import { CARS, carById } from './game/cars.js';
import { enterFullscreen, haptic, isNative, keepAwake, onBackButton, setHaptics } from './game/device.js';
import { buildReportUrl, createErrorLog } from './game/errors.js';
import { createInput } from './game/input.js';
import { damp, wrapAngle } from './game/math.js';
import { createCar, NITRO_MIN } from './game/physics.js';
import { createEntrant, gridPosition, rank, stepEntrant } from './game/race.js';
import { isUnlocked, loadSave, recordResult, writeSave } from './game/storage.js';
import { buildTrack } from './game/track.js';
import { TRACKS } from './game/tracks.js';
import { createCarMesh } from './render/carMesh.js';
import { createSkids, createSmoke, createSpeedLines } from './render/effects.js';
import { buildWorld } from './render/world.js';

const $ = (sel) => document.querySelector(sel);
const FIXED_DT = 1 / 120;
const RIVAL_COLOR = 0xf72585;
const COUNTDOWN = 3;

// Runtime errors are kept on the device; the player can file them from the error screen.
const errorLog = createErrorLog();
errorLog.listen();
// Wired before anything can fail, so the error screen's restart works even if startup aborts.
$('#btn-reload').addEventListener('click', () => location.reload());

// ---------------------------------------------------------------- renderer
const canvas = $('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  fatal('이 브라우저나 기기에서 WebGL을 사용할 수 없어요. 최신 Chrome, Safari, Edge에서 다시 열어 주세요.', err);
}
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed in three r18x
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 1500);
const embedded = new URLSearchParams(location.search).get('embed') === '1';
const coarse = window.matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('embed', embedded);
document.body.classList.toggle('native', isNative());
// iOS Safari ignores user-scalable=no; block pinch zoom during play explicitly.
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Adaptive quality: phones start at a lower pixel ratio, and if the frame rate
// stays low the game steps down (resolution, then shadows) instead of stuttering.
const QUALITY = [
  { ratio: Math.min(window.devicePixelRatio, coarse ? 1.5 : 2), shadows: true },
  { ratio: Math.min(window.devicePixelRatio, 1), shadows: true },
  { ratio: Math.min(window.devicePixelRatio, 0.75), shadows: false },
];
let quality = 0;
const perf = { time: 0, frames: 0 };
function applyQuality() {
  renderer.setPixelRatio(QUALITY[quality].ratio);
  resize();
  session?.world.setShadows(QUALITY[quality].shadows);
}
function watchPerformance(dt) {
  perf.time += dt;
  perf.frames++;
  if (perf.time < 2.5) return;
  const avg = perf.time / perf.frames;
  perf.time = 0;
  perf.frames = 0;
  if (avg > 1 / 40 && quality < QUALITY.length - 1) {
    quality++;
    applyQuality();
  }
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  // Portrait phones need a wider, higher view to see the road ahead.
  camera.userData.portrait = camera.aspect < 0.8;
  camera.userData.baseFov = camera.userData.portrait ? 72 : 62;
  camera.updateProjectionMatrix();
  document.body.classList.toggle('compact', embedded || window.innerWidth < 600 || window.innerHeight < 560);
}
window.addEventListener('resize', resize);
renderer.setPixelRatio(QUALITY[0].ratio);
resize();

/** What the player was doing, for bug reports. Safe to call before state exists. */
function reportContext() {
  try {
    return { 화면: mode, 트랙: TRACKS[sel.track]?.id, 차: sel.car, 라이벌: sel.skill, 화질단계: quality };
  } catch {
    return { 화면: 'startup' };
  }
}

function showError(title, msg, err) {
  if (err) errorLog.record('fatal', err);
  $('#error-title').textContent = title;
  $('#error-msg').textContent = msg;
  $('#btn-report').href = buildReportUrl({
    version: __APP_VERSION__,
    userAgent: navigator.userAgent,
    context: reportContext(),
    entries: errorLog.entries,
  });
  for (const id of ['#menu', '#hud', '#pause', '#results', '#gl-lost']) $(id).hidden = true;
  $('#error').hidden = false;
}

function fatal(msg, err) {
  showError('실행할 수 없어요', msg, err);
  throw err ?? new Error(msg);
}

// ---------------------------------------------------------------- state
const save = loadSave();
const params = new URLSearchParams(location.search);
const sel = {
  track: TRACKS.findIndex((t) => t.id === (params.get('track') ?? save.last.track)),
  car: params.get('car') ?? save.last.car ?? 'vela',
  skill: params.get('skill') ?? save.last.skill ?? 'normal',
};
if (sel.track < 0) sel.track = 0;
if (!CARS.some((c) => c.id === sel.car) || !isUnlocked(save, carById(sel.car))) sel.car = 'vela';
if (!SKILLS[sel.skill]) sel.skill = 'normal';

const audio = createAudio();
audio.setMuted(!!save.muted);
setHaptics(save.haptics);

const input = createInput({
  touchLayer: $('#touch'),
  nitroButton: $('#btn-nitro'),
  onPause: () => (mode === 'race' || mode === 'countdown' ? pause() : mode === 'paused' ? resume() : null),
});

/** 'menu' (attract demo) | 'countdown' | 'race' | 'paused' | 'results' */
let mode = 'menu';
let pausedFrom = null;
let session = null;
const trackCache = new Map();
const skids = createSkids(scene);
const smoke = createSmoke(scene);
const speedLines = createSpeedLines(scene);

function trackFor(def) {
  if (!trackCache.has(def.id)) trackCache.set(def.id, buildTrack(def));
  return trackCache.get(def.id);
}

function newSession({ attract }) {
  const def = TRACKS[sel.track];
  const track = trackFor(def);
  if (!session || session.def.id !== def.id) {
    session?.world.dispose();
    session = { def, track, world: buildWorld(scene, track, def, { shadows: QUALITY[quality].shadows }) };
  }
  for (const m of session.meshes ?? []) {
    scene.remove(m.object);
    m.dispose();
  }
  skids.clear();
  smoke.clear();
  speedLines.clear();

  const spec = carById(sel.car);
  const rivalSpec = { ...spec, id: 'rival', name: 'Rival', color: RIVAL_COLOR, accent: 0x111111 };
  const g0 = gridPosition(track, 0);
  const g1 = gridPosition(track, 1);
  const player = createEntrant(createCar(spec, g0.x, g0.z, g0.heading), track, { name: 'YOU', isBot: attract });
  const rival = createEntrant(createCar(rivalSpec, g1.x, g1.z, g1.heading), track, { name: 'RIVAL', isBot: true });
  const entrants = [player, rival];
  const meshes = entrants.map((e) => {
    const m = createCarMesh(e.car.spec);
    scene.add(m.object);
    m.update(e.car, 0, 0);
    return m;
  });
  Object.assign(session, {
    entrants,
    meshes,
    player,
    rival,
    attract,
    laps: attract ? Infinity : def.laps,
    raceTime: 0,
    countdown: COUNTDOWN,
    smokeTimer: 0,
    shake: 0,
  });
  snapCamera = true;
  nitroLatched = false;
}

// ---------------------------------------------------------------- simulation
const IDLE = { steer: 0, throttle: 0, brake: 0, nitro: false };
let nitroLatched = false;

/** Touch nitro is a tap: it latches the boost on until the tank runs dry (tap again to stop). */
function playerInput(car) {
  const r = input.read();
  if (r.nitroTap) {
    if (nitroLatched) nitroLatched = false;
    else if (car.nitro >= NITRO_MIN) {
      nitroLatched = true;
      haptic(25);
    } else haptic([8, 40, 8]); // not charged yet
  }
  if (nitroLatched && !car.boosting && car.nitro < NITRO_MIN) nitroLatched = false;
  return { steer: r.steer, throttle: r.throttle, brake: r.brake, nitro: r.nitroHeld || nitroLatched };
}

function simStep(dt) {
  const s = session;
  const botEnv = { gripMul: s.def.gripMul };
  const playerEnv = { gripMul: s.def.gripMul, assist: save.assist };
  for (const e of s.entrants) {
    let inp;
    const human = e === s.player && !e.isBot && !e.finished;
    if (mode === 'countdown') inp = IDLE;
    else if (!human) inp = botInput(e, s.track, SKILLS[e === s.rival ? sel.skill : 'normal']);
    else inp = playerInput(e.car);
    const lapsBefore = e.lapsDone;
    const ev = stepEntrant(e, inp, dt, s.track, human ? playerEnv : botEnv, s.raceTime, s.laps);
    if (e === s.player && !s.attract) {
      if (ev) driftEvent(ev);
      if (e.impact > 6) haptic(Math.min(60, 15 + e.impact * 3));
      if (e.lapsDone > lapsBefore && !e.finished) haptic(20);
      if (e.respawned) {
        hud.pop.textContent = '트랙으로 복귀';
        hud.pop.className = 'drift-pop show reset';
        popTimer = 1.2;
        haptic(30);
      }
    }
    if (e === s.player && e.impact > 3) s.shake = Math.min(1, s.shake + e.impact * 0.06);
  }
  if (mode === 'race') {
    s.raceTime += dt;
    if (s.player.finished) finishRace();
  }
}

// ---------------------------------------------------------------- camera
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
let snapCamera = true;

// Players who ask the OS for less motion get no speed rumble or wind streaks.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function updateCamera(car, dt, time) {
  const vdir = car.speed > 3 ? Math.atan2(car.vz, car.vx) : car.heading;
  const dir = car.heading + wrapAngle(vdir - car.heading) * 0.55;
  const portrait = camera.userData.portrait;
  // 0 at rest, 1 at top speed (above 1 on nitro). Drives the speed cues below.
  const pace = car.speed / car.spec.maxSpeed;
  // Low and close: the road rushing under the camera sells speed far better than
  // pulling back, so the chase distance barely grows with speed.
  const dist = (portrait ? 9.5 : 7) + car.speed * 0.03;
  const height = (portrait ? 4.8 : 2.8) + car.speed * 0.01;
  const want = new THREE.Vector3(car.x - Math.cos(dir) * dist, height, car.z - Math.sin(dir) * dist);
  const ahead = 6 + car.speed * 0.15;
  const look = new THREE.Vector3(car.x + Math.cos(car.heading) * ahead, 1.1, car.z + Math.sin(car.heading) * ahead);
  if (snapCamera) {
    camPos.copy(want);
    camLook.copy(look);
    snapCamera = false;
  } else {
    // A looser follow on nitro lets the car surge away from the camera.
    camPos.lerp(want, damp(car.boosting ? 4.5 : 6, dt));
    camLook.lerp(look, damp(10, dt));
  }
  camera.position.copy(camPos);
  const sh = session.shake;
  if (sh > 0) {
    camera.position.x += Math.sin(time * 71) * sh * 0.4;
    camera.position.y += Math.sin(time * 53) * sh * 0.3;
    session.shake = Math.max(0, sh - dt * 2.5);
  }
  if (!reducedMotion && pace > 0.5) {
    // Road rumble that builds toward top speed.
    const rumble = (pace - 0.5) * (car.boosting ? 0.09 : 0.05);
    camera.position.y += Math.sin(time * 97) * rumble;
    camera.position.x += Math.sin(time * 83 + 1.3) * rumble * 0.6;
  }
  camera.lookAt(camLook);
  const fov = camera.userData.baseFov + Math.min(pace, 1.3) * 14 + (car.boosting ? 6 : 0);
  camera.fov += (fov - camera.fov) * damp(car.boosting ? 6 : 4, dt);
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- effects
const wheelPos = [new THREE.Vector3(), new THREE.Vector3()];

function updateEffects(dt) {
  const s = session;
  s.smokeTimer += dt;
  const puff = s.smokeTimer > 0.035;
  if (puff) s.smokeTimer = 0;
  s.entrants.forEach((e, i) => {
    const car = e.car;
    const sliding = car.drifting && Math.abs(car.slip) > 0.15 && car.speed > 8;
    s.meshes[i].rearWheels(wheelPos);
    wheelPos.forEach((p, w) => {
      const key = i * 2 + w;
      if (sliding) {
        skids.add(key, p);
        if (puff) smoke.emit(p, car.vx, car.vz, Math.min(1, Math.abs(car.slip) * 1.6));
      } else skids.lift(key);
    });
  });
  smoke.update(dt);
  const car = s.player.car;
  speedLines.update(car, car.speed / car.spec.maxSpeed, !reducedMotion && mode !== 'menu', dt);
}

// ---------------------------------------------------------------- HUD
const hud = {
  pos: $('#hud-pos'),
  lap: $('#hud-lap'),
  time: $('#hud-time'),
  speed: $('#hud-speed'),
  drift: $('#hud-drift'),
  gap: $('#hud-gap'),
  nitroFill: $('#nitro-fill'),
  nitroBtn: $('#btn-nitro'),
  pop: $('#drift-pop'),
};
let popTimer = 0;

function formatTime(t) {
  if (t == null || !isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

function driftEvent(ev) {
  if (ev.type === 'bank') {
    hud.pop.textContent = `+${ev.points.toLocaleString()}`;
    hud.pop.className = 'drift-pop show bank';
    haptic(12);
  } else {
    hud.pop.textContent = `CRASH −${ev.lost.toLocaleString()}`;
    hud.pop.className = 'drift-pop show crash';
  }
  popTimer = 1.1;
}

function updateHud(dt) {
  const s = session;
  const p = s.player;
  const car = p.car;
  const order = rank(s.entrants);
  hud.pos.textContent = `${order.indexOf(p) + 1}/${s.entrants.length}`;
  hud.lap.textContent = `${Math.min(p.lapsDone + 1, s.laps)}/${s.laps}`;
  hud.time.textContent = formatTime(s.raceTime);
  hud.speed.textContent = Math.round(car.speed * 3.6);
  hud.drift.textContent = p.drift.total.toLocaleString();
  const gap = p.progress - s.rival.progress;
  hud.gap.textContent = mode === 'race' ? `RIVAL ${gap >= 0 ? '−' : '+'}${Math.abs(gap).toFixed(0)}m` : '';
  hud.gap.classList.toggle('ahead', gap >= 0);
  hud.nitroFill.style.transform = `scaleY(${car.nitro})`;
  hud.nitroBtn.classList.toggle('ready', car.nitro >= NITRO_MIN);
  hud.nitroBtn.classList.toggle('active', car.boosting);
  hud.nitroBtn.classList.toggle('full', car.nitro >= 0.999);

  const d = p.drift;
  if (d.chain > 0) {
    hud.pop.textContent = `DRIFT ${Math.round(d.chain).toLocaleString()}${d.multiplier > 1 ? ` ×${d.multiplier}` : ''}`;
    hud.pop.className = 'drift-pop show live';
    popTimer = 0.3;
  } else if (popTimer > 0) {
    popTimer -= dt;
    if (popTimer <= 0) hud.pop.className = 'drift-pop';
  }

  const sides = input.sides();
  $('#touch .left').classList.toggle('held', sides.left);
  $('#touch .right').classList.toggle('held', sides.right);
}

// ---------------------------------------------------------------- flow
function show(id, on) {
  $(id).hidden = !on;
}

function startRace() {
  audio.start();
  if (coarse && !embedded) enterFullscreen();
  keepAwake(true);
  save.last = { track: TRACKS[sel.track].id, car: sel.car, skill: sel.skill };
  writeSave(save);
  newSession({ attract: false });
  input.reset();
  goTimer = 0; // a restart right after "GO!" must not hide the new countdown
  mode = 'countdown';
  show('#menu', false);
  show('#results', false);
  show('#pause', false);
  show('#hud', true);
  document.body.classList.add('racing');
  $('#countdown').hidden = false;
  // Show the touch guide during the countdown of the first few races.
  $('#touch-guide').hidden = !(coarse && save.races < 5);
}

function finishRace() {
  const s = session;
  mode = 'results';
  const place = rank(s.entrants).indexOf(s.player) + 1;
  const won = place === 1;
  const { newBest, unlocked } = recordResult(save, {
    trackId: s.def.id,
    time: s.player.finishTime,
    won,
    skill: sel.skill,
  });
  writeSave(save);

  $('#res-title').textContent = won ? '1위! 승리' : `${place}위`;
  $('#res-sub').textContent = `${s.def.name} · ${carById(sel.car).name} · 라이벌 ${SKILLS[sel.skill].label}`;
  $('#res-time').textContent = formatTime(s.player.finishTime);
  $('#res-lap').textContent = formatTime(Math.min(...s.player.lapTimes));
  $('#res-drift').textContent = s.player.drift.total.toLocaleString();
  $('#res-combo').textContent = s.player.drift.best.toLocaleString();
  const badges = [];
  if (newBest) badges.push('🏁 트랙 신기록!');
  if (unlocked) badges.push(`🔓 ${carById(unlocked).name} 잠금 해제!`);
  $('#res-badge').hidden = badges.length === 0;
  $('#res-badge').textContent = badges.join('  ');
  show('#hud', false);
  show('#results', true);
  document.body.classList.remove('racing');
  keepAwake(false);
  haptic(won ? [30, 60, 30, 60, 60] : 40);
}

function pause() {
  if (mode !== 'race' && mode !== 'countdown') return;
  pausedFrom = mode;
  mode = 'paused';
  audio.suspend();
  show('#pause', true);
}

function resume() {
  if (mode !== 'paused') return;
  mode = pausedFrom;
  audio.start();
  input.reset();
  show('#pause', false);
}

function toMenu() {
  mode = 'menu';
  show('#pause', false);
  show('#results', false);
  show('#hud', false);
  $('#countdown').hidden = true;
  document.body.classList.remove('racing');
  keepAwake(false);
  renderMenu();
  newSession({ attract: true });
  show('#menu', true);
}

// Android back button (native app): pause a race, close overlays, then leave.
onBackButton(() => {
  if (mode === 'race' || mode === 'countdown') pause();
  else if (mode === 'paused') resume();
  else if (mode === 'results') toMenu();
  else import('@capacitor/app').then(({ App }) => App.exitApp());
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});

// ---------------------------------------------------------------- menu
function statBar(label, v) {
  return `<span class="stat"><i>${label}</i><b style="--v:${Math.round(v * 100)}%"></b></span>`;
}

function renderMenu() {
  $('#track-list').innerHTML = TRACKS.map((t, i) => {
    const best = save.best[t.id];
    return `<button class="card ${i === sel.track ? 'on' : ''}" data-track="${i}">
      <strong>${t.name}</strong>
      <span>${t.difficulty} · ${t.laps}랩${t.theme.weather === 'rain' ? ' · 빗길' : ''}</span>
      <em>${best ? `베스트 ${formatTime(best)}` : '기록 없음'}</em>
    </button>`;
  }).join('');

  $('#car-list').innerHTML = CARS.map((c) => {
    const open = isUnlocked(save, c);
    return `<button class="card car ${c.id === sel.car ? 'on' : ''}" data-car="${c.id}" ${open ? '' : 'disabled'}>
      <span class="swatch" style="--c:#${c.color.toString(16).padStart(6, '0')}"></span>
      <strong>${c.name}</strong>
      <span>${c.class}</span>
      ${statBar('속도', (c.maxSpeed - 34) / 16)}
      ${statBar('가속', (c.accel - 12) / 9)}
      ${statBar('핸들링', (c.turnRate - 1.4) / 0.5)}
      ${statBar('드리프트', (c.nitroGain - 0.8) / 0.4)}
      ${open ? '' : '<em class="lock">🔒 Hard 라이벌에게 1승</em>'}
    </button>`;
  }).join('');

  $('#skill-list').innerHTML = Object.entries(SKILLS)
    .map(([k, v]) => `<button class="${k === sel.skill ? 'on' : ''}" data-skill="${k}">${v.label}</button>`)
    .join('');

  $('#btn-mute').textContent = audio.muted ? '🔇' : '🔊';
  for (const [id, on] of [['#opt-assist', save.assist], ['#opt-haptics', save.haptics]]) {
    $(id).classList.toggle('on', on);
    $(id).setAttribute('aria-pressed', String(on));
  }
}

$('#track-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-track]');
  if (!b) return;
  sel.track = Number(b.dataset.track);
  renderMenu();
  newSession({ attract: true });
});
$('#car-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-car]');
  if (!b || b.disabled) return;
  sel.car = b.dataset.car;
  renderMenu();
  newSession({ attract: true });
});
$('#skill-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-skill]');
  if (!b) return;
  sel.skill = b.dataset.skill;
  renderMenu();
});
$('#btn-mute').addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  save.muted = audio.muted;
  writeSave(save);
  renderMenu();
});
$('#opt-assist').addEventListener('click', () => {
  save.assist = !save.assist;
  writeSave(save);
  renderMenu();
});
$('#opt-haptics').addEventListener('click', () => {
  save.haptics = !save.haptics;
  setHaptics(save.haptics);
  writeSave(save);
  renderMenu();
  haptic(20);
});
$('#btn-start').addEventListener('click', startRace);
$('#btn-pause').addEventListener('click', pause);
$('#btn-resume').addEventListener('click', resume);
$('#btn-restart').addEventListener('click', startRace);
$('#btn-quit').addEventListener('click', toMenu);
$('#btn-again').addEventListener('click', startRace);
$('#btn-menu').addEventListener('click', toMenu);

$('#controls-hint').textContent = coarse
  ? '왼쪽/오른쪽 누르기 = 조향(짧게 탭하면 살짝) · 위로 쓸어올리기 = 니트로 · 양쪽 동시에 = 브레이크'
  : '←/→ 또는 A/D 조향 · ↓ 브레이크 · Space 니트로 · P 일시정지 — 코너에서 꺾으면 드리프트, 드리프트로 니트로 충전';

// ---------------------------------------------------------------- WebGL context loss
// Phones reclaim GPU memory (backgrounding, memory pressure). three.js rebuilds its
// GL state on restore; until then the game pauses and shows a notice.
let glLost = false;
let glReloadTimer = 0;
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault(); // tell the browser we will handle restoring
  glLost = true;
  errorLog.record('webgl', 'WebGL context lost');
  pause();
  $('#gl-lost').hidden = false;
  glReloadTimer = setTimeout(() => ($('#btn-gl-reload').hidden = false), 5000);
});
canvas.addEventListener('webglcontextrestored', () => {
  glLost = false;
  clearTimeout(glReloadTimer);
  $('#gl-lost').hidden = true;
  $('#btn-gl-reload').hidden = true;
  applyQuality();
  snapCamera = true;
});
$('#btn-gl-reload').addEventListener('click', () => location.reload());

// ---------------------------------------------------------------- loop
let last = performance.now();
let acc = 0;
let goTimer = 0;
let crashed = false;

function frame(now) {
  if (crashed) return;
  requestAnimationFrame(frame);
  if (glLost) {
    last = now;
    return;
  }
  try {
    tick(now);
  } catch (err) {
    // Stop instead of throwing every frame; offer a restart and a bug report.
    crashed = true;
    errorLog.record('frame', err);
    audio.suspend();
    keepAwake(false);
    showError('문제가 생겨 멈췄어요', '게임 진행 중 오류가 발생했어요. 다시 시작하거나, 신고해 주시면 고칠게요.');
  }
}

function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const time = now / 1000;
  const s = session;

  if (mode === 'countdown') {
    s.countdown -= dt;
    const n = Math.ceil(s.countdown);
    $('#countdown').textContent = n > 0 ? String(n) : 'GO!';
    if (s.countdown <= 0) {
      mode = 'race';
      goTimer = 0.7;
      haptic(40);
    }
  } else if (goTimer > 0) {
    goTimer -= dt;
    if (goTimer <= 0) {
      $('#countdown').hidden = true;
      $('#touch-guide').hidden = true;
    }
  }

  const running = mode === 'menu' || mode === 'race' || mode === 'results' || mode === 'countdown';
  if (running) {
    acc += dt;
    while (acc >= FIXED_DT) {
      simStep(FIXED_DT);
      acc -= FIXED_DT;
    }
  } else acc = 0;

  s.entrants.forEach((e, i) => s.meshes[i].update(e.car, running ? dt : 0, time));
  if (running) updateEffects(dt);
  const focus = s.player.car;
  updateCamera(focus, dt, time);
  s.world.update(dt, focus);
  if (mode !== 'menu') updateHud(dt);
  audio.update(s.player.car, mode === 'race' || mode === 'countdown');
  renderer.render(scene, camera);
  if (mode === 'race' || mode === 'menu') watchPerformance(dt);
}

renderMenu();
newSession({ attract: true });
if (params.get('autostart') === '1') startRace();

// Dev server only (tree-shaken out of production builds): lets e2e checks
// inspect the race and hand the player's car to the autopilot.
if (import.meta.env.DEV) {
  window.__driftDuel = {
    get mode() {
      return mode;
    },
    get session() {
      return session;
    },
    renderer,
  };
}
requestAnimationFrame(frame);
