import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as input from '../js/input.js';

function keyEvent(type, code, { repeat = false, preventDefault = vi.fn() } = {}) {
  const e = new KeyboardEvent(type, { code, bubbles: true, cancelable: true });
  Object.defineProperty(e, 'repeat', { value: repeat });
  e.preventDefault = preventDefault;
  return e;
}

function pointerEvent(type, { clientX = 180, pointerId = 1 } = {}) {
  return new PointerEvent(type, {
    clientX,
    pointerId,
    bubbles: true,
    cancelable: true,
  });
}

describe('input', () => {
  /** @type {HTMLCanvasElement} */
  let canvas;

  beforeEach(() => {
    canvas = /** @type {HTMLCanvasElement} */ (
      document.getElementById('game-canvas')
    );
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 360,
      height: 640,
      right: 360,
      bottom: 640,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    });
    input.init(canvas);
    input.reset();
  });

  afterEach(() => {
    input.reset();
  });

  it('reset clears charging and movement edges', () => {
    window.dispatchEvent(keyEvent('keydown', 'Space'));
    input.update();
    expect(input.getState().charging).toBe(true);
    input.reset();
    expect(input.getState()).toEqual({
      charging: false,
      chargeJustReleased: false,
      moveX: 0,
    });
  });

  describe('keyboard', () => {
    it('charges with Space and ArrowDown and preventDefaults', () => {
      const pd = vi.fn();
      window.dispatchEvent(keyEvent('keydown', 'Space', { preventDefault: pd }));
      input.update();
      expect(input.getState().charging).toBe(true);
      expect(pd).toHaveBeenCalled();

      input.reset();
      const pd2 = vi.fn();
      window.dispatchEvent(keyEvent('keydown', 'ArrowDown', { preventDefault: pd2 }));
      input.update();
      expect(input.getState().charging).toBe(true);
      expect(pd2).toHaveBeenCalled();
    });

    it('moves with A/D and arrow keys', () => {
      const pdA = vi.fn();
      window.dispatchEvent(keyEvent('keydown', 'KeyA', { preventDefault: pdA }));
      expect(pdA).toHaveBeenCalled();
      expect(input.getState().moveX).toBe(-1);

      window.dispatchEvent(keyEvent('keyup', 'KeyA'));
      window.dispatchEvent(keyEvent('keydown', 'KeyD'));
      expect(input.getState().moveX).toBe(1);

      window.dispatchEvent(keyEvent('keyup', 'KeyD'));
      window.dispatchEvent(keyEvent('keydown', 'ArrowLeft'));
      expect(input.getState().moveX).toBe(-1);

      window.dispatchEvent(keyEvent('keyup', 'ArrowLeft'));
      window.dispatchEvent(keyEvent('keydown', 'ArrowRight'));
      expect(input.getState().moveX).toBe(1);
    });

    it('handles key repeat path without double-preventDefault requirement', () => {
      const pd = vi.fn();
      window.dispatchEvent(
        keyEvent('keydown', 'Space', { repeat: true, preventDefault: pd }),
      );
      input.update();
      expect(input.getState().charging).toBe(true);
      // repeat path returns before preventDefault
      expect(pd).not.toHaveBeenCalled();
    });

    it('ignores unrelated keys', () => {
      window.dispatchEvent(keyEvent('keydown', 'KeyW'));
      input.update();
      expect(input.getState()).toMatchObject({
        charging: false,
        moveX: 0,
      });
    });
  });

  describe('update edge', () => {
    it('sets chargeJustReleased for one frame after release', () => {
      window.dispatchEvent(keyEvent('keydown', 'Space'));
      input.update();
      expect(input.getState().charging).toBe(true);
      expect(input.getState().chargeJustReleased).toBe(false);

      window.dispatchEvent(keyEvent('keyup', 'Space'));
      input.update();
      expect(input.getState().charging).toBe(false);
      expect(input.getState().chargeJustReleased).toBe(true);

      input.update();
      expect(input.getState().chargeJustReleased).toBe(false);
    });
  });

  describe('pointer', () => {
    it('pointerdown charges, captures, and preventDefaults', () => {
      const e = pointerEvent('pointerdown', { clientX: 100 });
      const pd = vi.spyOn(e, 'preventDefault');
      canvas.dispatchEvent(e);
      input.update();
      expect(input.getState().charging).toBe(true);
      expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
      expect(pd).toHaveBeenCalled();
    });

    it('pointermove updates lean moveX when no keys', () => {
      canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 360 }));
      // lean to right edge => moveX ~ 1
      expect(input.getState().moveX).toBeCloseTo(1, 5);

      canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 0 }));
      expect(input.getState().moveX).toBeCloseTo(-1, 5);

      canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 180 }));
      expect(input.getState().moveX).toBeCloseTo(0, 5);
    });

    it('keys override pointer lean for moveX', () => {
      canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 360 }));
      window.dispatchEvent(keyEvent('keydown', 'KeyA'));
      expect(input.getState().moveX).toBe(-1);
    });

    it('pointerup releases charge capture but can keep lean', () => {
      canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 300 }));
      input.update();
      expect(input.getState().charging).toBe(true);

      canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 300 }));
      input.update();
      expect(input.getState().charging).toBe(false);
      expect(input.getState().chargeJustReleased).toBe(true);
      expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);
      // lean still active after up
      expect(input.getState().moveX).toBeGreaterThan(0);
    });

    it('pointercancel and lostpointercapture end charge', () => {
      canvas.dispatchEvent(pointerEvent('pointerdown'));
      input.update();
      canvas.dispatchEvent(pointerEvent('pointercancel'));
      input.update();
      expect(input.getState().charging).toBe(false);

      canvas.dispatchEvent(pointerEvent('pointerdown'));
      input.update();
      canvas.dispatchEvent(new Event('lostpointercapture'));
      input.update();
      expect(input.getState().charging).toBe(false);
    });

    it('pointerleave clears lean only when not pressed', () => {
      canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 300 }));
      expect(input.getState().moveX).toBeGreaterThan(0);
      canvas.dispatchEvent(new Event('pointerleave'));
      expect(input.getState().moveX).toBe(0);

      canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 300 }));
      canvas.dispatchEvent(new Event('pointerleave'));
      // still pressed — lean remains
      expect(input.getState().moveX).toBeGreaterThan(0);
    });

    it('blur clears pointer and keys without forcing chargeJustReleased', () => {
      window.dispatchEvent(keyEvent('keydown', 'Space'));
      window.dispatchEvent(keyEvent('keydown', 'KeyD'));
      canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 300 }));
      input.update();
      expect(input.getState().charging).toBe(true);

      window.dispatchEvent(new Event('blur'));
      expect(input.getState()).toEqual({
        charging: false,
        chargeJustReleased: false,
        moveX: 0,
      });
    });

    it('tolerates setPointerCapture / releasePointerCapture throwing', () => {
      canvas.setPointerCapture = vi.fn(() => {
        throw new Error('capture fail');
      });
      canvas.releasePointerCapture = vi.fn(() => {
        throw new Error('release fail');
      });
      expect(() => {
        canvas.dispatchEvent(pointerEvent('pointerdown'));
        canvas.dispatchEvent(pointerEvent('pointerup'));
      }).not.toThrow();
    });
  });
});
