/**
 * Charge-jump adventurer physics + procedural pixel draw.
 */

import {
  GRAVITY,
  CHARGE_TIME,
  MIN_JUMP_VY,
  MAX_JUMP_VY,
  MOVE_SPEED,
  JUMP_HX,
  AIR_ACCEL,
  AIR_CONTROL_PRE_APEX,
  AIR_CONTROL_POST_APEX,
} from './constants.js';

export const PLAYER_W = 18;
export const PLAYER_H = 26;

/**
 * @param {number} x
 * @param {number} y top-left
 */
export function createPlayer(x, y) {
  return {
    x,
    y,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 0,
    grounded: false,
    charge: 0,
    /** @type {1|-1} */
    facing: 1,
    /** Highest point reached (smallest y); for scoring hooks */
    minY: y,
  };
}

/**
 * @param {ReturnType<typeof createPlayer>} player
 * @param {number} x
 * @param {number} y
 */
export function reset(player, x, y) {
  player.x = x;
  player.y = y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.charge = 0;
  player.facing = 1;
  player.minY = y;
}

/**
 * @param {ReturnType<typeof createPlayer>} player
 * @param {number} dt
 * @param {{ charging: boolean, chargeJustReleased: boolean, moveX: number }} input
 * @param {boolean} onGround
 */
export function update(player, dt, input, onGround) {
  player.grounded = onGround;

  if (input.moveX !== 0) {
    player.facing = input.moveX > 0 ? 1 : -1;
  }

  if (player.grounded) {
    player.vy = 0;

    if (input.charging) {
      player.charge = Math.min(1, player.charge + dt / CHARGE_TIME);
      // Lock in place while charging (Jump King style)
      player.vx = 0;
    } else if (input.chargeJustReleased && player.charge > 0) {
      const t = player.charge;
      player.vy = MIN_JUMP_VY + (MAX_JUMP_VY - MIN_JUMP_VY) * t;
      player.vx = input.moveX * JUMP_HX * (0.35 + 0.65 * t);
      player.grounded = false;
      player.charge = 0;
    } else {
      player.charge = 0;
      player.vx = input.moveX * MOVE_SPEED;
    }
  } else {
    player.charge = 0;
    player.vy += GRAVITY * dt;

    const airMult =
      player.vy < 0 ? AIR_CONTROL_PRE_APEX : AIR_CONTROL_POST_APEX;
    const target = input.moveX * MOVE_SPEED;
    const maxDelta = AIR_ACCEL * airMult * dt;
    const diff = target - player.vx;
    if (Math.abs(diff) <= maxDelta) {
      player.vx = target;
    } else {
      player.vx += Math.sign(diff) * maxDelta;
    }
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if (player.y < player.minY) {
    player.minY = player.y;
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<typeof createPlayer>} player
 * @param {{ hat?: boolean, goldenSword?: boolean }} [cosmetics]
 */
export function draw(ctx, player, cosmetics = {}) {
  const { hat = false, goldenSword = false } = cosmetics;
  const f = player.facing;
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  const cx = x + Math.floor(player.w / 2);

  // Legs
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(cx - 5, y + 18, 4, 8);
  ctx.fillRect(cx + 1, y + 18, 4, 8);

  // Boots
  ctx.fillStyle = '#5c4030';
  ctx.fillRect(cx - 6, y + 24, 5, 2);
  ctx.fillRect(cx + 1, y + 24, 5, 2);

  // Body tunic
  ctx.fillStyle = '#2d6a4f';
  ctx.fillRect(cx - 6, y + 8, 12, 11);

  // Belt
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(cx - 6, y + 15, 12, 2);

  // Head
  ctx.fillStyle = '#e8b896';
  ctx.fillRect(cx - 5, y + 2, 10, 7);

  // Hair
  ctx.fillStyle = '#4a3728';
  ctx.fillRect(cx - 5, y + 1, 10, 3);

  // Eyes
  ctx.fillStyle = '#1a1a1a';
  if (f >= 0) {
    ctx.fillRect(cx + 1, y + 4, 2, 2);
  } else {
    ctx.fillRect(cx - 3, y + 4, 2, 2);
  }

  // Hat cosmetic
  if (hat) {
    ctx.fillStyle = '#8b2500';
    ctx.fillRect(cx - 6, y - 1, 12, 3);
    ctx.fillRect(cx - 4, y - 5, 8, 4);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(cx - 1, y - 5, 2, 2);
  }

  // Shield (behind facing side)
  const shieldX = f >= 0 ? cx - 9 : cx + 5;
  ctx.fillStyle = '#6c757d';
  ctx.fillRect(shieldX, y + 9, 4, 8);
  ctx.fillStyle = '#adb5bd';
  ctx.fillRect(shieldX + 1, y + 10, 2, 6);

  // Sword
  const swordX = f >= 0 ? cx + 6 : cx - 8;
  ctx.fillStyle = goldenSword ? '#ffd700' : '#c0c0c0';
  ctx.fillRect(swordX, y + 6, 2, 12);
  ctx.fillStyle = goldenSword ? '#b8860b' : '#8b6914';
  ctx.fillRect(swordX - 1, y + 10, 4, 2);
  // Tip
  ctx.fillStyle = goldenSword ? '#fff3a0' : '#e8e8e8';
  ctx.fillRect(swordX, y + 4, 2, 2);

  // Charge crouch squash
  if (player.grounded && player.charge > 0) {
    const squash = Math.floor(player.charge * 3);
    ctx.fillStyle = 'rgba(255, 220, 100, 0.35)';
    ctx.fillRect(x - 2, y + player.h - 2, player.w + 4, 2 + squash);
  }
}
