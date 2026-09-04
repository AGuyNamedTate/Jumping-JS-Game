import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSession,
  resetSession,
  updateSession,
  drawSession,
  applyRescueBird,
  applySafetyPlatform,
} from '../js/gameplay.js';
import { PLAYER_W, PLAYER_H } from '../js/player.js';
import {
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  DANGER_LINE_MARGIN,
  MOVE_SPEED,
  PLATFORM_THICKNESS,
} from '../js/constants.js';

function idleInput(overrides = {}) {
  return {
    charging: false,
    chargeJustReleased: false,
    moveX: 0,
    ...overrides,
  };
}

describe('gameplay', () => {
  describe('createSession / resetSession', () => {
    it('creates a grounded player on the start ledge with ok status', () => {
      const session = createSession();
      expect(session.status).toBe('ok');
      expect(session.player.grounded).toBe(true);
      expect(session.maxHeight).toBe(0);
      expect(session.score).toBe(0);
      expect(session.continuesUsed).toBe(0);
      expect(session._wasGrounded).toBe(true);
      expect(session.cosmetics).toEqual({ hat: false, goldenSword: false });
      expect(session.onLand).toBeNull();

      const start = session.world.platforms.find((p) => p.w === 140);
      expect(start).toBeTruthy();
      expect(session.player.y).toBe(start.y - PLAYER_H);
      expect(session.player.x).toBeCloseTo(
        start.x + start.w / 2 - PLAYER_W / 2,
      );
    });

    it('applies cosmetics and onLand from opts', () => {
      const onLand = vi.fn();
      const session = createSession({
        cosmetics: { hat: true, goldenSword: true },
        onLand,
      });
      expect(session.cosmetics.hat).toBe(true);
      expect(session.cosmetics.goldenSword).toBe(true);
      expect(session.onLand).toBe(onLand);
    });

    it('resetSession rebuilds world and clears progress', () => {
      const onLand = vi.fn();
      const session = createSession({ onLand });
      session.maxHeight = 500;
      session.score = 50;
      session.continuesUsed = 2;
      session.status = 'dead';
      session._wasGrounded = false;
      session.player.vx = 99;

      resetSession(session, {
        cosmetics: { hat: true, goldenSword: false },
        onLand: null,
      });

      expect(session.maxHeight).toBe(0);
      expect(session.score).toBe(0);
      expect(session.continuesUsed).toBe(0);
      expect(session.status).toBe('ok');
      expect(session._wasGrounded).toBe(true);
      expect(session.player.vx).toBe(0);
      expect(session.player.grounded).toBe(true);
      expect(session.cosmetics.hat).toBe(true);
      expect(session.cosmetics.goldenSword).toBe(false);
      expect(session.onLand).toBeNull();
      expect(session.world.platforms.some((p) => p.w === 140)).toBe(true);
    });

    it('resetSession leaves cosmetics/onLand unchanged when opts omit them', () => {
      const onLand = vi.fn();
      const session = createSession({
        cosmetics: { hat: true },
        onLand,
      });
      resetSession(session);
      expect(session.cosmetics.hat).toBe(true);
      expect(session.onLand).toBe(onLand);
    });

    it('getStartPlatform prefers higher ledge when widths tie', async () => {
      const platforms = await import('../js/platforms.js');
      const session = createSession();
      const spy = vi.spyOn(platforms, 'reset').mockImplementation((world) => {
        world.platforms = [
          {
            x: 0,
            y: 500,
            w: 140,
            h: PLATFORM_THICKNESS,
            type: 'solid',
            shakeTimer: 0,
            broken: false,
          },
          {
            x: 0,
            y: 400,
            w: 140,
            h: PLATFORM_THICKNESS,
            type: 'solid',
            shakeTimer: 0,
            broken: false,
          },
          {
            x: 0,
            y: 450,
            w: 100,
            h: PLATFORM_THICKNESS,
            type: 'solid',
            shakeTimer: 0,
            broken: false,
          },
        ];
        world.topY = 400;
      });
      resetSession(session);
      expect(session.player.y).toBe(400 - PLAYER_H);
      spy.mockRestore();
    });
  });

  describe('updateSession', () => {
    /** @type {ReturnType<typeof createSession>} */
    let session;

    beforeEach(() => {
      session = createSession();
      session.world.seed = 12345;
    });

    it('returns dead early without mutating when already dead', () => {
      session.status = 'dead';
      const x = session.player.x;
      const status = updateSession(session, 0.1, idleInput({ moveX: 1 }));
      expect(status).toBe('dead');
      expect(session.player.x).toBe(x);
    });

    it('wraps player horizontally past left and right edges', () => {
      session.player.grounded = true;
      session.player.x = -PLAYER_W - 1;
      session.player.vx = 0;
      // Force mid-air so walking doesn't move much — set standing off ledge
      session.player.y = session.player.y - 200;
      session.player.vy = 0;
      updateSession(session, 0, idleInput());
      // After wrap: if x + w < 0 -> x = LOGICAL_WIDTH
      // Need x still < -w after player update. With dt=0 and moveX=0, x unchanged.
      expect(session.player.x).toBe(LOGICAL_WIDTH);

      session.player.x = LOGICAL_WIDTH + 1;
      updateSession(session, 0, idleInput());
      expect(session.player.x).toBe(-PLAYER_W);
    });

    it('fires onLand once on land transition (not while staying grounded)', () => {
      const onLand = vi.fn();
      session.onLand = onLand;
      session._wasGrounded = true;

      // Stay grounded — should not fire
      updateSession(session, 1 / 60, idleInput());
      expect(onLand).not.toHaveBeenCalled();

      // Jump into air
      session.player.charge = 1;
      updateSession(
        session,
        1 / 60,
        idleInput({ chargeJustReleased: true, moveX: 0 }),
      );
      expect(session.player.grounded).toBe(false);
      expect(session._wasGrounded).toBe(false);

      // Fall back onto start platform
      const start = session.world.platforms.find((p) => p.w === 140);
      session.player.x = start.x + start.w / 2 - PLAYER_W / 2;
      session.player.y = start.y - PLAYER_H - 2;
      session.player.vy = 200;
      session.player.vx = 0;
      session._wasGrounded = false;

      updateSession(session, FIXED_DT_SAFE, idleInput());
      expect(onLand).toHaveBeenCalledTimes(1);
      expect(onLand.mock.calls[0][0]).toBeTruthy();

      onLand.mockClear();
      updateSession(session, 1 / 60, idleInput());
      expect(onLand).not.toHaveBeenCalled();
    });

    it('grows score when climbing higher', () => {
      session.player.minY = session.camera.startY - 250;
      session.player.y = session.player.minY;
      // Keep out of danger
      session.camera.y = session.player.y - LOGICAL_HEIGHT * 0.45;

      updateSession(session, 0, idleInput());
      expect(session.maxHeight).toBe(250);
      expect(session.score).toBe(25);

      // Climb more
      session.player.minY = session.camera.startY - 400;
      session.player.y = session.player.minY;
      session.camera.y = session.player.y - LOGICAL_HEIGHT * 0.45;
      updateSession(session, 0, idleInput());
      expect(session.maxHeight).toBe(400);
      expect(session.score).toBe(40);
    });

    it('does not decrease score when falling', () => {
      session.maxHeight = 300;
      session.score = 30;
      session.player.minY = session.camera.startY - 300;
      session.player.y = session.camera.startY;
      updateSession(session, 0, idleInput());
      expect(session.maxHeight).toBe(300);
      expect(session.score).toBe(30);
    });

    it('sets status to danger when below view but within margin', () => {
      session.camera.y = 0;
      session.player.y = LOGICAL_HEIGHT + 10;
      session.player.vy = 50;
      // Clear platforms so we don't land
      session.world.platforms = [];
      session.world.topY = -10000;

      const status = updateSession(session, 0, idleInput());
      expect(status).toBe('danger');
      expect(session.status).toBe('danger');
    });

    it('sets status to dead past danger margin', () => {
      session.camera.y = 0;
      session.player.y = LOGICAL_HEIGHT + DANGER_LINE_MARGIN + 5;
      session.world.platforms = [];
      session.world.topY = -10000;

      const status = updateSession(session, 0, idleInput());
      expect(status).toBe('dead');
      expect(session.status).toBe('dead');
    });

    it('sets status back to ok when safe', () => {
      session.status = 'danger';
      // Player still on start ledge
      const status = updateSession(session, 0, idleInput());
      expect(status).toBe('ok');
    });

    it('treats broken standing platform as not grounded', () => {
      const start = session.world.platforms.find((p) => p.w === 140);
      start.broken = true;
      session.player.x = start.x + 10;
      session.player.y = start.y - PLAYER_H;
      session.player.vy = 0;
      session.player.grounded = true;

      updateSession(session, 1 / 60, idleInput());
      // Broken standing -> onGround false at start; may tryLand null; grounded false
      expect(session.player.grounded).toBe(false);
    });

    it('clears grounded when post-land standing platform is reported broken', async () => {
      // getStandingPlatform skips broken platforms, so exercise the standing?.broken
      // branch via a spy (otherwise unreachable through the public platform API).
      const platforms = await import('../js/platforms.js');
      const start = session.world.platforms.find((p) => p.w === 140);
      session.player.x = start.x + 20;
      session.player.y = start.y - PLAYER_H;
      session.player.vy = 0;
      session.player.grounded = true;

      const spy = vi
        .spyOn(platforms, 'getStandingPlatform')
        .mockReturnValueOnce(start) // initial grounded check
        .mockReturnValueOnce({ ...start, broken: true }); // post-land stick check

      updateSession(session, 0, idleInput());
      expect(session.player.grounded).toBe(false);
      spy.mockRestore();
    });

    it('nulls standing when initially reported broken before physics', async () => {
      const platforms = await import('../js/platforms.js');
      const start = session.world.platforms.find((p) => p.w === 140);
      session.player.x = start.x + 20;
      session.player.y = start.y - PLAYER_H;
      session.player.vy = 0;

      const spy = vi
        .spyOn(platforms, 'getStandingPlatform')
        .mockReturnValueOnce({ ...start, broken: true })
        .mockReturnValue(null);

      updateSession(session, 1 / 60, idleInput({ moveX: 0 }));
      // Treated as airborne (onGround false) because broken standing was nulled
      expect(session.player.grounded).toBe(false);
      spy.mockRestore();
    });

    it('starts shaky timer when sticking to shaky platform', () => {
      const shaky = {
        x: session.player.x - 10,
        y: session.player.y + PLAYER_H,
        w: 100,
        h: PLATFORM_THICKNESS,
        type: 'shaky',
        shakeTimer: 0,
        broken: false,
      };
      session.world.platforms = [shaky];
      session.player.vy = 0;
      session.player.grounded = true;

      updateSession(session, 0, idleInput());
      expect(shaky.shakeTimer).toBe(0.0001);
      expect(session.player.grounded).toBe(true);
    });

    it('clears grounded while ascending through a platform top', () => {
      const start = session.world.platforms.find((p) => p.w === 140);
      session.player.x = start.x + 20;
      session.player.y = start.y - PLAYER_H;
      session.player.vy = -200;
      session.player.grounded = true;
      session.player.charge = 0;

      updateSession(session, 0, idleInput());
      expect(session.player.grounded).toBe(false);
    });

    it('walks on ground when not charging', () => {
      const x0 = session.player.x;
      updateSession(session, 0.1, idleInput({ moveX: 1 }));
      expect(session.player.x).toBeGreaterThan(x0);
      expect(session.player.vx).toBe(MOVE_SPEED);
    });
  });

  describe('applyRescueBird', () => {
    it('places player on rescue target and bumps continuesUsed', () => {
      const session = createSession();
      session.status = 'danger';
      session.player.vy = 500;
      session.player.charge = 0.5;
      const used = session.continuesUsed;

      const ok = applyRescueBird(session);
      expect(ok).toBe(true);
      expect(session.status).toBe('ok');
      expect(session.continuesUsed).toBe(used + 1);
      expect(session.player.vx).toBe(0);
      expect(session.player.vy).toBe(0);
      expect(session.player.grounded).toBe(true);
      expect(session.player.charge).toBe(0);

      const standingY = session.player.y + PLAYER_H;
      const under = session.world.platforms.find(
        (p) =>
          !p.broken &&
          Math.abs(p.y - standingY) < 0.5 &&
          session.player.x + PLAYER_W > p.x &&
          session.player.x < p.x + p.w,
      );
      expect(under).toBeTruthy();
    });

    it('returns false when no platforms exist', () => {
      const session = createSession();
      session.world.platforms = [];
      expect(applyRescueBird(session)).toBe(false);
      expect(session.continuesUsed).toBe(0);
    });

    it('reframes camera when player is near view bottom', () => {
      const session = createSession();
      // Put camera high so after rescue player may be low in view
      session.camera.y = -5000;
      applyRescueBird(session);
      const viewBottom = session.camera.y + LOGICAL_HEIGHT;
      expect(session.player.y + PLAYER_H).toBeLessThanOrEqual(viewBottom - 40 + 1);
    });
  });

  describe('applySafetyPlatform', () => {
    it('spawns ledge under player and resets motion', () => {
      const session = createSession();
      session.status = 'danger';
      session.player.x = 50;
      session.player.y = 400;
      session.player.vy = 300;
      session.player.charge = 1;
      const count = session.world.platforms.length;

      const ok = applySafetyPlatform(session);
      expect(ok).toBe(true);
      expect(session.world.platforms.length).toBe(count + 1);
      expect(session.status).toBe('ok');
      expect(session.continuesUsed).toBe(1);
      expect(session.player.vy).toBe(0);
      expect(session.player.grounded).toBe(true);
      expect(session.player.charge).toBe(0);

      const ledge = session.world.platforms[session.world.platforms.length - 1];
      expect(session.player.y).toBe(ledge.y - PLAYER_H);
    });
  });

  describe('drawSession', () => {
    function makeCtx() {
      /** @type {{ style: string, args: number[] }[]} */
      const calls = [];
      return {
        fillStyle: '',
        fillRect: vi.fn(function fillRect(...args) {
          calls.push({ style: String(this.fillStyle), args });
        }),
        _calls: calls,
      };
    }

    it('draws platforms, danger cue, and player with cosmetics', () => {
      const session = createSession({
        cosmetics: { hat: true, goldenSword: true },
      });
      const ctx = makeCtx();

      const savedY = session.player.y;
      drawSession(ctx, session);

      // Player world y restored
      expect(session.player.y).toBe(savedY);

      // Soft danger line when ok
      expect(
        ctx._calls.some((c) => c.style === 'rgba(120, 30, 30, 0.25)'),
      ).toBe(true);

      // Hat / golden sword drawn
      expect(ctx._calls.some((c) => c.style === '#8b2500')).toBe(true);
      expect(ctx._calls.some((c) => c.style === '#ffd700')).toBe(true);
    });

    it('draws strong danger line when status is danger or dead', () => {
      const session = createSession();
      const ctx = makeCtx();

      session.status = 'danger';
      drawSession(ctx, session);
      expect(ctx._calls.map((c) => c.style)).toContain('rgba(180, 40, 40, 0.55)');

      ctx._calls.length = 0;
      session.status = 'dead';
      drawSession(ctx, session);
      expect(ctx._calls.map((c) => c.style)).toContain('rgba(180, 40, 40, 0.55)');
    });
  });
});

/** small fixed dt used where tryLand needs consistent foot crossing */
const FIXED_DT_SAFE = 1 / 60;
