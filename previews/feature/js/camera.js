/**
 * Upward-only camera, death/danger lines, height scoring.
 */

import {
  LOGICAL_HEIGHT,
  DANGER_LINE_MARGIN,
  SCORE_PER_HEIGHT,
} from './constants.js';

/** Keep player roughly in the lower-middle of the view */
const FOLLOW_OFFSET = LOGICAL_HEIGHT * 0.45;

/**
 * @returns {{ y: number, startY: number }}
 */
export function createCamera() {
  return {
    /** World y of the top of the viewport */
    y: 0,
    /** Player y at run start (for height = startY - minY) */
    startY: 0,
  };
}

/**
 * @param {ReturnType<typeof createCamera>} camera
 * @param {number} playerY
 */
export function reset(camera, playerY) {
  camera.startY = playerY;
  camera.y = playerY - FOLLOW_OFFSET;
}

/**
 * Follow player upward only (never scroll down).
 * @param {ReturnType<typeof createCamera>} camera
 * @param {{ y: number }} player
 */
export function update(camera, player) {
  const desired = player.y - FOLLOW_OFFSET;
  if (desired < camera.y) {
    camera.y = desired;
  }
}

/**
 * Past the danger margin below the viewport.
 * @param {ReturnType<typeof createCamera>} camera
 * @param {{ y: number, h?: number }} player
 */
export function isDead(camera, player) {
  const deathY = camera.y + LOGICAL_HEIGHT + DANGER_LINE_MARGIN;
  return player.y > deathY;
}

/**
 * At/below the bottom of the view but not yet past the death margin.
 * Used to trigger the continue offer.
 * @param {ReturnType<typeof createCamera>} camera
 * @param {{ y: number }} player
 */
export function isInDanger(camera, player) {
  const viewBottom = camera.y + LOGICAL_HEIGHT;
  const deathY = viewBottom + DANGER_LINE_MARGIN;
  return player.y > viewBottom && player.y <= deathY;
}

/**
 * Climb height in world pixels (higher = larger).
 * @param {ReturnType<typeof createCamera>} camera
 * @param {{ minY: number }} player
 */
export function getHeight(camera, player) {
  return Math.max(0, camera.startY - player.minY);
}

/**
 * @param {number} height
 */
export function getScore(height) {
  return Math.floor(height / SCORE_PER_HEIGHT);
}
