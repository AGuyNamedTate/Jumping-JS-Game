import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  drawSky,
  drawPlatform,
  drawPlayer,
  drawBird,
  drawChargeBar,
  spawnLandDust,
  spawnBreakDebris,
  updateParticles,
  drawParticles,
  clearParticles,
} from '../js/art.js';
import { createMock2dContext, stubCanvas2d } from './setup.js';

describe('art', () => {
  /** @type {CanvasRenderingContext2D} */
  let ctx;

  beforeEach(() => {
    clearParticles();
    const canvas = document.getElementById('game-canvas');
    ctx = stubCanvas2d(canvas);
  });

  afterEach(() => {
    clearParticles();
  });

  describe('drawSky', () => {
    it('fills gradient sky, aurora, stars, and peaks', () => {
      drawSky(ctx, 0, 360, 640);
      expect(ctx.createLinearGradient).toHaveBeenCalled();
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('varies parallax with different cameraY values', () => {
      drawSky(ctx, 0, 360, 640);
      const fillsAt0 = ctx.fillRect.mock.calls.length;
      drawSky(ctx, 200, 360, 640);
      drawSky(ctx, 800, 360, 640);
      expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(fillsAt0);
    });
  });

  describe('drawPlatform', () => {
    it('skips broken platforms', () => {
      drawPlatform(ctx, { x: 10, y: 100, w: 64, broken: true }, 0);
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('draws solid stone ledge', () => {
      drawPlatform(ctx, { x: 20, y: 200, width: 80, shaky: false }, 0);
      const styles = ctx.fillRect.mock.invocationCallOrder.length;
      expect(styles).toBeGreaterThan(0);
      expect(String(ctx.fillStyle)).toMatch(/#/);
    });

    it('defaults platform width to 64 when w/width omitted', () => {
      drawPlatform(ctx, { x: 0, y: 10 }, 0);
      // first fillRect width arg should be 64
      expect(ctx.fillRect.mock.calls[0][2]).toBe(64);
    });

    it('draws shaky wood plank without shake offset when timer is 0', () => {
      drawPlatform(ctx, { x: 30, y: 300, w: 70, shaky: true, shakeTimer: 0 }, 50);
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('applies shake offset when shaky with shakeTimer > 0', () => {
      vi.spyOn(performance, 'now').mockReturnValue(1000);
      drawPlatform(ctx, { x: 40, y: 400, w: 64, shaky: true, shakeTimer: 1.5 }, 0);
      expect(ctx.fillRect).toHaveBeenCalled();
      const firstX = ctx.fillRect.mock.calls[0][0];
      expect(typeof firstX).toBe('number');
    });

    it('treats missing shakeTimer as 0 for shaky platforms', () => {
      drawPlatform(ctx, { x: 1, y: 2, w: 50, shaky: true }, 0);
      expect(ctx.fillRect).toHaveBeenCalled();
    });
  });

  describe('drawPlayer', () => {
    const base = { x: 100, y: 200, w: 28, h: 36 };

    it('draws facing right without cosmetics', () => {
      drawPlayer(ctx, { ...base, facing: 1 }, 0, null);
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('draws facing left with hat and golden sword', () => {
      drawPlayer(ctx, { ...base, facing: -1 }, 10, {
        hat: true,
        goldenSword: true,
      });
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
      // gold accent fillRect for sword glow
      expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(10);
    });

    it('accepts goldSword alias and default facing', () => {
      drawPlayer(ctx, { x: 50, y: 80 }, 0, { goldSword: true, hat: false });
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('defaults size and facing when omitted; empty cosmetics object', () => {
      drawPlayer(ctx, { x: 0, y: 0 }, 0);
      drawPlayer(ctx, { x: 0, y: 0, facing: 0 }, 0, {});
      expect(ctx.fillRect).toHaveBeenCalled();
    });
  });

  describe('drawBird', () => {
    it('draws wing up when flap sine is positive', () => {
      vi.spyOn(performance, 'now').mockReturnValue(0);
      drawBird(ctx, 50, 100, 0);
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('draws wing down when flap sine is non-positive', () => {
      // sin(t * 0.012) <= 0
      vi.spyOn(performance, 'now').mockReturnValue(Math.PI / 0.012);
      drawBird(ctx, 60, 120, 20);
      expect(ctx.fillRect).toHaveBeenCalled();
    });
  });

  describe('drawChargeBar', () => {
    it('returns early when charge is near zero', () => {
      drawChargeBar(ctx, { x: 10, y: 20, w: 28 }, 0, 0);
      expect(ctx.fillRect).not.toHaveBeenCalled();
      drawChargeBar(ctx, { x: 10, y: 20 }, 0, 0.0005);
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('draws clamped fill for mid and full charge', () => {
      drawChargeBar(ctx, { x: 40, y: 100, w: 28 }, 0, 0.5);
      expect(ctx.createLinearGradient).toHaveBeenCalled();
      expect(ctx.fillRect).toHaveBeenCalled();
      drawChargeBar(ctx, { x: 40, y: 100 }, 0, 2);
      expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(3);
    });
  });

  describe('particles', () => {
    it('spawns land dust, break debris (wood and stone), updates, draws, clears', () => {
      spawnLandDust(100, 200);
      spawnBreakDebris(50, 80, 48, true);
      spawnBreakDebris(60, 90, 32, false);
      spawnBreakDebris(70, 100); // defaults

      drawParticles(ctx, 0);
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.globalAlpha).toBe(1);

      // Expire some particles gradually
      for (let i = 0; i < 40; i++) {
        updateParticles(0.05);
      }
      drawParticles(ctx, 10);

      clearParticles();
      const before = ctx.fillRect.mock.calls.length;
      drawParticles(ctx, 0);
      expect(ctx.fillRect.mock.calls.length).toBe(before);
    });

    it('updateParticles removes expired and applies gravity', () => {
      clearParticles();
      spawnLandDust(0, 0);
      updateParticles(0.01);
      updateParticles(10); // wipe all
      const ctx2 = createMock2dContext();
      drawParticles(ctx2, 0);
      expect(ctx2.fillRect).not.toHaveBeenCalled();
    });
  });
});
