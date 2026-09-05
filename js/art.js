/**
 * Procedural pixel art helpers for Fantasy Peak Climber.
 * All draw positions snapped to integers; caller should disable imageSmoothing.
 */

import { PLATFORM_THICKNESS } from './constants.js';
import { ADVENTURER_H, ADVENTURER_W, drawAdventurer } from './cosmetics.js';

/** @type {{ x: number, y: number, vx: number, vy: number, life: number, color: string, size: number }[]} */
const particles = [];

/**
 * Seeded-ish star field (stable per session).
 * @type {{ x: number, y: number, r: number, tw: number }[]|null}
 */
let stars = null;

function ensureStars(w, h) {
  if (stars && stars.length) return stars;
  stars = [];
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const count = 48;
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * w,
      y: rand() * h * 1.6,
      r: rand() > 0.85 ? 2 : 1,
      tw: rand() * Math.PI * 2,
    });
  }
  return stars;
}

/**
 * Night fantasy sky with parallax stars.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cameraY world Y of top of view (higher climb = lower world Y typically — treat as scroll)
 * @param {number} w
 * @param {number} h
 */
export function drawSky(ctx, cameraY, w, h) {
  const iw = Math.floor(w);
  const ih = Math.floor(h);
  const cam = Math.floor(cameraY);

  // Vertical gradient: deep indigo → midnight → near-black horizon
  const g = ctx.createLinearGradient(0, 0, 0, ih);
  g.addColorStop(0, '#1a2744');
  g.addColorStop(0.35, '#152238');
  g.addColorStop(0.7, '#0b1220');
  g.addColorStop(1, '#060a12');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, iw, ih);

  // Soft aurora wash
  const aurora = ctx.createLinearGradient(0, 0, iw, ih * 0.5);
  aurora.addColorStop(0, 'rgba(61, 107, 79, 0.12)');
  aurora.addColorStop(0.5, 'rgba(232, 168, 56, 0.05)');
  aurora.addColorStop(1, 'rgba(90, 120, 180, 0.1)');
  ctx.fillStyle = aurora;
  ctx.fillRect(0, 0, iw, Math.floor(ih * 0.55));

  const field = ensureStars(iw, ih);
  const parallax = (cam * 0.15) % (ih + 40);
  for (let i = 0; i < field.length; i++) {
    const s = field[i];
    const sx = Math.floor(s.x);
    let sy = Math.floor((s.y - parallax + ih * 2) % (ih + 20) - 10);
    const twinkle = 0.55 + 0.45 * Math.sin(performance.now() * 0.002 + s.tw);
    ctx.fillStyle = `rgba(232, 224, 208, ${twinkle.toFixed(2)})`;
    ctx.fillRect(sx, sy, s.r, s.r);
  }

  // Distant peak silhouettes (parallax slower)
  const peakOff = Math.floor(cam * 0.05) % 80;
  ctx.fillStyle = '#0a1422';
  drawPeakRow(ctx, iw, ih, peakOff, 0.88);
  ctx.fillStyle = '#081018';
  drawPeakRow(ctx, iw, ih, Math.floor(peakOff * 1.4), 0.93);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {number} offsetX
 * @param {number} baseFrac
 */
function drawPeakRow(ctx, w, h, offsetX, baseFrac) {
  const baseY = Math.floor(h * baseFrac);
  ctx.beginPath();
  ctx.moveTo(0, h);
  let x = -40 - (offsetX % 60);
  while (x < w + 40) {
    const peakH = 40 + ((Math.abs(Math.floor(x * 7)) % 50));
    const mid = Math.floor(x + 30);
    ctx.lineTo(Math.floor(x), baseY);
    ctx.lineTo(mid, baseY - peakH);
    ctx.lineTo(Math.floor(x + 60), baseY);
    x += 70;
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

/**
 * World Y → screen Y (cameraY is top of viewport in world space).
 * @param {number} worldY
 * @param {number} cameraY
 */
function sy(worldY, cameraY) {
  return Math.floor(worldY - cameraY);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, w?: number, width?: number, shaky?: boolean, shakeTimer?: number, broken?: boolean }} platform
 * @param {number} cameraY
 */
export function drawPlatform(ctx, platform, cameraY) {
  if (platform.broken) return;
  const pw = Math.floor(platform.w ?? platform.width ?? 64);
  const px = Math.floor(platform.x);
  const py = sy(platform.y, cameraY);
  const th = PLATFORM_THICKNESS;
  const shaky = Boolean(platform.shaky);

  let shakeX = 0;
  if (shaky && (platform.shakeTimer ?? 0) > 0) {
    shakeX = Math.floor(Math.sin(performance.now() * 0.04) * 2);
  }

  const x = px + shakeX;
  const y = py;

  if (shaky) {
    // Weathered wood plank — high contrast
    ctx.fillStyle = '#c4a06a';
    ctx.fillRect(x, y, pw, th);
    ctx.fillStyle = '#8a6340';
    ctx.fillRect(x, y, pw, 4);
    ctx.fillStyle = '#4a3220';
    ctx.fillRect(x, y + th - 4, pw, 4);
    ctx.fillStyle = '#3d2818';
    for (let i = 12; i < pw; i += 14) {
      ctx.fillRect(x + i, y + 1, 2, th - 2);
    }
    ctx.fillStyle = '#5a9a6e';
    ctx.fillRect(x + 4, y - 3, 8, 3);
    ctx.fillRect(x + pw - 14, y - 3, 7, 3);
  } else {
    // Solid stone ledge — bright top edge
    ctx.fillStyle = '#2a2e36';
    ctx.fillRect(x, y, pw, th + 3);
    ctx.fillStyle = '#9aa3b0';
    ctx.fillRect(x, y, pw, th - 2);
    ctx.fillStyle = '#d8dde6';
    ctx.fillRect(x + 1, y, pw - 2, 3);
    ctx.fillStyle = '#5a606c';
    for (let i = 10; i < pw - 4; i += 16) {
      ctx.fillRect(x + i, y + 3, 2, th - 5);
    }
    ctx.fillStyle = '#6ecf88';
    ctx.fillRect(x + 2, y - 2, Math.min(12, pw - 4), 3);
    ctx.fillRect(x + Math.floor(pw * 0.45), y - 2, 10, 3);
  }
}

/**
 * In-game adventurer — same shop sprite, scaled into the player box.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, w?: number, h?: number, facing?: number, onGround?: boolean }} player
 * @param {number} cameraY
 * @param {{ hat?: boolean, goldSword?: boolean, goldenSword?: boolean }|null} [cosmetics]
 */
export function drawPlayer(ctx, player, cameraY, cosmetics = null) {
  const pw = Math.floor(player.w ?? 18);
  const ph = Math.floor(player.h ?? 26);
  const px = Math.floor(player.x);
  const py = sy(player.y, cameraY);
  const cos = cosmetics ?? {};
  const scale = Math.max(1, Math.floor(Math.min(pw / ADVENTURER_W, ph / ADVENTURER_H)));
  const drawW = ADVENTURER_W * scale;
  const drawH = ADVENTURER_H * scale;
  const originX = px + Math.floor((pw - drawW) / 2);
  const originY = py + ph - drawH;

  drawAdventurer(ctx, originX, originY, scale, {
    hat: Boolean(cos.hat),
    goldenSword: Boolean(cos.goldSword || cos.goldenSword),
    facing: player.facing ?? 1,
  });
}

/**
 * Rescue bird companion.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y world Y
 * @param {number} cameraY
 */
export function drawBird(ctx, x, y, cameraY) {
  const bx = Math.floor(x);
  const by = sy(y, cameraY);
  const flap = Math.sin(performance.now() * 0.012) > 0;

  // Body
  ctx.fillStyle = '#c47a1a';
  ctx.fillRect(bx + 4, by + 6, 14, 10);
  // Head
  ctx.fillStyle = '#e8a838';
  ctx.fillRect(bx + 14, by + 4, 8, 8);
  // Beak
  ctx.fillStyle = '#b33a2e';
  ctx.fillRect(bx + 22, by + 7, 5, 3);
  // Eye
  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(bx + 18, by + 6, 2, 2);
  // Wing
  ctx.fillStyle = '#8a5520';
  if (flap) {
    ctx.fillRect(bx + 2, by - 2, 12, 6);
  } else {
    ctx.fillRect(bx + 2, by + 8, 12, 6);
  }
  // Tail
  ctx.fillStyle = '#c47a1a';
  ctx.fillRect(bx, by + 8, 5, 4);
}

/**
 * Charge meter above player.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, w?: number }} player
 * @param {number} cameraY
 * @param {number} charge01 0–1
 */
export function drawChargeBar(ctx, player, cameraY, charge01) {
  const c = Math.max(0, Math.min(1, charge01));
  if (c <= 0.001) return;

  const pw = Math.floor(player.w ?? 28);
  const barW = Math.max(pw + 8, 36);
  const bx = Math.floor(player.x + pw / 2 - barW / 2);
  const by = sy(player.y, cameraY) - 10;
  const fill = Math.floor(barW * c);

  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(bx - 1, by - 1, barW + 2, 6);
  ctx.fillStyle = '#3d4048';
  ctx.fillRect(bx, by, barW, 4);

  // Moss → torch gold fill
  const grd = ctx.createLinearGradient(bx, 0, bx + barW, 0);
  grd.addColorStop(0, '#3d6b4f');
  grd.addColorStop(0.7, '#e8a838');
  grd.addColorStop(1, '#f5d078');
  ctx.fillStyle = grd;
  ctx.fillRect(bx, by, fill, 4);
}

/**
 * Spawn land dust puffs at world position.
 * @param {number} x
 * @param {number} y
 */
export function spawnLandDust(x, y) {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y,
      vx: (Math.random() - 0.5) * 60,
      vy: -20 - Math.random() * 40,
      life: 0.25 + Math.random() * 0.2,
      color: '#9a9da5',
      size: 2 + Math.floor(Math.random() * 2),
    });
  }
}

/**
 * Spawn wood/stone debris when a platform breaks.
 * @param {number} x
 * @param {number} y
 * @param {number} [w=48]
 * @param {boolean} [wood=true]
 */
export function spawnBreakDebris(x, y, w = 48, wood = true) {
  const color = wood ? '#6b4a2e' : '#6b6e76';
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: x + Math.random() * w,
      y: y + Math.random() * 8,
      vx: (Math.random() - 0.5) * 120,
      vy: -40 - Math.random() * 80,
      life: 0.4 + Math.random() * 0.35,
      color,
      size: 2 + Math.floor(Math.random() * 3),
    });
  }
}

/**
 * @param {number} dt
 */
export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 400 * dt;
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cameraY
 */
export function drawParticles(ctx, cameraY) {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 3));
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.floor(p.x), sy(p.y, cameraY), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

/**
 * Clear particle pool (e.g. on new run).
 */
export function clearParticles() {
  particles.length = 0;
}
