// Keyboard + touch controls. The car accelerates on its own (like most mobile
// drift racers); the player steers, brakes and fires nitro.
//   Touch:    hold left/right half to steer · hold both halves to brake
//             swipe up anywhere or tap NITRO = fire a boost (runs until the tank is empty)
//   Keyboard: ←/A, →/D steer · ↓/S brake · Space/Shift hold for nitro · P/Esc pause

const SWIPE_UP_PX = 45;
const SWIPE_MAX_MS = 450;

export function createInput({ touchLayer, nitroButton, onPause }) {
  const keys = new Set();
  const pointers = new Map(); // pointerId -> { side, y0, t0, swiped }
  let nitroTaps = 0;

  const onKeyDown = (e) => {
    if (e.code === 'KeyP' || e.code === 'Escape') {
      onPause?.();
      return;
    }
    keys.add(e.code);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const clear = () => {
    keys.clear();
    pointers.clear();
    nitroTaps = 0;
  };

  const side = (e) => (e.clientX < window.innerWidth / 2 ? 'left' : 'right');
  const onDown = (e) => {
    pointers.set(e.pointerId, { side: side(e), y0: e.clientY, t0: e.timeStamp, swiped: false });
    touchLayer.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.side = side(e);
    if (!p.swiped && p.y0 - e.clientY > SWIPE_UP_PX && e.timeStamp - p.t0 < SWIPE_MAX_MS) {
      p.swiped = true;
      nitroTaps++;
    }
  };
  const onUp = (e) => pointers.delete(e.pointerId);

  const onNitro = (e) => {
    nitroTaps++;
    e.preventDefault();
    e.stopPropagation();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clear);
  touchLayer.addEventListener('pointerdown', onDown);
  touchLayer.addEventListener('pointermove', onMove);
  touchLayer.addEventListener('pointerup', onUp);
  touchLayer.addEventListener('pointercancel', onUp);
  nitroButton.addEventListener('pointerdown', onNitro);

  return {
    /**
     * Current controls. `nitroTap` is true once per tap/swipe (an edge, consumed
     * by this call); `nitroHeld` is the keyboard hold.
     */
    read() {
      let left = keys.has('ArrowLeft') || keys.has('KeyA');
      let right = keys.has('ArrowRight') || keys.has('KeyD');
      let brake = keys.has('ArrowDown') || keys.has('KeyS');
      let touchL = false;
      let touchR = false;
      for (const p of pointers.values()) {
        if (p.side === 'left') touchL = true;
        else touchR = true;
      }
      if (touchL && touchR) brake = true;
      else {
        left ||= touchL;
        right ||= touchR;
      }
      const nitroTap = nitroTaps > 0;
      nitroTaps = 0;
      return {
        steer: (right ? 1 : 0) - (left ? 1 : 0),
        throttle: brake ? 0 : 1,
        brake: brake ? 1 : 0,
        nitroHeld: keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight'),
        nitroTap,
      };
    },
    /** Visual feedback for which side is held. */
    sides() {
      const out = { left: false, right: false };
      for (const p of pointers.values()) out[p.side] = true;
      return out;
    },
    reset: clear,
  };
}
