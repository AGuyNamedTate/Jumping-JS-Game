/**
 * Cosmetic catalog + pixel preview for Fantasy Peak Climber.
 */
import { PRICE_HAT, PRICE_GOLDEN_SWORD } from './constants.js';
/** @typedef {{ id: string, name: string, price: number, slot: 'hat' | 'sword' }} CosmeticItem */
/** @type {Record<string, CosmeticItem>} */
export const CATALOG = {
  hat: {
    id: 'hat',
    name: 'Adventurer Hat',
    price: PRICE_HAT,
    slot: 'hat',
  },
  goldenSword: {
    id: 'goldenSword',
    name: 'Golden Sword',
    price: PRICE_GOLDEN_SWORD,
    slot: 'sword',
  },
};
/**
 * @param {import('./storage.js').SaveData} save
 * @returns {{ hat: boolean, goldenSword: boolean }}
 */
export function getEquippedVisuals(save) {
  const eq = save?.equipped;
  if (!eq || typeof eq !== 'object') {
    // Legacy string equipped
    if (typeof eq === 'string') {
      return {
        hat: eq === 'hat',
        goldenSword: eq === 'goldenSword',
      };
    }
    return { hat: false, goldenSword: false };
  }
  return {
    hat: eq.hat === 'hat',
    goldenSword: eq.sword === 'golden',
  };
}
/**
 * Draw a simple pixel adventurer centered near (x, y).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {{ hat?: boolean, goldenSword?: boolean }} visuals
 */
export function drawPreview(ctx, x, y, visuals = {}) {
  const s = 3; // pixel scale
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const px = (dx, dy, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + dx * s, oy + dy * s, w * s, h * s);
  };
  // Legs
  px(1, 10, 2, 3, '#3d4048');
  px(5, 10, 2, 3, '#3d4048');
  // Boots
  px(1, 12, 2, 1, '#2a1a10');
  px(5, 12, 2, 1, '#2a1a10');
  // Body / tunic
  px(1, 5, 6, 5, '#3d6b4f');
  px(2, 6, 4, 3, '#5a9a6e');
  // Arms
  px(0, 6, 1, 3, '#c4a882');
  px(7, 6, 1, 3, '#c4a882');
  // Head
  px(2, 2, 4, 3, '#c4a882');
  // Eyes
  px(3, 3, 1, 1, '#0a0e14');
  px(5, 3, 1, 1, '#0a0e14');
  // Hair
  px(2, 1, 4, 1, '#2a1a10');
  if (visuals.hat) {
    // Wide brim hat
    px(1, 0, 6, 1, '#6b4a2a');
    px(2, -1, 4, 1, '#8a6238');
    px(3, -2, 2, 1, '#6b4a2a');
  }
  if (visuals.goldenSword) {
    // Sword held to the right
    px(8, 4, 1, 6, '#e8a838'); // blade
    px(8, 3, 1, 1, '#f5d078'); // tip glow
    px(7, 9, 3, 1, '#8a7050'); // guard
    px(8, 10, 1, 2, '#5a4030'); // hilt
  } else {
    // Default short sword / stick
    px(8, 6, 1, 4, '#9a9da5');
    px(7, 9, 3, 1, '#6b6e76');
  }
}
