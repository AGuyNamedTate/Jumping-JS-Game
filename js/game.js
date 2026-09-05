/**
 * Fantasy Peak Climber — state machine + loop, wired to gameplay modules.
 */

import {
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  FIXED_DT,
  MAX_FRAME_DT,
  MAX_CONTINUES,
  SKY_COLOR,
} from './constants.js';
import * as storage from './storage.js';
import * as input from './input.js';
import {
  createSession,
  resetSession,
  updateSession,
  applyRescueBird,
  applySafetyPlatform,
} from './gameplay.js';
import * as art from './art.js';
import * as audio from './audio.js';
import { createHudScore } from './hudScore.js';
import {
  showScreen,
  updateHud,
  updateMainMenu,
  bindMenuButtons,
  renderHistory,
} from './ui.js';
import { renderStore } from './store.js';
import { startContinueOffer, cancelContinueOffer, isActive as continueIsActive } from './continue.js';
import { canUse, use, checkMilestones, getCounts } from './inventory.js';
import { getEquippedVisuals } from './cosmetics.js';

/** @typedef {'mainMenu'|'runHistory'|'store'|'playing'|'continueOffer'|'gameOver'} GameState */

/** @type {GameState} */
let state = 'mainMenu';

/** @type {HTMLCanvasElement|null} */
let canvas = null;
/** @type {CanvasRenderingContext2D|null} */
let ctx = null;

let accumulator = 0;
let lastTime = 0;
let rafId = 0;
let running = false;

/** @type {ReturnType<typeof createSession>|null} */
let session = null;
/** @type {ReturnType<typeof createHudScore>} */
const hudScore = createHudScore();

export let images = {};
export let audioAssets = {};

export const run = {
  score: 0,
  height: 0,
  continuesUsed: 0,
  solidLands: 0,
  landGrantsGiven: 0,
  prevBestScore: 0,
  highScoreCelebrated: false,
};

/** @type {Set<string>} */
const brokenSeen = new Set();

/**
 * @param {HTMLCanvasElement} canvasEl
 * @param {{ images?: object, audio?: object }} [assets]
 */
export function init(canvasEl, assets = {}) {
  canvas = canvasEl;
  canvas.width = LOGICAL_WIDTH;
  canvas.height = LOGICAL_HEIGHT;
  ctx = canvas.getContext('2d');
  if (ctx) ctx.imageSmoothingEnabled = false;

  images = assets.images ?? {};
  audioAssets = assets.audio ?? {};

  const save = storage.load();
  audio.init(audioAssets, save.muted);
  input.init(canvas);

  session = createSession({
    cosmetics: getEquippedVisuals(save),
    onLand: handleLand,
  });

  bindMenuButtons({
    onPlay: () => startGame(),
    onHistory: () => goRunHistory(),
    onStore: () => goStore(),
    onHistoryBack: () => goMainMenu(),
    onStoreBack: () => goMainMenu(),
    onPlayAgain: () => startGame(),
    onGameOverMenu: () => goMainMenu(),
    onMute: () => toggleMute(),
  });

  updateMainMenu(save);
  showScreen('mainMenu');
}

export function startLoop() {
  if (running) return;
  running = true;
  lastTime = performance.now();
  accumulator = 0;
  rafId = requestAnimationFrame(frame);
}

export function stopLoop() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

/**
 * @param {number} now
 */
function frame(now) {
  if (!running) return;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;

  accumulator += dt;
  while (accumulator >= FIXED_DT) {
    update(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  draw();
  rafId = requestAnimationFrame(frame);
}

/**
 * @param {number} dt
 */
function update(dt) {
  if (state !== 'playing' || !session) {
    art.updateParticles(dt);
    return;
  }

  input.update();
  const inputState = input.getState();

  const wasCharge = session.player.charge;
  const status = updateSession(session, dt, inputState);

  if (inputState.chargeJustReleased && wasCharge > 0.05) {
    audio.playSfx('jump');
  }

  detectBreaks();

  run.score = session.score;
  run.height = Math.floor(session.maxHeight);
  run.continuesUsed = session.continuesUsed;

  hudScore.setTrueScore(run.height, run.score);
  hudScore.setAscending(session.player.vy < 0);
  hudScore.update(dt);
  art.updateParticles(dt);

  if (!run.highScoreCelebrated && run.score > run.prevBestScore) {
    audio.playSfx('highscore');
    run.highScoreCelebrated = true;
  }

  const save = storage.load();
  syncPlayingHud(save);

  if (status === 'danger') {
    tryOfferContinue();
  } else if (status === 'dead') {
    endRun();
  }
}

function detectBreaks() {
  if (!session) return;
  for (const p of session.world.platforms) {
    const id = `${p.x},${p.y},${p.w}`;
    if (p.broken && !brokenSeen.has(id)) {
      brokenSeen.add(id);
      audio.playSfx('break');
      art.spawnBreakDebris(p.x, p.y, p.w, p.type === 'shaky');
    }
  }
}

/**
 * @param {object} platform
 */
function handleLand(platform) {
  audio.playSfx('land');
  hudScore.onLand();
  if (session) {
    art.spawnLandDust(session.player.x + session.player.w / 2, session.player.y + session.player.h);
  }
  if (platform?.type === 'solid') {
    run.solidLands += 1;
    const result = checkMilestones(storage.load(), {
      solidLands: run.solidLands,
      landGrantsGiven: run.landGrantsGiven,
      prevBestScore: run.prevBestScore,
    });
    run.landGrantsGiven = Math.floor(run.solidLands / 15);
    if (result.notified) {
      syncPlayingHud(result.save);
    }
  }
}

function tryOfferContinue() {
  if (!session || state !== 'playing') return;
  if (session.continuesUsed >= MAX_CONTINUES) {
    endRun();
    return;
  }
  const hasBird = canUse('rescueBird');
  const hasSafety = canUse('safetyPlatform');
  if (!hasBird && !hasSafety) {
    endRun();
    return;
  }

  setState('continueOffer');
  showScreen('continueOffer');

  startContinueOffer({
    hasBird,
    hasSafety,
    timeoutSec: undefined,
    onUseBird: () => {
      if (!session) return;
      const { ok } = use('rescueBird');
      if (!ok) {
        endRun();
        return;
      }
      applyRescueBird(session);
      audio.playSfx('rescue');
      resumeAfterContinue();
    },
    onUseSafety: () => {
      if (!session) return;
      const { ok } = use('safetyPlatform');
      if (!ok) {
        endRun();
        return;
      }
      applySafetyPlatform(session);
      audio.playSfx('rescue');
      resumeAfterContinue();
    },
    onLetGo: () => {
      audio.playSfx('fall');
      endRun();
    },
  });
}

function resumeAfterContinue() {
  if (!session) return;
  cancelContinueOffer();
  setState('playing');
  showScreen('playing');
  syncPlayingHud(storage.load());
}

/**
 * @param {import('./storage.js').SaveData} save
 */
function syncPlayingHud(save) {
  const counts = getCounts();
  updateHud({
    best: Math.max(save.bestScore, run.score),
    displayScore: hudScore.getDisplayScore(),
    scoreScale: hudScore.getScale(),
    bird: counts.rescueBird,
    safety: counts.safetyPlatform,
    charging: session?.player.grounded && session.player.charge > 0,
    charge: session?.player.charge ?? 0,
  });
  const scoreEl = document.getElementById('hud-score');
  hudScore.applyToDom(scoreEl);
}

function draw() {
  if (!ctx || !canvas) return;
  ctx.imageSmoothingEnabled = false;

  if (state === 'playing' || state === 'continueOffer') {
    if (!session) {
      ctx.fillStyle = SKY_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const camY = session.camera.y;
    art.drawSky(ctx, camY, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    for (const p of session.world.platforms) {
      art.drawPlatform(
        ctx,
        { ...p, shaky: p.type === 'shaky', width: p.w },
        camY,
      );
    }
    art.drawPlayer(ctx, session.player, camY, {
      hat: session.cosmetics.hat,
      goldenSword: session.cosmetics.goldenSword,
    });
    if (session.player.grounded && session.player.charge > 0) {
      art.drawChargeBar(ctx, session.player, camY, session.player.charge);
    }
    art.drawParticles(ctx, camY);

    if (session.status === 'danger' || state === 'continueOffer') {
      ctx.fillStyle = 'rgba(180, 40, 40, 0.55)';
      ctx.fillRect(0, LOGICAL_HEIGHT - 3, LOGICAL_WIDTH, 3);
    }
    return;
  }

  // Menus: idle sky
  art.drawSky(ctx, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  if (state === 'mainMenu') {
    const visuals = getEquippedVisuals(storage.load());
    art.drawPlayer(
      ctx,
      { x: LOGICAL_WIDTH / 2 - 14, y: LOGICAL_HEIGHT * 0.55, w: 28, h: 36, facing: 1 },
      0,
      visuals,
    );
  }
}

export function getState() {
  return state;
}

export function startGame() {
  cancelContinueOffer();
  const save = storage.load();
  const visuals = getEquippedVisuals(save);

  run.score = 0;
  run.height = 0;
  run.continuesUsed = 0;
  run.solidLands = 0;
  run.landGrantsGiven = 0;
  run.prevBestScore = save.bestScore;
  run.highScoreCelebrated = false;
  brokenSeen.clear();
  art.clearParticles();
  hudScore.reset();
  input.reset();

  if (!session) {
    session = createSession({ cosmetics: visuals, onLand: handleLand });
  } else {
    resetSession(session, { cosmetics: visuals, onLand: handleLand });
  }

  audio.playBgm();
  setState('playing');
  showScreen('playing');
  syncPlayingHud(save);
}

export function goMainMenu() {
  cancelContinueOffer();
  audio.stopBgm();
  art.clearParticles();
  const save = storage.load();
  updateMainMenu(save);
  setState('mainMenu');
  showScreen('mainMenu');
}

export function goRunHistory() {
  cancelContinueOffer();
  setState('runHistory');
  showScreen('runHistory');
  renderHistory();
}

export function goStore() {
  cancelContinueOffer();
  setState('store');
  showScreen('store');
  renderStore();
}

export function endRun() {
  if (state === 'gameOver') return;
  cancelContinueOffer();

  if (session && session.status !== 'dead' && state === 'continueOffer') {
    // falling after decline
  }

  audio.playSfx('fall');
  audio.stopBgm();

  const prevBest = run.prevBestScore;
  const data = storage.addRun(run.score, run.height);
  checkMilestones(data, {
    prevBestScore: prevBest,
    solidLands: run.solidLands,
    landGrantsGiven: run.landGrantsGiven,
  });

  setState('gameOver');
  showScreen('gameOver');

  const scoreEl = document.getElementById('gameover-score');
  const heightEl = document.getElementById('gameover-height');
  if (scoreEl) scoreEl.textContent = `Score: ${run.score}`;
  if (heightEl) heightEl.textContent = `Height: ${Math.floor(run.height)}`;
}

/**
 * @param {GameState} next
 */
function setState(next) {
  state = next;
}

function toggleMute() {
  const data = storage.load();
  data.muted = !data.muted;
  storage.save(data);
  audio.setMuted(data.muted);
  updateMainMenu(data);
}

/**
 * Advance one fixed update + draw (for tests / debug tooling).
 * @param {number} [dt=FIXED_DT]
 */
export function step(dt = FIXED_DT) {
  update(dt);
  draw();
}

/**
 * Force session status into the state machine (tests / debug).
 * @param {'ok'|'danger'|'dead'} status
 * @param {{ continuesUsed?: number }} [opts]
 */
export function injectStatus(status, opts = {}) {
  if (!session) return;
  if (typeof opts.continuesUsed === 'number') {
    session.continuesUsed = opts.continuesUsed;
    run.continuesUsed = opts.continuesUsed;
  }
  session.status = status;
  if (status === 'danger' && state === 'playing') {
    tryOfferContinue();
  } else if (status === 'dead' && state === 'playing') {
    endRun();
  }
}

if (typeof window !== 'undefined') {
  window.FantasyPeak = {
    startGame,
    goMainMenu,
    goRunHistory,
    goStore,
    endRun,
    getState,
    startLoop,
    stopLoop,
    step,
    injectStatus,
    continueIsActive,
    debug: () =>
      session
        ? {
            camY: session.camera.y,
            player: { x: session.player.x, y: session.player.y, vy: session.player.vy, grounded: session.player.grounded },
            score: session.score,
            continuesUsed: session.continuesUsed,
            status: session.status,
            platforms: session.world.platforms
              .filter((p) => !p.broken)
              .map((p) => ({
                x: p.x,
                y: p.y,
                w: p.w,
                type: p.type,
                sy: p.y - session.camera.y,
              })),
          }
        : null,
  };
}
