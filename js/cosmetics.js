/**
 * Cosmetic catalog + shared pixel adventurer for Fantasy Peak Climber.
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

/** Logical sprite size in grid units (hat may draw above y=0). */
export const ADVENTURER_W = 8;
export const ADVENTURER_H = 13;

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
 * Shared shop + in-game pixel adventurer (brown hat, sword + shield).
 * Origin is the top-left of the body grid (unit 0,0); hat may draw above.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} originX
 * @param {number} originY
 * @param {number} scale pixel size per grid unit
 * @param {{ hat?: boolean, goldenSword?: boolean, facing?: number }} [visuals]
 */
export function drawAdventurer(ctx, originX, originY, scale, visuals = {}) {
  const s = Math.max(1, Math.floor(scale));
  const ox = Math.floor(originX);
  const oy = Math.floor(originY);
  const face = (visuals.facing ?? 1) >= 0 ? 1 : -1;

  const mapX = (dx, w) => {
    if (face >= 0) return ox + dx * s;
    return ox + (ADVENTURER_W - dx - w) * s;
  };

  const px = (dx, dy, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(mapX(dx, w), oy + dy * s, w * s, h * s);
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
    // Wide brim brown adventurer hat (same as shop)
    px(1, 0, 6, 1, '#6b4a2a');
    px(2, -1, 4, 1, '#8a6238');
    px(3, -2, 2, 1, '#6b4a2a');
  }

  // Shield (opposite facing side)
  px(-1, 6, 2, 4, '#6b6e76');
  px(-1, 7, 2, 2, '#9a9da5');

  if (visuals.goldenSword) {
    px(8, 4, 1, 6, '#e8a838');
    px(8, 3, 1, 1, '#f5d078');
    px(7, 9, 3, 1, '#8a7050');
    px(8, 10, 1, 2, '#5a4030');
  } else {
    px(8, 6, 1, 4, '#9a9da5');
    px(7, 9, 3, 1, '#6b6e76');
  }
}

/**
 * Draw a simple pixel adventurer centered near (x, y) for the store preview.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {{ hat?: boolean, goldenSword?: boolean }} visuals
 */
export function drawPreview(ctx, x, y, visuals = {}) {
  drawAdventurer(ctx, Math.floor(x), Math.floor(y), 3, {
    hat: !!visuals.hat,
    goldenSword: !!visuals.goldenSword,
    facing: 1,
  });
}
