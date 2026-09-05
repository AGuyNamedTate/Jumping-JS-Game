/**
 * Procedural one-way platforms (solid + shaky) with recycle.
 */

import {
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  PLATFORM_WIDTH_MIN,
  PLATFORM_WIDTH_MAX,
  PLATFORM_GAP_MIN,
  PLATFORM_GAP_MAX,
  PLATFORM_THICKNESS,
  SHAKY_CHANCE,
  SHAKE_BREAK_TIME,
  FIXED_DT,
} from './constants.js';

/** How far above the camera top to keep generating */
const GEN_AHEAD = LOGICAL_HEIGHT * 1.2;
/** Recycle platforms this far below the camera bottom */
const RECYCLE_BELOW = 80;
/** Horizontal padding from screen edges */
const EDGE_PAD = 8;

/**
 * @returns {{ platforms: Platform[], topY: number, seed: number }}
 */
export function createWorld() {
  const world = {
    /** @type {Platform[]} */
    platforms: [],
    /** Smallest (highest) platform top y */
    topY: 0,
    seed: 1,
  };
  reset(world);
  return world;
}

/**
 * @param {ReturnType<typeof createWorld>} world
 */
export function reset(world) {
  world.platforms.length = 0;
  world.seed = (Date.now() % 1e9) | 0;

  // Wide start ledge near bottom of initial view
  const startY = LOGICAL_HEIGHT - 80;
  const startW = 140;
  const startX = (LOGICAL_WIDTH - startW) / 2;
  world.platforms.push(makePlatform(startX, startY, startW, 'solid'));
  world.topY = startY;

  // Fill upward from start
  fillUpward(world, startY - PLATFORM_GAP_MIN);
  // A few below for safety feel
  let y = startY + 70;
  for (let i = 0; i < 3; i++) {
    world.platforms.push(randomPlatform(world, y));
    y += randRange(world, PLATFORM_GAP_MIN, PLATFORM_GAP_MAX);
  }
}

/**
 * @param {ReturnType<typeof createWorld>} world
 * @param {number} dt
 * @param {number} cameraY
 */
export function update(world, dt, cameraY) {
  const viewBottom = cameraY + LOGICAL_HEIGHT;

  for (const p of world.platforms) {
    if (p.type === 'shaky' && p.shakeTimer > 0 && !p.broken) {
      p.shakeTimer += dt;
      if (p.shakeTimer >= SHAKE_BREAK_TIME) {
        p.broken = true;
        p.shakeTimer = 0;
      }
    }
  }

  // Recycle platforms that fell off the bottom of the view
  for (const p of world.platforms) {
    if (p.y > viewBottom + RECYCLE_BELOW) {
      relocateAbove(world, p);
    }
  }

  // Ensure generation covers above the camera
  while (world.topY > cameraY - GEN_AHEAD) {
    spawnNextAbove(world);
  }
}

/**
 * One-way landing: only when falling and feet cross the platform top from above.
 * @param {ReturnType<typeof createWorld>} world
 * @param {{ x: number, y: number, w: number, h: number, vx: number, vy: number }} player
 * @returns {Platform|null}
 */
export function tryLand(world, player) {
  // Ascending or floating up — pass through platforms
  if (player.vy <= 0) return null;

  const feet = player.y + player.h;
  const prevFeet = feet - player.vy * FIXED_DT;

  let best = null;
  let bestY = Infinity;

  for (const p of world.platforms) {
    if (p.broken) continue;
    if (!overlapX(player, p)) continue;

    const top = p.y;
    // Must have been above (or at) the top last frame, then landed on/through the top this frame
    if (prevFeet <= top + 1 && feet >= top && feet <= top + PLATFORM_THICKNESS + 6) {
      if (top < bestY) {
        bestY = top;
        best = p;
      }
    }
  }

  if (best) {
    player.y = best.y - player.h;
    player.vy = 0;
    if (best.type === 'shaky' && best.shakeTimer <= 0) {
      best.shakeTimer = 0.0001;
    }
  }

  return best;
}

/**
 * Feet resting on a platform top (does not imply grounded while ascending).
 * @param {ReturnType<typeof createWorld>} world
 * @param {{ x: number, y: number, w: number, h: number }} player
 * @returns {Platform|null}
 */
export function getStandingPlatform(world, player) {
  const feet = player.y + player.h;
  for (const p of world.platforms) {
    if (p.broken) continue;
    if (!overlapX(player, p)) continue;
    // Only count as "on top" when feet are at the surface, not buried mid-platform from below
    if (feet >= p.y - 1.5 && feet <= p.y + 3) {
      return p;
    }
  }
  return null;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<typeof createWorld>} world
 * @param {{ y: number }} camera
 */
export function draw(ctx, world, camera) {
  for (const p of world.platforms) {
    if (p.broken) continue;
    const sy = p.y - camera.y;
    if (sy < -40 || sy > LOGICAL_HEIGHT + 40) continue;

    let drawX = p.x;
    let drawY = sy;
    if (p.type === 'shaky' && p.shakeTimer > 0) {
      const t = p.shakeTimer;
      drawX += Math.sin(t * 40) * 2.5;
      drawY += Math.cos(t * 55) * 1.5;
    }

    if (p.type === 'shaky') {
      ctx.fillStyle = '#a67c52';
      ctx.fillRect(drawX, drawY, p.w, p.h);
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(drawX + 2, drawY + 2, p.w - 4, p.h - 4);
      // Cracks
      ctx.fillStyle = '#5c4030';
      ctx.fillRect(drawX + p.w * 0.3, drawY, 2, p.h);
      ctx.fillRect(drawX + p.w * 0.65, drawY + 2, 2, p.h - 2);
    } else {
      ctx.fillStyle = '#4a7c59';
      ctx.fillRect(drawX, drawY, p.w, p.h);
      ctx.fillStyle = '#6b9b76';
      ctx.fillRect(drawX, drawY, p.w, 3);
      ctx.fillStyle = '#2d4a34';
      ctx.fillRect(drawX, drawY + p.h - 2, p.w, 2);
    }
  }
}

/**
 * Spawn a solid rescue ledge near a world position.
 * @param {ReturnType<typeof createWorld>} world
 * @param {number} nearX
 * @param {number} nearY
 * @returns {Platform}
 */
export function spawnSafetyPlatform(world, nearX, nearY) {
  const w = 100;
  const x = clamp(nearX - w / 2, EDGE_PAD, LOGICAL_WIDTH - w - EDGE_PAD);
  const y = nearY + 40;
  const p = makePlatform(x, y, w, 'solid');
  world.platforms.push(p);
  return p;
}

/**
 * Find a solid (non-broken) platform at or above player for bird drop-off.
 * @param {ReturnType<typeof createWorld>} world
 * @param {number} playerY
 * @returns {Platform|null}
 */
export function findRescueTarget(world, playerY) {
  /** @type {Platform|null} */
  let best = null;
  let bestScore = Infinity;

  for (const p of world.platforms) {
    if (p.broken || p.type === 'shaky') continue;
    // Prefer platforms near or slightly above the player
    const dy = p.y - playerY;
    if (dy < -LOGICAL_HEIGHT * 0.5 || dy > LOGICAL_HEIGHT * 0.75) continue;
    const midX = Math.abs(p.x + p.w / 2 - LOGICAL_WIDTH / 2);
    const score = Math.abs(dy) + midX * 0.25;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }

  if (best) return best;

  // Fallback: highest solid below camera-ish
  for (const p of world.platforms) {
    if (p.broken) continue;
    if (!best || p.y < best.y) best = p;
  }
  return best;
}

/** @typedef {{ x: number, y: number, w: number, h: number, type: 'solid'|'shaky', shakeTimer: number, broken: boolean }} Platform */

/**
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {'solid'|'shaky'} type
 * @returns {Platform}
 */
function makePlatform(x, y, w, type) {
  return {
    x,
    y,
    w,
    h: PLATFORM_THICKNESS,
    type,
    shakeTimer: 0,
    broken: false,
  };
}

/**
 * @param {ReturnType<typeof createWorld>} world
 * @param {number} fromY
 */
function fillUpward(world, fromY) {
  let y = fromY;
  const target = fromY - LOGICAL_HEIGHT * 2;
  while (y > target) {
    world.platforms.push(randomPlatform(world, y));
    world.topY = Math.min(world.topY, y);
    y -= randRange(world, PLATFORM_GAP_MIN, PLATFORM_GAP_MAX);
  }
}

/**
 * @param {ReturnType<typeof createWorld>} world
 */
function spawnNextAbove(world) {
  const gap = randRange(world, PLATFORM_GAP_MIN, PLATFORM_GAP_MAX);
  const y = world.topY - gap;
  world.platforms.push(randomPlatform(world, y));
  world.topY = y;
}

/**
 * @param {ReturnType<typeof createWorld>} world
 * @param {Platform} p
 */
function relocateAbove(world, p) {
  const gap = randRange(world, PLATFORM_GAP_MIN, PLATFORM_GAP_MAX);
  const y = world.topY - gap;
  const w = randRange(world, PLATFORM_WIDTH_MIN, PLATFORM_WIDTH_MAX);
  p.x = randRange(world, EDGE_PAD, LOGICAL_WIDTH - w - EDGE_PAD);
  p.y = y;
  p.w = w;
  p.h = PLATFORM_THICKNESS;
  p.type = rand(world) < SHAKY_CHANCE ? 'shaky' : 'solid';
  p.shakeTimer = 0;
  p.broken = false;
  world.topY = y;
}

/**
 * @param {ReturnType<typeof createWorld>} world
 * @param {number} y
 * @returns {Platform}
 */
function randomPlatform(world, y) {
  const w = randRange(world, PLATFORM_WIDTH_MIN, PLATFORM_WIDTH_MAX);
  const x = randRange(world, EDGE_PAD, LOGICAL_WIDTH - w - EDGE_PAD);
  const type = rand(world) < SHAKY_CHANCE ? 'shaky' : 'solid';
  return makePlatform(x, y, w, type);
}

/**
 * @param {{ x: number, w: number }} a
 * @param {{ x: number, w: number }} b
 */
function overlapX(a, b) {
  return a.x + a.w > b.x + 2 && a.x < b.x + b.w - 2;
}

/**
 * @param {ReturnType<typeof createWorld>} world
 */
function rand(world) {
  // xorshift32
  let s = world.seed | 0;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  world.seed = s | 0;
  return ((s >>> 0) % 10000) / 10000;
}

/**
 * @param {ReturnType<typeof createWorld>} world
 * @param {number} min
 * @param {number} max
 */
function randRange(world, min, max) {
  return min + rand(world) * (max - min);
}

/**
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
