/**
 * End-to-end smoke / integration flows for Fantasy Peak Climber.
 * Drives public APIs + DOM; strategic spies only to force danger/dead paths.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FIXED_DT,
  MAX_CONTINUES,
  PRICE_HAT,
  PRICE_RESCUE_BIRD,
  CONTINUE_TIMEOUT,
  CHARGE_TIME,
} from '../js/constants.js';

/** @type {typeof import('../js/game.js')} */
let game;
/** @type {typeof import('../js/storage.js')} */
let storage;
/** @type {typeof import('../js/gameplay.js')} */
let gameplay;
/** @type {typeof import('../js/inventory.js')} */
let inventory;
/** @type {typeof import('../js/assets.js')} */
let assets;
/** @type {typeof import('../js/art.js')} */
let art;
/** @type {typeof import('../js/input.js')} */
let input;

/**
 * @param {{ beforeGame?: (gp: typeof import('../js/gameplay.js')) => void | Promise<void> }} [opts]
 */
async function loadModules(opts = {}) {
  vi.resetModules();
  storage = await import('../js/storage.js');
  gameplay = await import('../js/gameplay.js');
  if (opts.beforeGame) await opts.beforeGame(gameplay);
  inventory = await import('../js/inventory.js');
  assets = await import('../js/assets.js');
  art = await import('../js/art.js');
  input = await import('../js/input.js');
  game = await import('../js/game.js');
}

function canvas() {
  const el = document.getElementById('game-canvas');
  if (!(el instanceof HTMLCanvasElement)) throw new Error('missing canvas');
  return el;
}

function getCtx() {
  const ctx = canvas().getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return ctx;
}

function boot(assetsBag = {}) {
  game.init(canvas(), assetsBag);
  return window.FantasyPeak;
}

function click(id) {
  const el = document.getElementById(id);
  expect(el, `expected #${id}`).toBeTruthy();
  el.click();
}

function isVisible(id) {
  return !document.getElementById(id)?.classList.contains('hidden');
}

function dispatchKey(type, code) {
  const ev = new KeyboardEvent(type, {
    code,
    key: code === 'Space' ? ' ' : code,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(ev);
}

/** @param {number} frames @param {{ now: number }} clock */
async function pumpFrames(frames, clock) {
  for (let i = 0; i < frames; i++) {
    clock.now += 17;
    await vi.advanceTimersByTimeAsync(17);
  }
}

beforeEach(async () => {
  await loadModules();
});

afterEach(() => {
  try {
    game?.stopLoop?.();
  } catch {
    /* ignore */
  }
  vi.useRealTimers();
});

describe('smoke: boot & menus', () => {
  it('smoke: boot with empty assets shows main menu and mute button', () => {
    boot({});
    expect(game.getState()).toBe('mainMenu');
    expect(isVisible('screen-main')).toBe(true);
    const mute = document.getElementById('btn-mute');
    expect(mute).toBeTruthy();
    expect(mute?.textContent).toMatch(/Mute|Unmute/);
    expect(document.getElementById('hud')?.classList.contains('hidden')).toBe(true);
  });

  it('smoke: History empty message then Back; Store wallet then Back', () => {
    boot({});
    click('btn-history');
    expect(game.getState()).toBe('runHistory');
    expect(isVisible('screen-history')).toBe(true);
    expect(document.getElementById('history-list')?.textContent).toContain('No climbs yet');
    click('btn-history-back');
    expect(game.getState()).toBe('mainMenu');
    expect(isVisible('screen-main')).toBe(true);

    click('btn-store');
    expect(game.getState()).toBe('store');
    expect(isVisible('screen-store')).toBe(true);
    expect(document.getElementById('store-wallet')?.textContent).toMatch(/Wallet:\s*0/);
    click('btn-store-back');
    expect(game.getState()).toBe('mainMenu');
  });
});

describe('smoke: play start & charge jump', () => {
  it('smoke: Play starts run with HUD, playing state, and platforms', () => {
    const fp = boot({});
    click('btn-play');
    expect(game.getState()).toBe('playing');
    expect(document.getElementById('hud')?.classList.contains('hidden')).toBe(false);
    expect(isVisible('screen-main')).toBe(false);
    const debug = fp.debug();
    expect(debug).toBeTruthy();
    expect(debug.platforms.length).toBeGreaterThan(0);
    expect(debug.player).toMatchObject({ grounded: true });
  });

  it('smoke: Space charge + release leaves ground via game loop', () => {
    const fp = boot({});
    game.startGame();
    expect(game.getState()).toBe('playing');
    const before = fp.debug();
    expect(before?.player.grounded).toBe(true);

    dispatchKey('keydown', 'Space');
    input.update();
    expect(input.getState().charging).toBe(true);

    const chargeFrames = Math.ceil(CHARGE_TIME / FIXED_DT) + 5;
    for (let i = 0; i < chargeFrames; i++) {
      game.step(FIXED_DT);
    }

    dispatchKey('keyup', 'Space');
    for (let i = 0; i < 12; i++) {
      game.step(FIXED_DT);
    }

    const after = fp.debug();
    expect(after).toBeTruthy();
    const leftGround =
      after.player.grounded === false || after.player.vy < -1 || after.score > (before?.score ?? 0);
    expect(leftGround).toBe(true);
  });

  it('smoke: parallel gameplay session charge jump also leaves ground', () => {
    const session = gameplay.createSession();
    expect(session.player.grounded).toBe(true);
    const startY = session.player.y;
    for (let i = 0; i < 30; i++) {
      gameplay.updateSession(session, FIXED_DT, {
        charging: true,
        chargeJustReleased: false,
        moveX: 0,
      });
    }
    gameplay.updateSession(session, FIXED_DT, {
      charging: false,
      chargeJustReleased: true,
      moveX: 0,
    });
    for (let i = 0; i < 5; i++) {
      gameplay.updateSession(session, FIXED_DT, {
        charging: false,
        chargeJustReleased: false,
        moveX: 0,
      });
    }
    expect(session.player.grounded === false || session.player.y < startY || session.player.vy < 0).toBe(
      true,
    );
  });
});

describe('smoke: death, persistence, mute', () => {
  it('smoke: endRun shows game over; Play Again restarts; Menu returns', () => {
    boot({});
    game.startGame();
    game.run.score = 42;
    game.run.height = 120;
    game.endRun();
    expect(game.getState()).toBe('gameOver');
    expect(isVisible('screen-gameover')).toBe(true);
    expect(document.getElementById('gameover-score')?.textContent).toContain('42');
    expect(document.getElementById('gameover-height')?.textContent).toContain('120');

    click('btn-play-again');
    expect(game.getState()).toBe('playing');
    expect(document.getElementById('hud')?.classList.contains('hidden')).toBe(false);

    game.endRun();
    click('btn-gameover-menu');
    expect(game.getState()).toBe('mainMenu');
    expect(isVisible('screen-main')).toBe(true);
  });

  it('smoke: endRun persists run, grows wallet, and history lists entry', () => {
    boot({});
    game.startGame();
    game.run.score = 75;
    game.run.height = 200;
    const walletBefore = storage.load().wallet;
    game.endRun();

    const save = storage.load();
    expect(save.runs.length).toBeGreaterThanOrEqual(1);
    expect(save.runs[0].score).toBe(75);
    expect(save.wallet).toBe(walletBefore + 75);

    game.goRunHistory();
    const hist = document.getElementById('history-list')?.textContent ?? '';
    expect(hist).toMatch(/Score\s*75/);
    expect(hist).toMatch(/Height\s*200/);
  });

  it('smoke: mute from menu updates save.muted and button label', () => {
    boot({});
    expect(storage.load().muted).toBe(false);
    const mute = document.getElementById('btn-mute');
    expect(mute?.textContent).toBe('Mute');
    click('btn-mute');
    expect(storage.load().muted).toBe(true);
    expect(mute?.textContent).toBe('Unmute');
    expect(mute?.getAttribute('aria-pressed')).toBe('true');
    click('btn-mute');
    expect(storage.load().muted).toBe(false);
    expect(mute?.textContent).toBe('Mute');
  });
});

describe('smoke: store buy & cosmetics', () => {
  it('smoke: store buy rescue bird updates wallet and inventory', () => {
    boot({});
    storage.addWallet(PRICE_RESCUE_BIRD + PRICE_HAT + 50);
    game.goStore();
    click('tab-boosts');
    expect(document.getElementById('store-boosts')?.classList.contains('hidden')).toBe(false);

    const walletBefore = storage.load().wallet;
    const birdBtn = document.querySelector('[data-action="buy-boost"][data-key="rescueBird"]');
    expect(birdBtn).toBeTruthy();
    birdBtn.click();

    const afterBird = storage.load();
    expect(afterBird.inventory.rescueBird).toBe(1);
    expect(afterBird.wallet).toBe(walletBefore - PRICE_RESCUE_BIRD);
  });

  it('smoke: buy hat if affordable then equip/unequip; boosts tab works', () => {
    boot({});
    storage.addWallet(PRICE_HAT + 100);
    game.goStore();

    const hatBuy = document.querySelector('[data-action="buy"][data-id="hat"]');
    expect(hatBuy).toBeTruthy();
    hatBuy.click();
    let save = storage.load();
    expect(save.unlocked).toContain('hat');
    expect(save.equipped.hat).toBe('hat');

    const equipBtn = document.querySelector('[data-action="equip"][data-id="hat"]');
    expect(equipBtn?.textContent).toMatch(/Equipped/i);
    equipBtn.click();
    save = storage.load();
    expect(save.equipped.hat).toBeNull();

    const equipAgain = document.querySelector('[data-action="equip"][data-id="hat"]');
    equipAgain.click();
    expect(storage.load().equipped.hat).toBe('hat');

    click('tab-boosts');
    expect(document.getElementById('tab-boosts')?.classList.contains('active')).toBe(true);
    expect(document.getElementById('store-boosts')?.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('[data-key="rescueBird"]')).toBeTruthy();
    expect(document.querySelector('[data-key="safetyPlatform"]')).toBeTruthy();
  });

  it('smoke: equip hat then startGame debug/draw does not throw', () => {
    boot({});
    storage.unlock('hat');
    storage.equip('hat');
    expect(() => {
      game.startGame();
      const d = window.FantasyPeak.debug();
      expect(d).toBeTruthy();
      const ctx = getCtx();
      art.drawSky(ctx, d.camY, 360, 640);
      for (const p of d.platforms.slice(0, 8)) {
        art.drawPlatform(ctx, { ...p, shaky: p.type === 'shaky', width: p.w }, d.camY);
      }
      art.drawPlayer(ctx, { ...d.player, w: 18, h: 26, facing: 1 }, d.camY, {
        hat: true,
        goldenSword: false,
      });
    }).not.toThrow();
  });
});

describe('smoke: continue offer flows', () => {
  it('smoke: continue Use Bird resumes playing; Safety then Let Go ends run', () => {
    boot({});
    storage.addInventory('rescueBird', 2);
    storage.addInventory('safetyPlatform', 1);
    game.startGame();

    // Force danger via public debug hook (ESM spies cannot rewrite game.js bindings)
    game.injectStatus('danger');
    expect(game.getState()).toBe('continueOffer');
    expect(isVisible('screen-continue')).toBe(true);
    expect(window.FantasyPeak.continueIsActive()).toBe(true);

    click('btn-use-bird');
    expect(game.getState()).toBe('playing');
    expect(storage.load().inventory.rescueBird).toBe(1);

    game.injectStatus('danger');
    expect(game.getState()).toBe('continueOffer');
    click('btn-use-safety');
    expect(game.getState()).toBe('playing');
    expect(storage.load().inventory.safetyPlatform).toBe(0);

    storage.addInventory('rescueBird', 1);
    // Under MAX_CONTINUES so the offer appears (bird+safety already spent 2)
    game.injectStatus('danger', { continuesUsed: MAX_CONTINUES - 1 });
    expect(game.getState()).toBe('continueOffer');
    click('btn-let-go');
    expect(game.getState()).toBe('gameOver');
  });

  it('smoke: continue timeout Let Go via fake timers', async () => {
    vi.useFakeTimers();
    boot({});
    storage.addInventory('rescueBird', 1);
    game.startGame();

    game.injectStatus('danger');
    expect(game.getState()).toBe('continueOffer');
    await vi.advanceTimersByTimeAsync((CONTINUE_TIMEOUT + 1) * 1000);
    expect(game.getState()).toBe('gameOver');
  });

  it('smoke: continuesUsed at MAX_CONTINUES ends run without offer', () => {
    boot({});
    storage.addInventory('rescueBird', 5);
    game.startGame();

    game.injectStatus('danger', { continuesUsed: MAX_CONTINUES });
    expect(game.getState()).toBe('gameOver');
    expect(isVisible('screen-continue')).toBe(false);
  });
});

describe('smoke: milestones, assets, art, loop', () => {
  it('smoke: milestones solid lands / score band grant birds', () => {
    boot({});
    let data = storage.load();
    data.bestScore = 500;
    data = storage.save(data);
    const band = inventory.checkMilestones(data, { prevBestScore: 0 });
    expect(band.grants.some((g) => g.type === 'scoreBand')).toBe(true);
    expect(storage.load().inventory.rescueBird).toBeGreaterThanOrEqual(1);

    const birdsBefore = storage.load().inventory.rescueBird;
    const lands = inventory.checkMilestones(storage.load(), {
      solidLands: 15,
      landGrantsGiven: 0,
      prevBestScore: storage.load().bestScore,
    });
    expect(lands.grants.some((g) => g.type === 'solidLands')).toBe(true);
    expect(storage.load().inventory.rescueBird).toBe(birdsBefore + 1);
  });

  it('smoke: loadImages([]) and loadAudio failing paths return procedural audio keys', async () => {
    const images = await assets.loadImages([]);
    expect(images).toEqual({});

    const audioMap = await assets.loadAudio([
      'assets/audio/definitely-missing-jump.wav',
      'assets/audio/definitely-missing-land.wav',
    ]);
    for (const key of ['jump', 'land', 'break', 'fall', 'highscore', 'rescue', 'bgm']) {
      expect(audioMap).toHaveProperty(key);
      expect(audioMap[key] == null || typeof audioMap[key].play === 'function').toBe(true);
    }
  }, 20_000);

  it('smoke: draw full frame stack without throw', () => {
    boot({});
    game.startGame();
    const d = window.FantasyPeak.debug();
    const ctx = getCtx();
    expect(() => {
      art.clearParticles();
      art.drawSky(ctx, d.camY, 360, 640);
      for (const p of d.platforms) {
        art.drawPlatform(
          ctx,
          { x: p.x, y: p.y, w: p.w, type: p.type, shaky: p.type === 'shaky', width: p.w, broken: false },
          d.camY,
        );
      }
      art.drawPlayer(ctx, { x: d.player.x, y: d.player.y, w: 18, h: 26, facing: 1 }, d.camY, {
        hat: false,
        goldenSword: false,
      });
      art.drawChargeBar(ctx, { x: d.player.x, y: d.player.y, w: 18 }, d.camY, 0.6);
      art.drawBird(ctx, d.player.x, d.player.y - 40, d.camY);
      art.spawnLandDust(d.player.x, d.player.y);
      art.spawnBreakDebris(d.platforms[0].x, d.platforms[0].y, d.platforms[0].w, true);
      art.updateParticles(FIXED_DT);
      art.drawParticles(ctx, d.camY);
    }).not.toThrow();
  });

  it('smoke: startLoop then stopLoop without hang', async () => {
    vi.useFakeTimers();
    const clock = { now: 12_000 };
    vi.spyOn(performance, 'now').mockImplementation(() => clock.now);

    boot({});
    game.startGame();
    game.startLoop();
    await pumpFrames(10, clock);
    game.stopLoop();
    const score = window.FantasyPeak.debug()?.score ?? 0;
    clock.now += 500;
    await vi.advanceTimersByTimeAsync(500);
    expect(window.FantasyPeak.debug()?.score ?? 0).toBe(score);
    expect(game.getState()).toBe('playing');
  });
});
