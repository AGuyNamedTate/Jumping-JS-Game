/**
 * Bird rescue cinematic: approach → lift → carry → done.
 * Pure state machine; gameplay/game wire pause + draw.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './constants.js';
import { PLAYER_W, PLAYER_H } from './player.js';

/** Total cinematic length (seconds) — within 2–3s requirement */
export const BIRD_RESCUE_DURATION = 2.5;
export const BIRD_RESCUE_DURATION_MIN = 2;
export const BIRD_RESCUE_DURATION_MAX = 3;

/** @deprecated Prefer BIRD_RESCUE_DURATION */
export const RESCUE_DURATION = BIRD_RESCUE_DURATION;
export const RESCUE_DURATION_MIN = BIRD_RESCUE_DURATION_MIN;
export const RESCUE_DURATION_MAX = BIRD_RESCUE_DURATION_MAX;

/**
 * Phase end times as fractions of total duration (exclusive upper bound style via phaseAt).
 * approach: 0–0.32, lift: 0.32–0.48, carry: 0.48–0.88, done: 0.88–1
 */
export const PHASE_WEIGHTS = Object.freeze({
  approach: 0.32,
  lift: 0.16,
  carry: 0.4,
  done: 0.12,
});

/** @typedef {'approach'|'lift'|'carry'|'done'} RescuePhase */

/**
 * @typedef {{
 *   active: boolean,
 *   t: number,
 *   duration: number,
 *   phase: RescuePhase,
 *   startX: number,
 *   startY: number,
 *   destX: number,
 *   destY: number,
 *   birdStartX: number,
 *   birdStartY: number,
 *   birdX: number,
 *   birdY: number,
 *   playerX: number,
 *   playerY: number,
 *   liftY: number,
 * }} BirdRescueAnim
 */

/**
 * @param {number} duration
 * @returns {number}
 */
function clampDuration(duration) {
  if (!Number.isFinite(duration)) return BIRD_RESCUE_DURATION;
  return Math.max(
    BIRD_RESCUE_DURATION_MIN,
    Math.min(BIRD_RESCUE_DURATION_MAX, duration),
  );
}

/**
 * Create an in-progress rescue cinematic toward a platform target.
 * @param {{ x: number, y: number, w?: number, h?: number }} player
 * @param {{ x: number, y: number, w: number }} target
 * @param {{ duration?: number }} [opts]
 * @returns {BirdRescueAnim}
 */
export function createBirdRescue(player, target, opts = {}) {
  const duration = clampDuration(
    opts.duration === undefined ? BIRD_RESCUE_DURATION : opts.duration,
  );

  const pw = player.w ?? PLAYER_W;
  const ph = player.h ?? PLAYER_H;
  const startX = player.x;
  const startY = player.y;
  const destX = target.x + target.w / 2 - pw / 2;
  const destY = target.y - ph;

  // Enter from clearly off-screen (above + side)
  const fromRight = startX < LOGICAL_WIDTH * 0.55;
  const birdStartX = fromRight ? LOGICAL_WIDTH + 48 : -48;
  const birdStartY = startY - LOGICAL_HEIGHT * 0.4;

  return {
    active: true,
    t: 0,
    duration,
    phase: 'approach',
    startX,
    startY,
    destX,
    destY,
    birdStartX,
    birdStartY,
    birdX: birdStartX,
    birdY: birdStartY,
    playerX: startX,
    playerY: startY,
    liftY: startY - 48,
  };
}

/**
 * @param {BirdRescueAnim | null | undefined} anim
 * @returns {boolean}
 */
export function isBirdRescueActive(anim) {
  return !!anim?.active;
}

/**
 * Advance cinematic; mutates anim positions.
 * @param {BirdRescueAnim} anim
 * @param {number} dt
 * @returns {{ done: boolean, phase: RescuePhase }}
 */
export function updateBirdRescue(anim, dt) {
  if (!anim?.active) {
    return { done: !anim?.active && !!anim, phase: anim?.phase ?? 'done' };
  }

  const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
  anim.t += step;

  if (anim.t >= anim.duration) {
    finishBirdRescue(anim);
    return { done: true, phase: 'done' };
  }

  const u = anim.t / anim.duration;
  const { phase, local } = phaseAt(u);
  anim.phase = phase;
  samplePose(anim, phase, local);

  return { done: false, phase };
}

/**
 * Snap to landing pose and deactivate.
 * @param {BirdRescueAnim} anim
 */
export function finishBirdRescue(anim) {
  anim.t = anim.duration;
  anim.phase = 'done';
  anim.playerX = anim.destX;
  anim.playerY = anim.destY;
  anim.birdX = anim.destX + 8;
  anim.birdY = anim.destY - 50;
  anim.active = false;
}

/**
 * @param {BirdRescueAnim | null | undefined} anim
 */
export function getBirdRescueDrawState(anim) {
  return {
    active: !!anim?.active,
    phase: anim?.phase ?? null,
    birdX: anim?.birdX ?? 0,
    birdY: anim?.birdY ?? 0,
    playerX: anim?.playerX ?? 0,
    playerY: anim?.playerY ?? 0,
    t: anim?.t ?? 0,
    duration: anim?.duration ?? BIRD_RESCUE_DURATION,
  };
}

/**
 * @param {number} u 0–1 overall progress
 * @returns {{ phase: RescuePhase, local: number }}
 */
export function phaseAt(u) {
  const clamped = Math.max(0, Math.min(1, u));
  let acc = 0;
  /** @type {RescuePhase[]} */
  const order = ['approach', 'lift', 'carry', 'done'];
  for (const phase of order) {
    const w = PHASE_WEIGHTS[phase];
    if (clamped < acc + w || phase === 'done') {
      const local = w > 0 ? (clamped - acc) / w : 1;
      return { phase, local: Math.max(0, Math.min(1, local)) };
    }
    acc += w;
  }
  return { phase: 'done', local: 1 };
}

/**
 * @param {number} t 0–1
 */
function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

/**
 * @param {number} px
 * @param {number} py
 */
function birdOverPlayer(px, py) {
  return { x: px - 4, y: py - 22 };
}

/**
 * @param {BirdRescueAnim} anim
 * @param {RescuePhase} phase
 * @param {number} local 0–1 within phase
 */
function samplePose(anim, phase, local) {
  const e = easeInOut(local);
  const gripStart = birdOverPlayer(anim.startX, anim.startY);
  const gripEnd = birdOverPlayer(anim.destX, anim.destY);

  if (phase === 'approach') {
    anim.playerX = anim.startX;
    anim.playerY = anim.startY;
    anim.birdX = lerp(anim.birdStartX, gripStart.x, e);
    anim.birdY = lerp(anim.birdStartY, gripStart.y, e);
    return;
  }

  if (phase === 'lift') {
    anim.playerX = anim.startX;
    anim.playerY = lerp(anim.startY, anim.liftY, e);
    const g = birdOverPlayer(anim.playerX, anim.playerY);
    anim.birdX = g.x;
    anim.birdY = g.y;
    return;
  }

  if (phase === 'carry') {
    anim.playerX = lerp(anim.startX, anim.destX, e);
    anim.playerY = lerp(anim.liftY, anim.destY - 12, e);
    const g = birdOverPlayer(anim.playerX, anim.playerY);
    anim.birdX = g.x;
    anim.birdY = g.y;
    return;
  }

  // done phase (settle onto platform; bird drifts away)
  anim.playerX = anim.destX;
  anim.playerY = lerp(anim.destY - 12, anim.destY, e);
  anim.birdX = lerp(gripEnd.x, gripEnd.x + 28, e);
  anim.birdY = lerp(gripEnd.y + 12, gripEnd.y - 40, e);
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}
