// Procedural canvas textures, so the game ships without image assets.
import * as THREE from 'three';
import { mulberry32 } from '../game/math.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Asphalt with grain, white edge lines and a dashed center line. v repeats every 16 m. */
export function asphaltTexture(base) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const rnd = mulberry32(7);
    for (let i = 0; i < 2200; i++) {
      const v = Math.floor(rnd() * 40);
      g.fillStyle = `rgba(${v + 90},${v + 90},${v + 95},${rnd() * 0.18})`;
      g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
    }
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(4, 0, 3, h);
    g.fillRect(w - 7, 0, 3, h);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillRect(w / 2 - 2, 0, 4, h * 0.45);
  });
}

export function curbTexture() {
  return canvasTexture(8, 64, (g, w, h) => {
    g.fillStyle = '#e63946';
    g.fillRect(0, 0, w, h / 2);
    g.fillStyle = '#f8f9fa';
    g.fillRect(0, h / 2, w, h / 2);
  });
}

export function checkerTexture() {
  const tex = canvasTexture(64, 16, (g, w, h) => {
    const cell = 8;
    for (let y = 0; y < h / cell; y++)
      for (let x = 0; x < w / cell; x++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
        g.fillRect(x * cell, y * cell, cell, cell);
      }
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function groundTexture(hex) {
  const col = new THREE.Color(hex);
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = `#${col.getHexString()}`;
    g.fillRect(0, 0, w, h);
    const rnd = mulberry32(3);
    for (let i = 0; i < 900; i++) {
      const shade = rnd() < 0.5 ? 0 : 255;
      g.fillStyle = `rgba(${shade},${shade},${shade},${rnd() * 0.06})`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 2 + rnd() * 3);
    }
  });
}

/** Building facade with lit windows (used for the night track). */
export function windowsTexture() {
  return canvasTexture(64, 128, (g, w, h) => {
    g.fillStyle = '#0d0c1d';
    g.fillRect(0, 0, w, h);
    const rnd = mulberry32(19);
    const colors = ['#ffd166', '#7af0ff', '#ff6ad5', '#fff3c4'];
    for (let y = 4; y < h - 4; y += 10)
      for (let x = 4; x < w - 4; x += 10) {
        if (rnd() < 0.45) continue;
        g.fillStyle = colors[Math.floor(rnd() * colors.length)];
        g.globalAlpha = 0.5 + rnd() * 0.5;
        g.fillRect(x, y, 5, 6);
      }
    g.globalAlpha = 1;
  });
}

/** Soft round puff for smoke sprites. */
export function puffTexture() {
  const tex = canvasTexture(64, 64, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
