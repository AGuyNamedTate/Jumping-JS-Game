/**
 * Central UI helpers for menus, HUD, and screen switching.
 */
import * as storage from './storage.js';
import { HUD_SCORE_SCALE_MIN } from './constants.js';
import { renderStore } from './store.js';
/** @typedef {'mainMenu'|'runHistory'|'store'|'playing'|'continueOffer'|'gameOver'} ScreenName */
const SCREEN_IDS = {
  mainMenu: 'screen-main',
  runHistory: 'screen-history',
  store: 'screen-store',
  playing: null,
  continueOffer: 'screen-continue',
  gameOver: 'screen-gameover',
};
const ALL_SCREENS = [
  'screen-main',
  'screen-history',
  'screen-store',
  'screen-continue',
  'screen-gameover',
];
/** @type {number} */
let displayScore = 0;
/**
 * Show a named screen; HUD visible only while playing.
 * @param {ScreenName} name
 */
export function showScreen(name) {
  for (const id of ALL_SCREENS) {
    document.getElementById(id)?.classList.add('hidden');
  }
  const hud = document.getElementById('hud');
  if (name === 'playing') {
    hud?.classList.remove('hidden');
  } else {
    hud?.classList.add('hidden');
    const panelId = SCREEN_IDS[name];
    if (panelId) document.getElementById(panelId)?.classList.remove('hidden');
  }
}
/**
 * Animate / set live score text + optional scale on #hud-score.
 * @param {number} value
 * @param {number} [scale=HUD_SCORE_SCALE_MIN]
 */
export function setDisplayScore(value, scale = HUD_SCORE_SCALE_MIN) {
  displayScore = Math.max(0, Math.floor(value));
  const el = document.getElementById('hud-score');
  if (!el) return;
  el.textContent = String(displayScore);
  const s = Number.isFinite(scale) ? scale : HUD_SCORE_SCALE_MIN;
  el.style.transform = `translateX(-50%) scale(${s})`;
  el.style.transformOrigin = 'center top';
}
/** @returns {number} */
export function getDisplayScore() {
  return displayScore;
}
/**
 * @param {{
 *   best?: number,
 *   score?: number,
 *   displayScore?: number,
 *   scoreScale?: number,
 *   bird?: number,
 *   safety?: number,
 *   charging?: boolean,
 *   charge?: number,
 * }} opts
 */
export function updateHud(opts = {}) {
  const data = storage.load();
  const bestEl = document.getElementById('hud-highscore');
  const birdEl = document.getElementById('hud-bird');
  const safetyEl = document.getElementById('hud-safety');
  const barWrap = document.getElementById('charge-bar-wrap');
  const bar = document.getElementById('charge-bar');
  const best = opts.best ?? data.bestScore;
  if (bestEl) bestEl.textContent = `Best: ${Math.floor(best)}`;
  if (opts.displayScore != null || opts.score != null) {
    setDisplayScore(
      opts.displayScore ?? opts.score ?? 0,
      opts.scoreScale ?? HUD_SCORE_SCALE_MIN,
    );
  } else if (opts.scoreScale != null) {
    const el = document.getElementById('hud-score');
    if (el) {
      el.style.transform = `translateX(-50%) scale(${opts.scoreScale})`;
      el.style.transformOrigin = 'center top';
    }
  }
  const bird = opts.bird ?? data.inventory.rescueBird;
  const safety = opts.safety ?? data.inventory.safetyPlatform;
  if (birdEl) birdEl.textContent = `Bird: ${bird}`;
  if (safetyEl) safetyEl.textContent = `Safety: ${safety}`;
  if (barWrap && bar) {
    const charging = Boolean(opts.charging);
    barWrap.setAttribute('aria-hidden', String(!charging));
    barWrap.style.opacity = charging ? '1' : '0.35';
    const charge = Math.max(0, Math.min(1, opts.charge ?? 0));
    bar.style.width = `${Math.round(charge * 100)}%`;
  }
}
/**
 * Refresh main-menu chrome from save (mute label; optional wallet hint).
 * @param {import('./storage.js').SaveData} [save]
 */
export function updateMainMenu(save) {
  const data = save ?? storage.load();
  applyMuteToUi(data.muted);
  const tagline = document.querySelector('#screen-main .tagline');
  if (tagline && data.bestScore > 0) {
    tagline.textContent = `Best climb: ${data.bestScore}`;
  } else if (tagline) {
    tagline.textContent = "Climb the peaks. Don't look down.";
  }
}
/**
 * @param {boolean} muted
 */
export function applyMuteToUi(muted) {
  for (const id of ['btn-mute', 'btn-mute-hud']) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    btn.setAttribute('aria-pressed', String(muted));
    btn.textContent = muted ? 'Unmute' : 'Mute';
  }
}
/**
 * Bind menu / navigation buttons once. Pass only the handlers you need.
 *
 * @param {{
 *   onPlay?: () => void,
 *   onHistory?: () => void,
 *   onStore?: () => void,
 *   onHistoryBack?: () => void,
 *   onStoreBack?: () => void,
 *   onPlayAgain?: () => void,
 *   onGameOverMenu?: () => void,
 *   onMute?: () => void,
 *   onUseBird?: () => void,
 *   onUseSafety?: () => void,
 *   onLetGo?: () => void,
 * }} handlers
 */
export function bindMenuButtons(handlers) {
  const bind = (id, fn) => {
    if (!fn) return;
    document.getElementById(id)?.addEventListener('click', fn);
  };
  bind('btn-play', handlers.onPlay);
  bind('btn-history', handlers.onHistory);
  bind('btn-store', handlers.onStore);
  bind('btn-history-back', handlers.onHistoryBack);
  bind('btn-store-back', handlers.onStoreBack);
  bind('btn-play-again', handlers.onPlayAgain);
  bind('btn-gameover-menu', handlers.onGameOverMenu);
  bind('btn-mute', handlers.onMute);
  bind('btn-mute-hud', handlers.onMute);
  // Continue buttons: prefer continue.js startContinueOffer for countdown;
  // these optional binds support simple wiring from game.js if needed.
  bind('btn-use-bird', handlers.onUseBird);
  bind('btn-use-safety', handlers.onUseSafety);
  bind('btn-let-go', handlers.onLetGo);
}
/**
 * Convenience: open store screen content (does not change game state).
 */
export function openStoreUi() {
  showScreen('store');
  renderStore();
}
/**
 * Fill run history list from save.
 */
export function renderHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  const data = storage.load();
  if (!data.runs.length) {
    list.textContent = 'No climbs yet.';
    return;
  }
  list.innerHTML = data.runs
    .map(
      (r, i) =>
        `<div>#${i + 1} — Score ${r.score} · Height ${r.height}</div>`,
    )
    .join('');
}
