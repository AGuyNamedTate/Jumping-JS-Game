/**
 * Continue / fail offer: countdown + rescue inventory buttons.
 */
import { CONTINUE_TIMEOUT } from './constants.js';
/** @type {ReturnType<typeof setInterval> | null} */
let timerId = null;
/** @type {number} */
let remaining = 0;
let active = false;
/** @type {null | {
 *   onUseBird: () => void,
 *   onUseSafety: () => void,
 *   onLetGo: () => void,
 * }} */
let handlers = null;
/**
 * Ensure #continue-timer exists under #screen-continue.
 * @returns {HTMLElement | null}
 */
function ensureTimerEl() {
  let el = document.getElementById('continue-timer');
  if (el) return el;
  const screen = document.getElementById('screen-continue');
  if (!screen) return null;
  el = document.createElement('p');
  el.id = 'continue-timer';
  el.className = 'continue-timer';
  el.textContent = String(CONTINUE_TIMEOUT);
  const nav = screen.querySelector('.menu-buttons');
  if (nav) screen.insertBefore(el, nav);
  else screen.appendChild(el);
  return el;
}
/**
 * @param {boolean} hasBird
 * @param {boolean} hasSafety
 */
function syncButtons(hasBird, hasSafety) {
  const birdBtn = /** @type {HTMLButtonElement | null} */ (
    document.getElementById('btn-use-bird')
  );
  const safetyBtn = /** @type {HTMLButtonElement | null} */ (
    document.getElementById('btn-use-safety')
  );
  if (birdBtn) {
    birdBtn.disabled = !hasBird;
    birdBtn.setAttribute('aria-disabled', String(!hasBird));
  }
  if (safetyBtn) {
    safetyBtn.disabled = !hasSafety;
    safetyBtn.setAttribute('aria-disabled', String(!hasSafety));
  }
}
function clearTimer() {
  if (timerId != null) {
    clearInterval(timerId);
    timerId = null;
  }
}
function finishLetGo() {
  const cb = handlers?.onLetGo;
  cancelContinueOffer();
  cb?.();
}
/**
 * Wire / refresh the continue offer UI and start the countdown.
 *
 * @param {{
 *   hasBird: boolean,
 *   hasSafety: boolean,
 *   onUseBird: () => void,
 *   onUseSafety: () => void,
 *   onLetGo: () => void,
 *   timeoutSec?: number,
 * }} opts
 */
export function manageContinueOffer(opts) {
  const timeoutSec = opts.timeoutSec ?? CONTINUE_TIMEOUT;
  handlers = {
    onUseBird: opts.onUseBird,
    onUseSafety: opts.onUseSafety,
    onLetGo: opts.onLetGo,
  };
  clearTimer();
  active = true;
  remaining = Math.max(1, Math.floor(timeoutSec));
  const timerEl = ensureTimerEl();
  if (timerEl) timerEl.textContent = String(remaining);
  syncButtons(opts.hasBird, opts.hasSafety);
  const birdBtn = document.getElementById('btn-use-bird');
  const safetyBtn = document.getElementById('btn-use-safety');
  const letGoBtn = document.getElementById('btn-let-go');
  const onBird = () => {
    if (!active || !opts.hasBird) return;
    const cb = handlers?.onUseBird;
    cancelContinueOffer();
    cb?.();
  };
  const onSafety = () => {
    if (!active || !opts.hasSafety) return;
    const cb = handlers?.onUseSafety;
    cancelContinueOffer();
    cb?.();
  };
  const onLetGo = () => {
    if (!active) return;
    finishLetGo();
  };
  // Replace listeners via property assignment to avoid stacking across offers
  if (birdBtn) birdBtn.onclick = onBird;
  if (safetyBtn) safetyBtn.onclick = onSafety;
  if (letGoBtn) letGoBtn.onclick = onLetGo;
  timerId = setInterval(() => {
    remaining -= 1;
    if (timerEl) timerEl.textContent = String(Math.max(0, remaining));
    if (remaining <= 0) {
      finishLetGo();
    }
  }, 1000);
}
/**
 * Alias for manageContinueOffer — preferred entry from game.js.
 * @param {Parameters<typeof manageContinueOffer>[0]} opts
 */
export function startContinueOffer(opts) {
  manageContinueOffer(opts);
}
export function cancelContinueOffer() {
  clearTimer();
  active = false;
  handlers = null;
}
/** @returns {boolean} */
export function isActive() {
  return active;
}
