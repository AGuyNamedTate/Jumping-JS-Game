import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { stubCanvas2d } from './setup.js';

describe('game', () => {
  /** @type {any} */
  let game;
  /** @type {any} */
  let gameplay;
  /** @type {any} */
  let continueMod;
  /** @type {any} */
  let inventory;
  /** @type {any} */
  let storage;
  /** @type {any} */
  let audio;
  /** @type {any} */
  let input;
  /** @type {any} */
  let art;

  /** @type {any} */
  let capturedSession = null;
  /** @type {((platform: object) => void)|null} */
  let capturedOnLand = null;
  /** @type {any} */
  let lastContinueOpts = null;

  async function loadGame() {
    vi.resetModules();
    capturedSession = null;
    capturedOnLand = null;
    lastContinueOpts = null;

    gameplay = await import('../js/gameplay.js');
    continueMod = await import('../js/continue.js');
    inventory = await import('../js/inventory.js');
    storage = await import('../js/storage.js');
    audio = await import('../js/audio.js');
    input = await import('../js/input.js');
    art = await import('../js/art.js');

    const realCreate = gameplay.createSession;
    const realReset = gameplay.resetSession;

    vi.spyOn(gameplay, 'createSession').mockImplementation((opts = {}) => {
      capturedOnLand = opts.onLand ?? null;
      capturedSession = realCreate(opts);
      return capturedSession;
    });
    vi.spyOn(gameplay, 'resetSession').mockImplementation((session, opts = {}) => {
      if (opts.onLand !== undefined) capturedOnLand = opts.onLand;
      realReset(session, opts);
      capturedSession = session;
    });
    vi.spyOn(continueMod, 'startContinueOffer').mockImplementation((opts) => {
      lastContinueOpts = opts;
    });

    game = await import('../js/game.js');
    return game;
  }

  function flushFrames(ms = 50) {
    return new Promise((r) => setTimeout(r, ms));
  }

  beforeEach(async () => {
    const canvas = document.getElementById('game-canvas');
    stubCanvas2d(canvas);
    await loadGame();
    game.init(canvas, { images: {}, audio: {} });
  });

  afterEach(() => {
    try {
      game?.stopLoop();
    } catch {
      /* ignore */
    }
  });

  it('init sets canvas size, assets, FantasyPeak, and mainMenu', () => {
    const canvas = document.getElementById('game-canvas');
    expect(canvas.width).toBe(360);
    expect(canvas.height).toBe(640);
    expect(game.getState()).toBe('mainMenu');
    expect(game.images).toEqual({});
    expect(window.FantasyPeak).toBeTruthy();
    expect(window.FantasyPeak.getState()).toBe('mainMenu');
    expect(window.FantasyPeak.debug()).toBeTruthy();
  });

  it('FantasyPeak.debug returns session snapshot after init', () => {
    const dbg = window.FantasyPeak.debug();
    expect(dbg).not.toBeNull();
    expect(dbg.player).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });
    expect(Array.isArray(dbg.platforms)).toBe(true);
  });

  it('navigates goRunHistory, goStore, goMainMenu', () => {
    game.goRunHistory();
    expect(game.getState()).toBe('runHistory');
    game.goStore();
    expect(game.getState()).toBe('store');
    game.goMainMenu();
    expect(game.getState()).toBe('mainMenu');
  });

  it('startGame enters playing and resets run stats', () => {
    game.startGame();
    expect(game.getState()).toBe('playing');
    expect(game.run.score).toBe(0);
    expect(game.run.solidLands).toBe(0);
    expect(game.run.highScoreCelebrated).toBe(false);
    expect(game.run.birdUsed).toBe(false);
    expect(game.run.safetyUsed).toBe(false);
    expect(game.run.highScoreBirdGranted).toBe(false);
  });

  it('endRun is idempotent and fills gameover DOM', () => {
    game.startGame();
    game.run.score = 42;
    game.run.height = 120;
    game.endRun();
    expect(game.getState()).toBe('gameOver');
    expect(document.getElementById('gameover-score').textContent).toContain('42');
    expect(document.getElementById('gameover-height').textContent).toContain('120');
    game.endRun();
    expect(game.getState()).toBe('gameOver');
  });

  it('toggles mute via btn-mute after bind', () => {
    expect(storage.load().muted).toBe(false);
    document.getElementById('btn-mute').click();
    expect(storage.load().muted).toBe(true);
    document.getElementById('btn-mute').click();
    expect(storage.load().muted).toBe(false);
  });

  it('startLoop and stopLoop drive rAF; startLoop is idempotent', async () => {
    game.startGame();
    game.startLoop();
    game.startLoop();
    await flushFrames(40);
    game.stopLoop();
    game.stopLoop();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('menu frame draws sky while not playing', async () => {
    const skySpy = vi.spyOn(art, 'drawSky');
    game.goMainMenu();
    game.startLoop();
    await flushFrames(40);
    game.stopLoop();
    expect(skySpy).toHaveBeenCalled();
  });

  it('playing frame draws world and charge bar', async () => {
    const drawPlayer = vi.spyOn(art, 'drawPlayer');
    const drawCharge = vi.spyOn(art, 'drawChargeBar');
    const drawPlat = vi.spyOn(art, 'drawPlatform');

    game.startGame();
    if (capturedSession) {
      capturedSession.player.grounded = true;
      capturedSession.player.charge = 0.6;
    }
    vi.spyOn(gameplay, 'updateSession').mockReturnValue('ok');

    game.startLoop();
    await flushFrames(40);
    game.stopLoop();

    expect(drawPlayer).toHaveBeenCalled();
    expect(drawPlat).toHaveBeenCalled();
    expect(drawCharge).toHaveBeenCalled();
  });

  it('danger status opens continue offer when inventory present', async () => {
    storage.addInventory('rescueBird', 1);
    game.startGame();
    vi.spyOn(gameplay, 'updateSession').mockReturnValue('danger');

    game.startLoop();
    await flushFrames(40);
    game.stopLoop();

    expect(game.getState()).toBe('continueOffer');
    expect(lastContinueOpts).toBeTruthy();
    expect(lastContinueOpts.hasBird).toBe(true);
  });

  it('updateSession dead ends the run', async () => {
    game.startGame();
    vi.spyOn(gameplay, 'updateSession').mockReturnValue('dead');
    game.startLoop();
    await flushFrames(40);
    game.stopLoop();
    expect(game.getState()).toBe('gameOver');
  });

  it('celebrates high score once and grants one bird when score exceeds prevBest', async () => {
    storage.save({ ...storage.load(), bestScore: 10 });
    const canvas = document.getElementById('game-canvas');
    stubCanvas2d(canvas);
    await loadGame();
    game.init(canvas, {});
    game.startGame();
    expect(game.run.prevBestScore).toBe(10);
    expect(storage.load().inventory.rescueBird).toBe(0);

    const playSfx = vi.spyOn(audio, 'playSfx');
    vi.spyOn(gameplay, 'updateSession').mockImplementation((session) => {
      session.score = 50;
      return 'ok';
    });

    game.startLoop();
    await flushFrames(40);
    game.stopLoop();

    expect(game.run.highScoreCelebrated).toBe(true);
    expect(game.run.highScoreBirdGranted).toBe(true);
    expect(playSfx).toHaveBeenCalledWith('highscore');
    expect(storage.load().inventory.rescueBird).toBe(1);
  });

  it('plays jump sfx when chargeJustReleased with prior charge', async () => {
    game.startGame();
    if (capturedSession) capturedSession.player.charge = 0.4;
    vi.spyOn(input, 'getState').mockReturnValue({
      charging: false,
      chargeJustReleased: true,
      moveX: 0,
    });
    const playSfx = vi.spyOn(audio, 'playSfx');
    vi.spyOn(gameplay, 'updateSession').mockReturnValue('ok');

    game.startLoop();
    await flushFrames(40);
    game.stopLoop();

    expect(playSfx).toHaveBeenCalledWith('jump');
  });

  it('detectBreaks spawns debris and plays break once per platform', async () => {
    game.startGame();
    const debris = vi.spyOn(art, 'spawnBreakDebris');
    const playSfx = vi.spyOn(audio, 'playSfx');
    if (capturedSession) {
      const p = capturedSession.world.platforms[0];
      p.broken = true;
      p.type = 'shaky';
    }
    vi.spyOn(gameplay, 'updateSession').mockReturnValue('ok');

    game.startLoop();
    await flushFrames(50);
    game.stopLoop();

    expect(debris).toHaveBeenCalled();
    expect(playSfx).toHaveBeenCalledWith('break');
  });

  it('handleLand via onLand tracks solid lands without granting birds', () => {
    game.startGame();
    expect(typeof capturedOnLand).toBe('function');

    const dust = vi.spyOn(art, 'spawnLandDust');
    const playSfx = vi.spyOn(audio, 'playSfx');
    const birdsBefore = storage.load().inventory.rescueBird;

    capturedOnLand({ type: 'shaky' });
    expect(playSfx).toHaveBeenCalledWith('land');
    expect(dust).toHaveBeenCalled();
    expect(game.run.solidLands).toBe(0);

    for (let i = 0; i < 15; i++) {
      capturedOnLand({ type: 'solid' });
    }
    expect(game.run.solidLands).toBe(15);
    expect(storage.load().inventory.rescueBird).toBe(birdsBefore);
  });

  describe('continue offer flows', () => {
    async function forceDanger() {
      game.startGame();
      vi.spyOn(gameplay, 'updateSession').mockReturnValue('danger');
      game.startLoop();
      await flushFrames(40);
      game.stopLoop();
    }

    it('ends run when no inventory', async () => {
      await forceDanger();
      expect(game.getState()).toBe('gameOver');
    });

    it('ends run when bird already used this run and no safety available', async () => {
      storage.addInventory('rescueBird', 2);
      game.startGame();
      if (capturedSession) capturedSession.birdUsed = true;
      vi.spyOn(gameplay, 'updateSession').mockReturnValue('danger');
      game.startLoop();
      await flushFrames(40);
      game.stopLoop();
      expect(game.getState()).toBe('gameOver');
    });

    it('disables bird option after bird used even with birds remaining', async () => {
      storage.addInventory('rescueBird', 2);
      storage.addInventory('safetyPlatform', 1);
      game.startGame();
      if (capturedSession) capturedSession.birdUsed = true;
      vi.spyOn(gameplay, 'updateSession').mockReturnValue('danger');
      game.startLoop();
      await flushFrames(40);
      game.stopLoop();
      expect(game.getState()).toBe('continueOffer');
      expect(lastContinueOpts.hasBird).toBe(false);
      expect(lastContinueOpts.hasSafety).toBe(true);
    });

    it('ends run when both continue types already used this run', async () => {
      storage.addInventory('rescueBird', 5);
      storage.addInventory('safetyPlatform', 5);
      game.startGame();
      if (capturedSession) {
        capturedSession.birdUsed = true;
        capturedSession.safetyUsed = true;
      }
      vi.spyOn(gameplay, 'updateSession').mockReturnValue('danger');
      game.startLoop();
      await flushFrames(40);
      game.stopLoop();
      expect(game.getState()).toBe('gameOver');
    });

    it('bird success resumes playing', async () => {
      storage.addInventory('rescueBird', 1);
      const applyBird = vi.spyOn(gameplay, 'applyRescueBird');

      await forceDanger();
      expect(game.getState()).toBe('continueOffer');
      expect(lastContinueOpts.hasBird).toBe(true);

      lastContinueOpts.onUseBird();
      expect(applyBird).toHaveBeenCalled();
      expect(game.getState()).toBe('playing');
    });

    it('safety success resumes playing', async () => {
      storage.addInventory('safetyPlatform', 1);
      const applySafety = vi.spyOn(gameplay, 'applySafetyPlatform');

      await forceDanger();
      expect(lastContinueOpts.hasSafety).toBe(true);
      lastContinueOpts.onUseSafety();
      expect(applySafety).toHaveBeenCalled();
      expect(game.getState()).toBe('playing');
    });

    it('let go ends run with fall sfx', async () => {
      storage.addInventory('rescueBird', 1);
      const playSfx = vi.spyOn(audio, 'playSfx');
      await forceDanger();
      lastContinueOpts.onLetGo();
      expect(playSfx).toHaveBeenCalledWith('fall');
      expect(game.getState()).toBe('gameOver');
    });

    it('bird use failure ends run', async () => {
      storage.addInventory('rescueBird', 1);
      vi.spyOn(inventory, 'use').mockReturnValue({ ok: false, data: storage.load() });
      await forceDanger();
      lastContinueOpts.onUseBird();
      expect(game.getState()).toBe('gameOver');
    });

    it('safety use failure ends run', async () => {
      storage.addInventory('safetyPlatform', 1);
      vi.spyOn(inventory, 'use').mockReturnValue({ ok: false, data: storage.load() });
      await forceDanger();
      lastContinueOpts.onUseSafety();
      expect(game.getState()).toBe('gameOver');
    });
  });

  it('menu buttons trigger startGame / history / store via bind', () => {
    document.getElementById('btn-play').click();
    expect(game.getState()).toBe('playing');
    document.getElementById('btn-history').click();
    expect(game.getState()).toBe('runHistory');
    document.getElementById('btn-store').click();
    expect(game.getState()).toBe('store');
    document.getElementById('btn-store-back').click();
    expect(game.getState()).toBe('mainMenu');
  });

  it('play again and game over menu buttons work', () => {
    game.startGame();
    game.endRun();
    document.getElementById('btn-play-again').click();
    expect(game.getState()).toBe('playing');
    game.endRun();
    document.getElementById('btn-gameover-menu').click();
    expect(game.getState()).toBe('mainMenu');
  });

  it('non-playing update still advances particles', async () => {
    const upd = vi.spyOn(art, 'updateParticles');
    game.goMainMenu();
    game.startLoop();
    await flushFrames(40);
    game.stopLoop();
    expect(upd).toHaveBeenCalled();
  });

  it('startGame after prior session uses resetSession', () => {
    game.startGame();
    const first = capturedSession;
    game.endRun();
    game.startGame();
    expect(capturedSession).toBe(first);
  });

  it('exports run and audioAssets / images bags', () => {
    expect(game.run).toMatchObject({ score: expect.any(Number) });
    expect(typeof game.images).toBe('object');
    expect(typeof game.audioAssets).toBe('object');
  });

  it('continueOffer draw path with danger stripe', async () => {
    storage.addInventory('rescueBird', 1);
    game.startGame();
    vi.spyOn(gameplay, 'updateSession').mockReturnValue('danger');
    game.startLoop();
    await flushFrames(40);
    // stay in continueOffer and draw another frame
    vi.spyOn(gameplay, 'updateSession').mockReturnValue('ok');
    if (capturedSession) capturedSession.status = 'danger';
    game.startLoop();
    await flushFrames(40);
    game.stopLoop();
    expect(game.getState()).toBe('continueOffer');
  });

  it('step advances update+draw without rAF', () => {
    game.startGame();
    vi.spyOn(gameplay, 'updateSession').mockReturnValue('ok');
    const drawSky = vi.spyOn(art, 'drawSky');
    game.step();
    expect(drawSky).toHaveBeenCalled();
    game.step(1 / 30);
  });

  it('injectStatus danger/dead/ok and birdUsed / safetyUsed', () => {
    storage.addInventory('rescueBird', 1);
    storage.addInventory('safetyPlatform', 1);
    game.startGame();
    game.injectStatus('ok');
    expect(capturedSession.status).toBe('ok');

    game.injectStatus('danger', { birdUsed: true });
    expect(game.run.birdUsed).toBe(true);
    expect(game.getState()).toBe('continueOffer');

    game.goMainMenu();
    game.startGame();
    game.injectStatus('dead');
    expect(game.getState()).toBe('gameOver');
  });

  it('injectStatus no-ops without session; FantasyPeak.debug null before init', async () => {
    await loadGame();
    expect(window.FantasyPeak.debug()).toBeNull();
    game.injectStatus('danger');
    expect(game.getState()).toBe('mainMenu');
  });

  it('startGame creates session when none exists', async () => {
    await loadGame();
    expect(window.FantasyPeak.debug()).toBeNull();
    game.startGame();
    expect(game.getState()).toBe('playing');
    expect(window.FantasyPeak.debug()).not.toBeNull();
  });

  it('history-back button calls goMainMenu', () => {
    game.goRunHistory();
    document.getElementById('btn-history-back').click();
    expect(game.getState()).toBe('mainMenu');
  });

  it('clamps large frame dt via step after long pause in loop', async () => {
    game.startGame();
    vi.spyOn(gameplay, 'updateSession').mockReturnValue('ok');
    let t = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => t);
    game.startLoop();
    t += 5000; // > MAX_FRAME_DT
    await flushFrames(40);
    game.stopLoop();
  });

  it('detectBreaks uses stone debris for non-shaky broken platforms', async () => {
    game.startGame();
    const debris = vi.spyOn(art, 'spawnBreakDebris');
    if (capturedSession) {
      const p = capturedSession.world.platforms[1] ?? capturedSession.world.platforms[0];
      p.broken = true;
      p.type = 'solid';
    }
    vi.spyOn(gameplay, 'updateSession').mockReturnValue('ok');
    game.step();
    expect(debris).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      false,
    );
  });

  it('FantasyPeak.step and injectStatus are wired', () => {
    game.startGame();
    expect(typeof window.FantasyPeak.step).toBe('function');
    expect(typeof window.FantasyPeak.injectStatus).toBe('function');
    storage.addInventory('safetyPlatform', 1);
    window.FantasyPeak.injectStatus('danger');
    expect(game.getState()).toBe('continueOffer');
  });

  it('init with null getContext still boots (draw early-outs)', () => {
    const canvas = document.getElementById('game-canvas');
    canvas.getContext = () => null;
    game.init(canvas, { images: { a: 1 }, audio: {} });
    expect(game.images).toEqual({ a: 1 });
    game.startGame();
    game.step();
    expect(game.getState()).toBe('playing');
  });

  it('draw fills sky color when playing with null session', async () => {
    await loadGame();
    vi.spyOn(gameplay, 'createSession').mockReturnValue(null);
    const canvas = document.getElementById('game-canvas');
    const ctx = stubCanvas2d(canvas);
    game.init(canvas, {});
    game.startGame();
    expect(game.getState()).toBe('playing');
    game.step();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('endRun from continueOffer hits decline path', () => {
    storage.addInventory('rescueBird', 1);
    game.startGame();
    game.injectStatus('danger');
    expect(game.getState()).toBe('continueOffer');
    if (capturedSession) capturedSession.status = 'danger';
    game.endRun();
    expect(game.getState()).toBe('gameOver');
  });
});
