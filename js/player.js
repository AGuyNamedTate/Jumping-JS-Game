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
import { drawAdventurer, ADVENTURER_W, ADVENTURER_H } from './cosmetics.js';

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
 * Same adventurer sprite as shop / art.drawPlayer (world coords, cameraY = 0).
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<typeof createPlayer>} player
 * @param {{ hat?: boolean, goldenSword?: boolean }} [cosmetics]
 */
export function draw(ctx, player, cosmetics = {}) {
  const { hat = false, goldenSword = false } = cosmetics;
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  const scale = Math.max(1, Math.floor(Math.min(player.w / ADVENTURER_W, player.h / ADVENTURER_H)));
  const drawW = ADVENTURER_W * scale;
  const drawH = ADVENTURER_H * scale;
  const originX = x + Math.floor((player.w - drawW) / 2);
  const originY = y + player.h - drawH;

  drawAdventurer(ctx, originX, originY, scale, {
    hat,
    goldenSword,
    facing: player.facing,
  });

  // Charge crouch squash cue
  if (player.grounded && player.charge > 0) {
    const squash = Math.floor(player.charge * 3);
    ctx.fillStyle = 'rgba(255, 220, 100, 0.35)';
    ctx.fillRect(x - 2, y + player.h - 2, player.w + 4, 2 + squash);
  }
}
