import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createPlayer,
  reset,
  update,
  draw,
  PLAYER_W,
  PLAYER_H,
} from '../js/player.js';
import {
  CHARGE_TIME,
  MIN_JUMP_VY,
  MAX_JUMP_VY,
  MOVE_SPEED,
  JUMP_HX,
  GRAVITY,
  AIR_ACCEL,
  AIR_CONTROL_PRE_APEX,
  AIR_CONTROL_POST_APEX,
} from '../js/constants.js';

function idleInput(overrides = {}) {
  return {
    charging: false,
    chargeJustReleased: false,
    moveX: 0,
    ...overrides,
  };
}

describe('player', () => {
  /** @type {ReturnType<typeof createPlayer>} */
  let player;

  beforeEach(() => {
    player = createPlayer(100, 200);
  });

  describe('createPlayer / reset', () => {
    it('creates with size, zero velocity, and minY at spawn', () => {
      expect(player.x).toBe(100);
      expect(player.y).toBe(200);
      expect(player.w).toBe(PLAYER_W);
      expect(player.h).toBe(PLAYER_H);
      expect(player.vx).toBe(0);
      expect(player.vy).toBe(0);
      expect(player.grounded).toBe(false);
      expect(player.charge).toBe(0);
      expect(player.facing).toBe(1);
      expect(player.minY).toBe(200);
    });

    it('reset clears motion and charge to new spawn', () => {
      player.vx = 50;
      player.vy = -100;
      player.grounded = true;
      player.charge = 0.7;
      player.facing = -1;
      player.minY = 10;

      reset(player, 40, 80);

      expect(player.x).toBe(40);
      expect(player.y).toBe(80);
      expect(player.vx).toBe(0);
      expect(player.vy).toBe(0);
      expect(player.grounded).toBe(false);
      expect(player.charge).toBe(0);
      expect(player.facing).toBe(1);
      expect(player.minY).toBe(80);
    });
  });

  describe('grounded: charging', () => {
    it('builds charge toward 1 over CHARGE_TIME and locks vx', () => {
      player.vx = 99;
      update(player, CHARGE_TIME / 2, idleInput({ charging: true }), true);
      expect(player.charge).toBeCloseTo(0.5);
      expect(player.vx).toBe(0);
      expect(player.grounded).toBe(true);
      expect(player.vy).toBe(0);

      update(player, CHARGE_TIME, idleInput({ charging: true }), true);
      expect(player.charge).toBe(1);
      expect(player.vx).toBe(0);
    });

    it('does not exceed charge of 1', () => {
      update(player, CHARGE_TIME * 3, idleInput({ charging: true }), true);
      expect(player.charge).toBe(1);
    });

    it('facing updates from moveX while charging', () => {
      update(player, 0.1, idleInput({ charging: true, moveX: -1 }), true);
      expect(player.facing).toBe(-1);
      expect(player.vx).toBe(0);
    });
  });

  describe('grounded: chargeJustReleased', () => {
    it('applies jump vy/vx from charge and moveX, then clears charge', () => {
      player.charge = 1;
      const xBefore = player.x;
      update(
        player,
        1 / 60,
        idleInput({ chargeJustReleased: true, moveX: 1 }),
        true,
      );

      expect(player.vy).toBeCloseTo(MAX_JUMP_VY);
      expect(player.vx).toBeCloseTo(1 * JUMP_HX * (0.35 + 0.65 * 1));
      expect(player.grounded).toBe(false);
      expect(player.charge).toBe(0);
      expect(player.x).toBeCloseTo(xBefore + player.vx * (1 / 60));
    });

    it('scales jump with partial charge', () => {
      const t = 0.4;
      player.charge = t;
      update(
        player,
        1 / 60,
        idleInput({ chargeJustReleased: true, moveX: -1 }),
        true,
      );
      expect(player.vy).toBeCloseTo(MIN_JUMP_VY + (MAX_JUMP_VY - MIN_JUMP_VY) * t);
      expect(player.vx).toBeCloseTo(-1 * JUMP_HX * (0.35 + 0.65 * t));
      expect(player.facing).toBe(-1);
    });

    it('ignores release when charge is 0 (falls through to walk branch)', () => {
      player.charge = 0;
      update(
        player,
        1 / 60,
        idleInput({ chargeJustReleased: true, moveX: 1 }),
        true,
      );
      expect(player.vy).toBe(0);
      expect(player.grounded).toBe(true);
      expect(player.vx).toBe(MOVE_SPEED);
      expect(player.charge).toBe(0);
    });
  });

  describe('grounded: walking', () => {
    it('moves with moveX and clears charge when not charging', () => {
      player.charge = 0.3;
      update(player, 0.1, idleInput({ moveX: 1 }), true);
      expect(player.vx).toBe(MOVE_SPEED);
      expect(player.charge).toBe(0);
      expect(player.facing).toBe(1);
      expect(player.vy).toBe(0);
    });

    it('walks left and sets facing -1', () => {
      update(player, 0.1, idleInput({ moveX: -1 }), true);
      expect(player.vx).toBe(-MOVE_SPEED);
      expect(player.facing).toBe(-1);
    });

    it('stops when moveX is 0', () => {
      player.vx = 50;
      update(player, 0.1, idleInput({ moveX: 0 }), true);
      expect(player.vx).toBe(0);
    });
  });

  describe('air physics', () => {
    it('applies gravity and clears charge', () => {
      player.charge = 0.5;
      player.vy = 0;
      const dt = 0.1;
      update(player, dt, idleInput(), false);
      expect(player.charge).toBe(0);
      expect(player.vy).toBeCloseTo(GRAVITY * dt);
      expect(player.grounded).toBe(false);
    });

    it('uses PRE_APEX control while rising (vy < 0)', () => {
      player.vy = -100;
      player.vx = 0;
      const dt = 0.05;
      update(player, dt, idleInput({ moveX: 1 }), false);
      const maxDelta = AIR_ACCEL * AIR_CONTROL_PRE_APEX * dt;
      expect(player.vx).toBeCloseTo(maxDelta);
    });

    it('uses POST_APEX control while falling (vy >= 0)', () => {
      player.vy = 10;
      player.vx = 0;
      const dt = 0.05;
      update(player, dt, idleInput({ moveX: 1 }), false);
      const maxDelta = AIR_ACCEL * AIR_CONTROL_POST_APEX * dt;
      expect(player.vx).toBeCloseTo(maxDelta);
    });

    it('snaps vx to target when within maxDelta', () => {
      player.vy = -50;
      player.vx = MOVE_SPEED - 1;
      const dt = 1;
      update(player, dt, idleInput({ moveX: 1 }), false);
      expect(player.vx).toBe(MOVE_SPEED);
    });

    it('approaches target from the other side with Math.sign', () => {
      player.vy = 50;
      player.vx = MOVE_SPEED;
      const dt = 0.01;
      update(player, dt, idleInput({ moveX: -1 }), false);
      const maxDelta = AIR_ACCEL * AIR_CONTROL_POST_APEX * dt;
      expect(player.vx).toBeCloseTo(MOVE_SPEED - maxDelta);
    });

    it('tracks minY when climbing higher (smaller y)', () => {
      player.y = 200;
      player.minY = 200;
      player.vy = -200;
      update(player, 0.1, idleInput(), false);
      expect(player.y).toBeLessThan(200);
      expect(player.minY).toBe(player.y);
    });

    it('does not raise minY when falling', () => {
      player.y = 150;
      player.minY = 100;
      player.vy = 200;
      update(player, 0.1, idleInput(), false);
      expect(player.minY).toBe(100);
    });

    it('facing updates from moveX in air', () => {
      player.vy = -10;
      update(player, 0.01, idleInput({ moveX: -1 }), false);
      expect(player.facing).toBe(-1);
    });

    it('keeps facing when moveX is 0', () => {
      player.facing = -1;
      player.vy = -10;
      update(player, 0.01, idleInput({ moveX: 0 }), false);
      expect(player.facing).toBe(-1);
    });
  });

  describe('draw', () => {
    function makeCtx() {
      /** @type {{ style: string, args: number[] }[]} */
      const calls = [];
      const ctx = {
        fillStyle: '',
        fillRect: vi.fn(function fillRect(...args) {
          calls.push({ style: String(this.fillStyle), args });
        }),
        _calls: calls,
      };
      return ctx;
    }

    it('draws facing right eyes and silver sword by default', () => {
      const ctx = makeCtx();
      player.facing = 1;
      draw(ctx, player);
      const styles = ctx._calls.map((c) => c.style);
      expect(styles).toContain('#c0c0c0');
      expect(styles).not.toContain('#ffd700');
      expect(styles).not.toContain('#8b2500');
    });

    it('draws facing left eye and shield/sword on flipped side', () => {
      const ctx = makeCtx();
      player.facing = -1;
      draw(ctx, player);
      const eye = ctx._calls.find(
        (c) => c.style === '#1a1a1a' && c.args[2] === 2 && c.args[3] === 2,
      );
      expect(eye).toBeTruthy();
      const cx = Math.round(player.x) + Math.floor(player.w / 2);
      const y = Math.round(player.y);
      expect(eye.args[0]).toBe(cx - 3);
      expect(eye.args[1]).toBe(y + 4);
    });

    it('draws hat when cosmetics.hat is true', () => {
      const ctx = makeCtx();
      draw(ctx, player, { hat: true });
      expect(ctx._calls.map((c) => c.style)).toContain('#8b2500');
    });

    it('draws golden sword when cosmetics.goldenSword is true', () => {
      const ctx = makeCtx();
      draw(ctx, player, { goldenSword: true });
      const styles = ctx._calls.map((c) => c.style);
      expect(styles).toContain('#ffd700');
      expect(styles).toContain('#b8860b');
      expect(styles).toContain('#fff3a0');
    });

    it('draws charge squash when grounded with charge > 0', () => {
      const ctx = makeCtx();
      player.grounded = true;
      player.charge = 0.8;
      draw(ctx, player);
      const squash = ctx._calls.find(
        (c) => c.style === 'rgba(255, 220, 100, 0.35)',
      );
      expect(squash).toBeTruthy();
      const squashAmt = Math.floor(0.8 * 3);
      expect(squash.args[3]).toBe(2 + squashAmt);
    });

    it('skips charge squash when not grounded or charge is 0', () => {
      const ctx = makeCtx();
      player.grounded = false;
      player.charge = 1;
      draw(ctx, player);
      expect(
        ctx._calls.some((c) => c.style === 'rgba(255, 220, 100, 0.35)'),
      ).toBe(false);

      ctx._calls.length = 0;
      player.grounded = true;
      player.charge = 0;
      draw(ctx, player);
      expect(
        ctx._calls.some((c) => c.style === 'rgba(255, 220, 100, 0.35)'),
      ).toBe(false);
    });

    it('accepts empty cosmetics object defaults', () => {
      const ctx = makeCtx();
      expect(() => draw(ctx, player, {})).not.toThrow();
      expect(() => draw(ctx, player)).not.toThrow();
    });
  });
});
