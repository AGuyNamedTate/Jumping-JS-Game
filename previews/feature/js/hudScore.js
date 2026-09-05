/**
 * HUD score juice — ticking display score + scale pulse while ascending.
 */

import {
  SCORE_TICK_RATE,
  HUD_SCORE_SCALE_MIN,
  HUD_SCORE_SCALE_MAX,
} from './constants.js';

/**
 * @typedef {object} HudScore
 * @property {(h: number, score: number) => void} setTrueScore
 * @property {(ascending: boolean) => void} setAscending
 * @property {() => void} onLand
 * @property {(dt: number) => void} update
 * @property {() => number} getDisplayScore
 * @property {() => number} getScale
 * @property {(scoreEl: HTMLElement|null) => void} applyToDom
 * @property {() => void} reset
 */

/**
 * @returns {HudScore}
 */
export function createHudScore() {
  let trueScore = 0;
  let displayScore = 0;
  let ascending = false;
  let scale = HUD_SCORE_SCALE_MIN;
  /** 0–1 progress toward max scale while climbing this hop */
  let ascentProgress = 0;
  /** When true, hold scale (apex / falling) until land eases down */
  let holdScale = false;
  /** Landing ease target */
  let landing = false;

  /**
   * @param {number} _height climb height (reserved for future juice)
   * @param {number} score
   */
  function setTrueScore(_height, score) {
    trueScore = Math.max(0, Math.floor(score));
  }

  /**
   * @param {boolean} isAscending
   */
  function setAscending(isAscending) {
    const next = Boolean(isAscending);
    if (next && !ascending) {
      // New hop upward — grow scale from current toward max
      ascentProgress = 0;
      holdScale = false;
      landing = false;
    }
    if (!next && ascending) {
      // Left ascending (apex / falling) — hold current scale
      holdScale = true;
      landing = false;
    }
    ascending = next;
  }

  function onLand() {
    ascending = false;
    holdScale = false;
    landing = true;
    ascentProgress = 0;
  }

  /**
   * @param {number} dt seconds
   */
  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;

    // Tick display toward true
    if (displayScore < trueScore) {
      displayScore = Math.min(trueScore, displayScore + SCORE_TICK_RATE * dt);
    } else if (displayScore > trueScore) {
      displayScore = Math.max(trueScore, displayScore - SCORE_TICK_RATE * dt);
    }

    if (ascending && !holdScale) {
      // Fill progress over ~0.45s of continuous ascent
      ascentProgress = Math.min(1, ascentProgress + dt / 0.45);
      const t = ascentProgress;
      scale =
        HUD_SCORE_SCALE_MIN +
        (HUD_SCORE_SCALE_MAX - HUD_SCORE_SCALE_MIN) * t;
    } else if (holdScale) {
      // Keep scale at current value
    } else if (landing) {
      const ease = 6; // ~settle in ~0.35s
      scale += (HUD_SCORE_SCALE_MIN - scale) * Math.min(1, ease * dt);
      if (Math.abs(scale - HUD_SCORE_SCALE_MIN) < 0.002) {
        scale = HUD_SCORE_SCALE_MIN;
        landing = false;
      }
    } else {
      scale = HUD_SCORE_SCALE_MIN + (scale - HUD_SCORE_SCALE_MIN) * Math.exp(-8 * dt);
      if (Math.abs(scale - HUD_SCORE_SCALE_MIN) < 0.002) {
        scale = HUD_SCORE_SCALE_MIN;
      }
    }
  }

  function getDisplayScore() {
    return Math.floor(displayScore);
  }

  function getScale() {
    return scale;
  }

  /**
   * @param {HTMLElement|null} scoreEl
   */
  function applyToDom(scoreEl) {
    if (!scoreEl) return;
    scoreEl.textContent = String(getDisplayScore());
    const s = getScale();
    scoreEl.style.transform = `translateX(-50%) scale(${s.toFixed(3)})`;
    scoreEl.style.transformOrigin = 'center top';
  }

  function reset() {
    trueScore = 0;
    displayScore = 0;
    ascending = false;
    scale = HUD_SCORE_SCALE_MIN;
    ascentProgress = 0;
    holdScale = false;
    landing = false;
  }

  return {
    setTrueScore,
    setAscending,
    onLand,
    update,
    getDisplayScore,
    getScale,
    applyToDom,
    reset,
  };
}
