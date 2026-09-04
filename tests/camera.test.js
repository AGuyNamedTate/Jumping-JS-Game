import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCamera,
  reset,
  update,
  isDead,
  isInDanger,
  getHeight,
  getScore,
} from '../js/camera.js';
import { LOGICAL_HEIGHT, DANGER_LINE_MARGIN, SCORE_PER_HEIGHT } from '../js/constants.js';

const FOLLOW_OFFSET = LOGICAL_HEIGHT * 0.45;

describe('camera', () => {
  /** @type {ReturnType<typeof createCamera>} */
  let camera;

  beforeEach(() => {
    camera = createCamera();
  });

  describe('createCamera', () => {
    it('starts at y=0 and startY=0', () => {
      expect(camera).toEqual({ y: 0, startY: 0 });
    });
  });

  describe('reset', () => {
    it('sets startY and places camera so player is in lower-middle', () => {
      reset(camera, 500);
      expect(camera.startY).toBe(500);
      expect(camera.y).toBe(500 - FOLLOW_OFFSET);
    });
  });

  describe('update', () => {
    it('moves upward when player climbs above follow offset', () => {
      reset(camera, 400);
      const initialY = camera.y;
      update(camera, { y: 200 });
      expect(camera.y).toBe(200 - FOLLOW_OFFSET);
      expect(camera.y).toBeLessThan(initialY);
    });

    it('never scrolls downward', () => {
      reset(camera, 200);
      const held = camera.y;
      update(camera, { y: 500 });
      expect(camera.y).toBe(held);
    });

    it('does nothing when desired equals current y', () => {
      camera.y = 100;
      update(camera, { y: 100 + FOLLOW_OFFSET });
      expect(camera.y).toBe(100);
    });
  });

  describe('isDead / isInDanger', () => {
    beforeEach(() => {
      camera.y = 0;
    });

    it('isDead is false above the death line', () => {
      const deathY = camera.y + LOGICAL_HEIGHT + DANGER_LINE_MARGIN;
      expect(isDead(camera, { y: deathY })).toBe(false);
      expect(isDead(camera, { y: deathY + 0.1 })).toBe(true);
    });

    it('isInDanger only between view bottom and death line', () => {
      const viewBottom = camera.y + LOGICAL_HEIGHT;
      const deathY = viewBottom + DANGER_LINE_MARGIN;

      expect(isInDanger(camera, { y: viewBottom })).toBe(false);
      expect(isInDanger(camera, { y: viewBottom + 1 })).toBe(true);
      expect(isInDanger(camera, { y: deathY })).toBe(true);
      expect(isInDanger(camera, { y: deathY + 1 })).toBe(false);
      expect(isInDanger(camera, { y: viewBottom - 1 })).toBe(false);
    });

    it('danger and dead regions do not overlap incorrectly', () => {
      const viewBottom = 100 + LOGICAL_HEIGHT;
      camera.y = 100;
      const mid = viewBottom + DANGER_LINE_MARGIN / 2;
      expect(isInDanger(camera, { y: mid })).toBe(true);
      expect(isDead(camera, { y: mid })).toBe(false);

      const past = viewBottom + DANGER_LINE_MARGIN + 1;
      expect(isDead(camera, { y: past })).toBe(true);
      expect(isInDanger(camera, { y: past })).toBe(false);
    });
  });

  describe('getHeight / getScore', () => {
    it('height is startY - minY, floored at 0', () => {
      camera.startY = 560;
      expect(getHeight(camera, { minY: 400 })).toBe(160);
      expect(getHeight(camera, { minY: 600 })).toBe(0);
      expect(getHeight(camera, { minY: 560 })).toBe(0);
    });

    it('score floors height / SCORE_PER_HEIGHT', () => {
      expect(getScore(0)).toBe(0);
      expect(getScore(9)).toBe(0);
      expect(getScore(10)).toBe(1);
      expect(getScore(109)).toBe(10);
      expect(getScore(1000)).toBe(Math.floor(1000 / SCORE_PER_HEIGHT));
    });
  });
});
