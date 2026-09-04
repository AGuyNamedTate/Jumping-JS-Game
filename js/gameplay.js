/**
 * Session glue: player + platforms + camera + scoring / continues.
 * Not the full game.js state machine — call from there later.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './constants.js';
import * as playerMod from './player.js';
import * as platforms from './platforms.js';
import * as cameraMod from './camera.js';
import {
  createBirdRescue,
  updateBirdRescue as stepBirdRescue,
  isBirdRescueActive,
} from './birdRescue.js';

/**
 * @typedef {{
 *   player: ReturnType<typeof playerMod.createPlayer>,
 *   world: ReturnType<typeof platforms.createWorld>,
 *   camera: ReturnType<typeof cameraMod.createCamera>,
 *   maxHeight: number,
 *   score: number,
 *   continuesUsed: number,
 *   status: 'ok'|'danger'|'dead',
 *   cosmetics: { hat: boolean, goldenSword: boolean },
 *   onLand: ((platform: object) => void) | null,
 *   _wasGrounded: boolean,
 *   birdRescue: ReturnType<typeof createBirdRescue> | null,
 * }} Session
 */

/**
 * @param {{
 *   cosmetics?: { hat?: boolean, goldenSword?: boolean },
 *   onLand?: (platform: object) => void,
 * }} [opts]
 * @returns {Session}
 */
export function createSession(opts = {}) {
  const world = platforms.createWorld();
  const start = getStartPlatform(world);
  const px = start.x + start.w / 2 - playerMod.PLAYER_W / 2;
  const py = start.y - playerMod.PLAYER_H;
  const player = playerMod.createPlayer(px, py);
  player.grounded = true;

  const camera = cameraMod.createCamera();
  cameraMod.reset(camera, player.y);

  return {
    player,
    world,
    camera,
    maxHeight: 0,
    score: 0,
    continuesUsed: 0,
    status: 'ok',
    cosmetics: {
      hat: !!opts.cosmetics?.hat,
      goldenSword: !!opts.cosmetics?.goldenSword,
    },
    onLand: opts.onLand ?? null,
    _wasGrounded: true,
    birdRescue: null,
  };
}

/**
 * @param {Session} session
 * @param {{
 *   cosmetics?: { hat?: boolean, goldenSword?: boolean },
 *   onLand?: (platform: object) => void,
 * }} [opts]
 */
export function resetSession(session, opts = {}) {
  platforms.reset(session.world);
  const start = getStartPlatform(session.world);
  const px = start.x + start.w / 2 - playerMod.PLAYER_W / 2;
  const py = start.y - playerMod.PLAYER_H;
  playerMod.reset(session.player, px, py);
  session.player.grounded = true;
  cameraMod.reset(session.camera, session.player.y);

  session.maxHeight = 0;
  session.score = 0;
  session.continuesUsed = 0;
  session.status = 'ok';
  session._wasGrounded = true;
  session.birdRescue = null;

  if (opts.cosmetics) {
    session.cosmetics.hat = !!opts.cosmetics.hat;
    session.cosmetics.goldenSword = !!opts.cosmetics.goldenSword;
  }
  if (opts.onLand !== undefined) {
    session.onLand = opts.onLand;
  }
}

/**
 * @param {Session} session
 * @param {number} dt
 * @param {{ charging: boolean, chargeJustReleased: boolean, moveX: number }} input
 * @returns {'ok'|'danger'|'dead'}
 */
export function updateSession(session, dt, input) {
  if (session.status === 'dead') return 'dead';
  // Gameplay frozen while the rescue bird cinematic plays.
  if (isRescueBirdAnimating(session)) return session.status;

  const { player, world, camera } = session;

  let standing = platforms.getStandingPlatform(world, player);
  if (standing?.broken) standing = null;
  // Only treat as grounded when not ascending (one-way platforms)
  const onGround = !!standing && player.vy >= 0;

  playerMod.update(player, dt, input, onGround);

  // Horizontal wrap
  if (player.x + player.w < 0) player.x = LOGICAL_WIDTH;
  else if (player.x > LOGICAL_WIDTH) player.x = -player.w;

  const landed = platforms.tryLand(world, player);
  if (landed) {
    player.grounded = true;
    if (!session._wasGrounded && typeof session.onLand === 'function') {
      session.onLand(landed);
    }
  }

  // Stick to platform only while falling/resting — never snap while jumping up through
  standing = platforms.getStandingPlatform(world, player);
  if (standing?.broken) {
    player.grounded = false;
  } else if (standing && player.vy >= 0) {
    player.grounded = true;
    player.y = standing.y - player.h;
    player.vy = 0;
    if (standing.type === 'shaky' && standing.shakeTimer <= 0) {
      standing.shakeTimer = 0.0001;
    }
  } else {
    // Ascending (vy < 0) or mid-air: pass through platform tops
    if (player.vy < 0) player.grounded = false;
    else if (!standing) player.grounded = false;
  }

  session._wasGrounded = player.grounded;

  platforms.update(world, dt, camera.y);
  cameraMod.update(camera, player);

  const height = cameraMod.getHeight(camera, player);
  if (height > session.maxHeight) {
    session.maxHeight = height;
    session.score = cameraMod.getScore(height);
  }

  if (cameraMod.isDead(camera, player)) {
    session.status = 'dead';
  } else if (cameraMod.isInDanger(camera, player)) {
    session.status = 'danger';
  } else {
    session.status = 'ok';
  }

  return session.status;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Session} session
 */
export function drawSession(ctx, session) {
  const { world, player, camera, cosmetics } = session;

  platforms.draw(ctx, world, camera);

  // Danger line cue at viewport bottom
  if (session.status === 'danger' || session.status === 'dead') {
    ctx.fillStyle = 'rgba(180, 40, 40, 0.55)';
    ctx.fillRect(0, LOGICAL_HEIGHT - 3, LOGICAL_WIDTH, 3);
  } else {
    ctx.fillStyle = 'rgba(120, 30, 30, 0.25)';
    ctx.fillRect(0, LOGICAL_HEIGHT - 2, LOGICAL_WIDTH, 2);
  }

  const savedX = player.x;
  const savedY = player.y;
  player.x = savedX;
  player.y = savedY - camera.y;
  playerMod.draw(ctx, player, cosmetics);
  player.x = savedX;
  player.y = savedY;
}

/**
 * Instantly place player on rescue target; bumps continuesUsed.
 * Prefer {@link startRescueBird} for the live continue cinematic.
 * @param {Session} session
 * @returns {boolean}
 */
export function applyRescueBird(session) {
  const target = platforms.findRescueTarget(session.world, session.player.y);
  if (!target) return false;

  placePlayerOnPlatform(session, target);
  session.birdRescue = null;
  session.continuesUsed += 1;
  session.status = 'ok';
  return true;
}

/**
 * Begin bird rescue cinematic (pause physics until complete).
 * Bumps continuesUsed once at start; final placement happens in {@link updateRescueBird}.
 * @param {Session} session
 * @returns {boolean}
 */
export function startRescueBird(session) {
  const target = platforms.findRescueTarget(session.world, session.player.y);
  if (!target) return false;

  const p = session.player;
  p.vx = 0;
  p.vy = 0;
  p.charge = 0;
  p.grounded = false;

  const anim = createBirdRescue(p, target);
  if (!anim) return false;

  session.birdRescue = anim;
  session.continuesUsed += 1;
  session.status = 'ok';
  return true;
}

/**
 * Advance bird rescue cinematic; syncs player pose. Returns true when it just finished.
 * @param {Session} session
 * @param {number} dt
 * @returns {boolean}
 */
export function updateRescueBird(session, dt) {
  if (!session.birdRescue) return false;

  const { done } = stepBirdRescue(session.birdRescue, dt);
  const anim = session.birdRescue;
  const p = session.player;
  p.x = anim.playerX;
  p.y = anim.playerY;
  p.vx = 0;
  p.vy = 0;
  p.charge = 0;
  p.grounded = false;

  framePlayerInView(session);

  if (!done) return false;

  p.x = anim.destX;
  p.y = anim.destY;
  p.vx = 0;
  p.vy = 0;
  p.grounded = true;
  p.charge = 0;
  session.birdRescue = null;
  session.status = 'ok';
  session._wasGrounded = true;
  framePlayerInView(session);
  return true;
}

/**
 * @param {Session} session
 * @returns {boolean}
 */
export function isRescueBirdAnimating(session) {
  return isBirdRescueActive(session?.birdRescue);
}

/**
 * @param {Session} session
 * @param {{ x: number, y: number, w: number }} target
 */
function placePlayerOnPlatform(session, target) {
  const p = session.player;
  p.x = target.x + target.w / 2 - p.w / 2;
  p.y = target.y - p.h;
  p.vx = 0;
  p.vy = 0;
  p.grounded = true;
  p.charge = 0;
  framePlayerInView(session);
}

/**
 * Spawn a ledge under the falling player; bumps continuesUsed.
 * @param {Session} session
 * @returns {boolean}
 */
export function applySafetyPlatform(session) {
  const p = session.player;
  const ledge = platforms.spawnSafetyPlatform(session.world, p.x + p.w / 2, p.y);
  p.x = ledge.x + ledge.w / 2 - p.w / 2;
  p.y = ledge.y - p.h;
  p.vx = 0;
  p.vy = 0;
  p.grounded = true;
  p.charge = 0;

  framePlayerInView(session);
  session.continuesUsed += 1;
  session.status = 'ok';
  return true;
}

/**
 * @param {Session} session
 */
function framePlayerInView(session) {
  const p = session.player;
  cameraMod.update(session.camera, p);
  const viewBottom = session.camera.y + LOGICAL_HEIGHT;
  if (p.y + p.h > viewBottom - 40) {
    session.camera.y = p.y - LOGICAL_HEIGHT * 0.45;
  }
}

/**
 * @param {ReturnType<typeof platforms.createWorld>} world
 */
function getStartPlatform(world) {
  // Start ledge is the widest solid platform (140 vs procedural max 120)
  let best = world.platforms[0];
  for (const p of world.platforms) {
    if (p.w > best.w) best = p;
    else if (p.w === best.w && p.y < best.y) best = p;
  }
  return best;
}
