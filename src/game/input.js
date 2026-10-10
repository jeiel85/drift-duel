// Keyboard + touch controls. The car accelerates on its own (like most mobile
// drift racers); the player steers, brakes and fires nitro.
//   Keyboard: ←/A, →/D steer · ↓/S brake · Space/Shift nitro · P/Esc pause
//   Touch:    hold left/right half to steer · hold both halves to brake · NITRO button

export function createInput({ touchLayer, nitroButton, onPause }) {
  const keys = new Set();
  const pointers = new Map(); // pointerId -> 'left' | 'right'
  let nitroTouch = false;

  const onKeyDown = (e) => {
    if (e.code === 'KeyP' || e.code === 'Escape') {
      onPause?.();
      return;
    }
    keys.add(e.code);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onBlur = () => {
    keys.clear();
    pointers.clear();
    nitroTouch = false;
  };

  const side = (e) => (e.clientX < window.innerWidth / 2 ? 'left' : 'right');
  const onDown = (e) => {
    pointers.set(e.pointerId, side(e));
    touchLayer.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, side(e));
  };
  const onUp = (e) => pointers.delete(e.pointerId);

  const nitroDown = (e) => {
    nitroTouch = true;
    e.preventDefault();
    e.stopPropagation();
  };
  const nitroUp = () => {
    nitroTouch = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  touchLayer.addEventListener('pointerdown', onDown);
  touchLayer.addEventListener('pointermove', onMove);
  touchLayer.addEventListener('pointerup', onUp);
  touchLayer.addEventListener('pointercancel', onUp);
  nitroButton.addEventListener('pointerdown', nitroDown);
  nitroButton.addEventListener('pointerup', nitroUp);
  nitroButton.addEventListener('pointercancel', nitroUp);
  nitroButton.addEventListener('pointerleave', nitroUp);

  return {
    read() {
      let left = keys.has('ArrowLeft') || keys.has('KeyA');
      let right = keys.has('ArrowRight') || keys.has('KeyD');
      let brake = keys.has('ArrowDown') || keys.has('KeyS');
      let touchL = false;
      let touchR = false;
      for (const s of pointers.values()) {
        if (s === 'left') touchL = true;
        else touchR = true;
      }
      if (touchL && touchR) brake = true;
      else {
        left ||= touchL;
        right ||= touchR;
      }
      const steer = (right ? 1 : 0) - (left ? 1 : 0);
      const nitro = nitroTouch || keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight');
      return { steer, throttle: brake ? 0 : 1, brake: brake ? 1 : 0, nitro };
    },
    /** Visual feedback for which side is held. */
    sides() {
      const out = { left: false, right: false };
      for (const s of pointers.values()) out[s] = true;
      return out;
    },
    reset: onBlur,
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
