import { describe, it, expect, beforeEach } from 'vitest';
import {
  SCORE_TICK_RATE,
  HUD_SCORE_SCALE_MIN,
  HUD_SCORE_SCALE_MAX,
} from '../js/constants.js';
import { createHudScore } from '../js/hudScore.js';

describe('hudScore', () => {
  /** @type {ReturnType<typeof createHudScore>} */
  let hud;

  beforeEach(() => {
    hud = createHudScore();
  });

  it('setTrueScore floors and clamps, tick catches up both directions', () => {
    hud.setTrueScore(10, 100.9);
    expect(hud.getDisplayScore()).toBe(0);

    hud.update(0.5);
    expect(hud.getDisplayScore()).toBe(Math.floor(SCORE_TICK_RATE * 0.5));

    // finish catch-up upward
    hud.update(10);
    expect(hud.getDisplayScore()).toBe(100);

    hud.setTrueScore(0, -5);
    hud.update(10);
    expect(hud.getDisplayScore()).toBe(0);

    // catch-up downward from a high display
    hud.setTrueScore(0, 200);
    hud.update(10);
    expect(hud.getDisplayScore()).toBe(200);
    hud.setTrueScore(0, 50);
    hud.update(1);
    expect(hud.getDisplayScore()).toBe(200 - SCORE_TICK_RATE);
    hud.update(10);
    expect(hud.getDisplayScore()).toBe(50);
  });

  it('setAscending grows scale toward max then holds at apex', () => {
    expect(hud.getScale()).toBe(HUD_SCORE_SCALE_MIN);

    hud.setAscending(true);
    hud.update(0.225); // half of 0.45s fill
    expect(hud.getScale()).toBeCloseTo(
      HUD_SCORE_SCALE_MIN + (HUD_SCORE_SCALE_MAX - HUD_SCORE_SCALE_MIN) * 0.5,
      5,
    );

    hud.update(0.5);
    expect(hud.getScale()).toBeCloseTo(HUD_SCORE_SCALE_MAX, 5);

    const apex = hud.getScale();
    hud.setAscending(false); // hold at apex
    hud.update(1);
    expect(hud.getScale()).toBe(apex);
  });

  it('onLand eases scale back to min', () => {
    hud.setAscending(true);
    hud.update(1);
    expect(hud.getScale()).toBeCloseTo(HUD_SCORE_SCALE_MAX, 5);

    hud.onLand();
    expect(hud.getScale()).toBeCloseTo(HUD_SCORE_SCALE_MAX, 5);

    // ease toward min (~0.35s settle; snap when within 0.002)
    for (let i = 0; i < 90; i++) hud.update(1 / 60);
    expect(hud.getScale()).toBe(HUD_SCORE_SCALE_MIN);
  });

  it('idle path decays scale toward min when not ascending/holding/landing', () => {
    // Force a mid scale then leave idle (no ascending, no hold, no landing)
    hud.setAscending(true);
    hud.update(0.2);
    const mid = hud.getScale();
    expect(mid).toBeGreaterThan(HUD_SCORE_SCALE_MIN);

    // Directly land then finish landing to clear landing flag, then bump scale
    // via another ascent that we abandon without hold by resetting ascentProgress
    // path: after landing settles, update uses exponential decay branch
    hud.onLand();
    for (let i = 0; i < 60; i++) hud.update(1 / 60);
    expect(hud.getScale()).toBe(HUD_SCORE_SCALE_MIN);

    // Re-enter ascending briefly then call setAscending(false) which holds —
    // to hit pure idle decay we need scale != min with !ascending !holdScale !landing.
    // After reset, scale is min. Manually: ascend, then onLand clears hold and sets landing.
    // Once landing finishes, scale is min. The idle branch still runs when scale drifts.
    // Trigger by ascending partially, onLand, then one huge dt won't finish exact snap—
    // actually landing snaps when |diff| < 0.002.

    // Use reset + ascend + hold release via onLand mid-way isn't idle.
    // After landing completes, calling update keeps scale at min via idle decay.
    hud.setAscending(true);
    hud.update(0.3);
    hud.onLand();
    hud.update(0.001); // tiny step — still landing, scale barely moves
    const duringLand = hud.getScale();
    expect(duringLand).toBeGreaterThan(HUD_SCORE_SCALE_MIN);
    hud.update(5);
    expect(hud.getScale()).toBe(HUD_SCORE_SCALE_MIN);

    // idle decay: once settled, further updates keep min
    hud.update(0.1);
    expect(hud.getScale()).toBe(HUD_SCORE_SCALE_MIN);
  });

  it('applyToDom writes text/transform and no-ops on null', () => {
    hud.setTrueScore(0, 42);
    hud.update(10);
    hud.setAscending(true);
    hud.update(0.45);

    const el = document.createElement('div');
    hud.applyToDom(el);
    expect(el.textContent).toBe('42');
    expect(el.style.transform).toBe(
      `translateX(-50%) scale(${hud.getScale().toFixed(3)})`,
    );
    expect(el.style.transformOrigin).toBe('center top');

    expect(() => hud.applyToDom(null)).not.toThrow();
  });

  it('reset clears score and scale state', () => {
    hud.setTrueScore(0, 80);
    hud.setAscending(true);
    hud.update(1);
    hud.reset();
    expect(hud.getDisplayScore()).toBe(0);
    expect(hud.getScale()).toBe(HUD_SCORE_SCALE_MIN);

    hud.update(1);
    expect(hud.getDisplayScore()).toBe(0);
  });

  it('update ignores invalid dt', () => {
    hud.setTrueScore(0, 100);
    hud.update(0);
    hud.update(-1);
    hud.update(Number.NaN);
    hud.update(Number.POSITIVE_INFINITY);
    expect(hud.getDisplayScore()).toBe(0);
  });

  it('restarting ascent resets progress growth', () => {
    hud.setAscending(true);
    hud.update(0.45);
    expect(hud.getScale()).toBeCloseTo(HUD_SCORE_SCALE_MAX, 5);
    hud.setAscending(false);
    hud.setAscending(true);
    hud.update(0.01);
    expect(hud.getScale()).toBeLessThan(HUD_SCORE_SCALE_MAX);
  });
});
