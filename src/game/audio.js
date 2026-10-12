// Tiny synthesized engine + tire screech with Web Audio (no sound files).
// Browsers only allow audio after a user gesture, so start() is called from a click.
// iOS can also suspend or "interrupt" a running context (calls, Siri, lock screen)
// and refuse resume() outside a gesture, so resuming is retried on later taps.

export function createAudio() {
  let ctx = null;
  let master;
  let engineOsc;
  let engineSub;
  let engineFilter;
  let engineGain;
  let screechGain;
  let screechFilter;
  let muted = false;
  let wanted = false; // the game wants sound running (racing, not paused)
  let unavailable = false;

  function resumeIfNeeded() {
    if (!ctx || !wanted || ctx.state === 'running' || ctx.state === 'closed') return;
    // Rejected when not allowed yet (no gesture); the next tap or key press retries.
    ctx.resume().catch(() => {});
  }

  function start() {
    wanted = true;
    if (ctx) {
      resumeIfNeeded();
      return;
    }
    if (unavailable) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      unavailable = true; // no Web Audio: play silently
      return;
    }
    try {
      ctx = new AC();
    } catch {
      unavailable = true; // e.g. too many contexts or blocked by policy
      return;
    }
    for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, resumeIfNeeded, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => document.hidden || resumeIfNeeded());
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineSub = ctx.createOscillator();
    engineSub.type = 'square';
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 600;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineSub.connect(engineFilter);
    engineFilter.connect(engineGain).connect(master);
    engineOsc.start();
    engineSub.start();

    // Looping white noise through a band-pass = tire squeal.
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    screechFilter = ctx.createBiquadFilter();
    screechFilter.type = 'bandpass';
    screechFilter.frequency.value = 1700;
    screechFilter.Q.value = 6;
    screechGain = ctx.createGain();
    screechGain.gain.value = 0;
    noise.connect(screechFilter).connect(screechGain).connect(master);
    noise.start();
  }

  function update(car, active) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const ratio = Math.min(car.speed / car.spec.maxSpeed, 1.3);
    // Fake 4-speed gearbox so the pitch climbs and drops.
    const gear = Math.min(3, Math.floor(ratio * 4));
    const inGear = ratio * 4 - gear;
    const freq = 55 + gear * 12 + inGear * 70 + (car.boosting ? 25 : car.kick > 0 ? 15 : 0);
    engineOsc.frequency.setTargetAtTime(freq, t, 0.05);
    engineSub.frequency.setTargetAtTime(freq / 2, t, 0.05);
    engineFilter.frequency.setTargetAtTime(400 + ratio * 1400, t, 0.08);
    engineGain.gain.setTargetAtTime(active ? 0.16 + ratio * 0.1 : 0, t, 0.1);
    const squeal = active && car.drifting ? Math.min(Math.abs(car.slip) * 0.45, 0.22) : 0;
    screechGain.gain.setTargetAtTime(squeal, t, 0.06);
    screechFilter.frequency.setTargetAtTime(1400 + Math.abs(car.slip) * 900, t, 0.1);
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05);
  }

  function suspend() {
    wanted = false;
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
  }

  return {
    start,
    update,
    setMuted,
    suspend,
    get muted() {
      return muted;
    },
    /** 'running' | 'suspended' | 'interrupted' | 'closed' | 'unavailable' | 'idle' */
    get state() {
      return unavailable ? 'unavailable' : ctx ? ctx.state : 'idle';
    },
  };
}
