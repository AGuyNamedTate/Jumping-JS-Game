import { describe, it, expect, vi } from 'vitest';
import { PRICE_HAT, PRICE_GOLDEN_SWORD } from '../js/constants.js';
import {
  CATALOG,
  getEquippedVisuals,
  drawPreview,
} from '../js/cosmetics.js';

function makeCtx() {
  return {
    fillStyle: '',
    fillRect: vi.fn(),
  };
}

describe('cosmetics.CATALOG', () => {
  it('defines hat and goldenSword with prices and slots', () => {
    expect(CATALOG.hat).toEqual({
      id: 'hat',
      name: 'Adventurer Hat',
      price: PRICE_HAT,
      slot: 'hat',
    });
    expect(CATALOG.goldenSword).toEqual({
      id: 'goldenSword',
      name: 'Golden Sword',
      price: PRICE_GOLDEN_SWORD,
      slot: 'sword',
    });
    expect(PRICE_HAT).toBe(500);
    expect(PRICE_GOLDEN_SWORD).toBe(1_000_000);
  });
});

describe('cosmetics.getEquippedVisuals', () => {
  it('reads object equipped form', () => {
    expect(
      getEquippedVisuals({
        equipped: { hat: 'hat', sword: 'golden' },
      }),
    ).toEqual({ hat: true, goldenSword: true });
    expect(
      getEquippedVisuals({
        equipped: { hat: null, sword: 'default' },
      }),
    ).toEqual({ hat: false, goldenSword: false });
  });

  it('reads legacy string equipped form', () => {
    expect(getEquippedVisuals({ equipped: 'hat' })).toEqual({
      hat: true,
      goldenSword: false,
    });
    expect(getEquippedVisuals({ equipped: 'goldenSword' })).toEqual({
      hat: false,
      goldenSword: true,
    });
    expect(getEquippedVisuals({ equipped: 'cape' })).toEqual({
      hat: false,
      goldenSword: false,
    });
  });

  it('returns false visuals for null / undefined equipped or save', () => {
    expect(getEquippedVisuals({ equipped: null })).toEqual({
      hat: false,
      goldenSword: false,
    });
    expect(getEquippedVisuals({ equipped: undefined })).toEqual({
      hat: false,
      goldenSword: false,
    });
    expect(getEquippedVisuals(/** @type {any} */ (null))).toEqual({
      hat: false,
      goldenSword: false,
    });
    expect(getEquippedVisuals(/** @type {any} */ (undefined))).toEqual({
      hat: false,
      goldenSword: false,
    });
  });
});

describe('cosmetics.drawPreview', () => {
  it('draws base adventurer without cosmetics', () => {
    const styles = [];
    const ctx = {
      fillStyle: '',
      fillRect: vi.fn(function fillRect() {
        styles.push(this.fillStyle);
      }),
    };
    drawPreview(/** @type {any} */ (ctx), 10, 20, {
      hat: false,
      goldenSword: false,
    });
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(styles).toContain('#9a9da5'); // default blade
    expect(styles).not.toContain('#e8a838'); // golden blade
    expect(styles).not.toContain('#6b4a2a'); // hat brim
  });

  it('draws hat pixels when hat is on', () => {
    const styles = [];
    const ctx = {
      fillStyle: '',
      fillRect: vi.fn(function fillRect() {
        styles.push(this.fillStyle);
      }),
    };
    drawPreview(/** @type {any} */ (ctx), 0, 0, { hat: true, goldenSword: false });
    expect(styles).toContain('#6b4a2a');
    expect(styles).toContain('#8a6238');
  });

  it('draws golden sword when goldenSword is on', () => {
    const styles = [];
    const ctx = {
      fillStyle: '',
      fillRect: vi.fn(function fillRect() {
        styles.push(this.fillStyle);
      }),
    };
    drawPreview(/** @type {any} */ (ctx), 5.7, 8.2, {
      hat: false,
      goldenSword: true,
    });
    expect(styles).toContain('#e8a838');
    expect(styles).toContain('#f5d078');
    expect(styles).toContain('#8a7050');
    expect(styles).toContain('#5a4030');
    expect(styles).not.toContain('#9a9da5');
  });

  it('draws both hat and golden sword when both are on', () => {
    const styles = [];
    const ctx = {
      fillStyle: '',
      fillRect: vi.fn(function fillRect() {
        styles.push(this.fillStyle);
      }),
    };
    drawPreview(/** @type {any} */ (ctx), 24, 18, {
      hat: true,
      goldenSword: true,
    });
    expect(styles).toContain('#6b4a2a');
    expect(styles).toContain('#e8a838');
  });

  it('floors x/y and scales rects by pixel size 3', () => {
    const ctx = makeCtx();
    drawPreview(/** @type {any} */ (ctx), 10.9, 20.2, {});
    // First leg: px(1, 10, 2, 3) → fillRect(floor(10.9)+1*3, floor(20.2)+10*3, 2*3, 3*3)
    expect(ctx.fillRect).toHaveBeenCalledWith(10 + 3, 20 + 30, 6, 9);
  });

  it('defaults visuals to empty object', () => {
    const styles = [];
    const ctx = {
      fillStyle: '',
      fillRect: vi.fn(function fillRect() {
        styles.push(this.fillStyle);
      }),
    };
    drawPreview(/** @type {any} */ (ctx), 0, 0);
    expect(styles).toContain('#9a9da5');
  });
});
