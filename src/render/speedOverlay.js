// Screen-space rush lines for boosts: radial streaks around the screen edge,
// drawn on a 2D canvas over the scene (cheap, and independent of the 3D camera).

import { damp } from '../game/math.js';

const LINES = 46;

export function createSpeedOverlay(canvas) {
  const g = canvas.getContext('2d');
  let level = 0; // smoothed 0..1
  let w = 0;
  let h = 0;

  function fit() {
    // CSS pixels are plenty for soft streaks and keep the fill cost low.
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  return {
    /** target: 0 = off, ~0.6 = kick, 1 = nitro. */
    update(target, dt) {
      level += (target - level) * damp(target > level ? 14 : 5, dt);
      if (level < 0.02) {
        if (canvas.width) g.clearRect(0, 0, canvas.width, canvas.height);
        canvas.hidden = true;
        level = 0;
        return;
      }
      canvas.hidden = false;
      fit();
      g.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h * 0.46;
      const reach = Math.hypot(w, h) / 2;
      g.lineCap = 'round';
      // Fresh random streaks every frame flicker like a blur rushing past.
      for (let i = 0; i < LINES; i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = reach * (0.55 + Math.random() * 0.25 + (1 - level) * 0.2);
        const r1 = reach * 1.05;
        const c = Math.cos(a);
        const s = Math.sin(a);
        g.strokeStyle = `rgba(255,255,255,${(0.18 + Math.random() * 0.35) * level})`;
        g.lineWidth = 1 + Math.random() * 2.5;
        g.beginPath();
        g.moveTo(cx + c * r0, cy + s * r0);
        g.lineTo(cx + c * r1, cy + s * r1);
        g.stroke();
      }
    },
    clear() {
      level = 0;
      g.clearRect(0, 0, canvas.width, canvas.height);
      canvas.hidden = true;
    },
  };
}
