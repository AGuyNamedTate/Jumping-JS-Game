import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createWorld,
  reset,
  update,
  tryLand,
  getStandingPlatform,
  draw,
  spawnSafetyPlatform,
  findRescueTarget,
} from '../js/platforms.js';
import {
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  PLATFORM_THICKNESS,
  SHAKE_BREAK_TIME,
  FIXED_DT,
  PLATFORM_WIDTH_MAX,
} from '../js/constants.js';
import { PLAYER_W, PLAYER_H } from '../js/player.js';

const EDGE_PAD = 8;
const RECYCLE_BELOW = 80;
const GEN_AHEAD = LOGICAL_HEIGHT * 1.2;

function makePlayer(overrides = {}) {
  return {
    x: 100,
    y: 100,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 100,
    ...overrides,
  };
}

describe('platforms', () => {
  /** @type {ReturnType<typeof createWorld>} */
  let world;

  beforeEach(() => {
    world = createWorld();
    world.seed = 12345;
  });

  describe('createWorld / reset', () => {
    it('creates a start ledge of width 140 centered horizontally', () => {
      const start = world.platforms.find((p) => p.w === 140);
      expect(start).toBeTruthy();
      expect(start.type).toBe('solid');
      expect(start.x).toBe((LOGICAL_WIDTH - 140) / 2);
      expect(start.y).toBe(LOGICAL_HEIGHT - 80);
      expect(start.h).toBe(PLATFORM_THICKNESS);
      expect(start.broken).toBe(false);
      expect(start.shakeTimer).toBe(0);
    });

    it('generates platforms above and a few below the start ledge', () => {
      expect(world.platforms.length).toBeGreaterThan(5);
      const startY = LOGICAL_HEIGHT - 80;
      const above = world.platforms.filter((p) => p.y < startY);
      const below = world.platforms.filter((p) => p.y > startY);
      expect(above.length).toBeGreaterThan(0);
      expect(below.length).toBe(3);
      expect(world.topY).toBeLessThan(startY);
    });

    it('reset clears and rebuilds platforms with a new seed', () => {
      world.platforms.push({
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        type: 'solid',
        shakeTimer: 0,
        broken: false,
      });
      const lenWithExtra = world.platforms.length;
      reset(world);
      expect(world.platforms.some((p) => p.w === 140)).toBe(true);
      expect(world.platforms.length).toBeGreaterThan(1);
      expect(world.platforms.length).toBeLessThan(lenWithExtra + 5);
      expect(world.platforms.every((p) => p.w !== 10 || p.y !== 0)).toBe(true);
      expect(typeof world.seed).toBe('number');
    });
  });

  describe('update', () => {
    it('breaks shaky platforms after SHAKE_BREAK_TIME', () => {
      const shaky = {
        x: 50,
        y: 100,
        w: 80,
        h: PLATFORM_THICKNESS,
        type: 'shaky',
        shakeTimer: 0.0001,
        broken: false,
      };
      world.platforms = [shaky];
      world.topY = -1000;

      update(world, SHAKE_BREAK_TIME - 0.01, 0);
      expect(shaky.broken).toBe(false);
      expect(shaky.shakeTimer).toBeGreaterThan(0);

      update(world, 0.02, 0);
      expect(shaky.broken).toBe(true);
      expect(shaky.shakeTimer).toBe(0);
    });

    it('does not advance shake when timer is 0 or already broken', () => {
      const idle = {
        x: 50,
        y: 100,
        w: 80,
        h: PLATFORM_THICKNESS,
        type: 'shaky',
        shakeTimer: 0,
        broken: false,
      };
      const broken = {
        x: 50,
        y: 120,
        w: 80,
        h: PLATFORM_THICKNESS,
        type: 'shaky',
        shakeTimer: 1,
        broken: true,
      };
      world.platforms = [idle, broken];
      world.topY = -1000;
      update(world, 1, 0);
      expect(idle.shakeTimer).toBe(0);
      expect(broken.shakeTimer).toBe(1);
    });

    it('recycles platforms below camera and relocates them above', () => {
      world.seed = 12345;
      const cameraY = 0;
      const viewBottom = cameraY + LOGICAL_HEIGHT;
      const recycled = {
        x: 20,
        y: viewBottom + RECYCLE_BELOW + 10,
        w: 60,
        h: PLATFORM_THICKNESS,
        type: 'shaky',
        shakeTimer: 1,
        broken: true,
      };
      const topBefore = -200;
      world.platforms = [recycled];
      world.topY = topBefore;

      update(world, 0, cameraY);

      expect(recycled.y).toBeLessThan(topBefore);
      expect(recycled.broken).toBe(false);
      expect(recycled.shakeTimer).toBe(0);
      expect(recycled.w).toBeGreaterThanOrEqual(48);
      expect(recycled.w).toBeLessThanOrEqual(PLATFORM_WIDTH_MAX);
      // Generation may keep spawning above the recycled platform
      expect(world.topY).toBeLessThanOrEqual(recycled.y);
      expect(world.platforms).toContain(recycled);
    });

    it('relocateAbove can produce both solid and shaky types', () => {
      const cameraY = 0;
      const viewBottom = cameraY + LOGICAL_HEIGHT;
      const types = new Set();
      // Many recycles with advancing seeds to hit both SHAKY_CHANCE branches
      for (let i = 0; i < 80; i++) {
        world.seed = 1000 + i * 97;
        const p = {
          x: 20,
          y: viewBottom + RECYCLE_BELOW + 10,
          w: 60,
          h: PLATFORM_THICKNESS,
          type: 'solid',
          shakeTimer: 0,
          broken: false,
        };
        world.platforms = [p];
        world.topY = -50;
        update(world, 0, cameraY);
        types.add(p.type);
      }
      expect(types.has('solid')).toBe(true);
      expect(types.has('shaky')).toBe(true);
    });

    it('spawns platforms above until generation covers GEN_AHEAD', () => {
      world.platforms = [
        {
          x: 100,
          y: 500,
          w: 80,
          h: PLATFORM_THICKNESS,
          type: 'solid',
          shakeTimer: 0,
          broken: false,
        },
      ];
      world.topY = 500;
      world.seed = 999;

      const cameraY = 0;
      update(world, 0, cameraY);

      expect(world.topY).toBeLessThanOrEqual(cameraY - GEN_AHEAD);
      expect(world.platforms.length).toBeGreaterThan(1);
    });
  });

  describe('tryLand', () => {
    it('lands when falling, X overlaps, and feet cross the top', () => {
      const plat = {
        x: 100,
        y: 300,
        w: 100,
        h: PLATFORM_THICKNESS,
        type: 'solid',
        shakeTimer: 0,
        broken: false,
      };
      world.platforms = [plat];

      // feet=302, prevFeet=302-120/60=300 → crosses top at 300
      const player = makePlayer({
        x: 120,
        y: 300 - PLAYER_H + 2,
        vy: 120,
      });
      const landed = tryLand(world, player);
      expect(landed).toBe(plat);
      expect(player.y).toBe(plat.y - PLAYER_H);
      expect(player.vy).toBe(0);
    });

    it('starts shaky timer on first land', () => {
      const plat = {
        x: 100,
        y: 300,
        w: 100,
        h: PLATFORM_THICKNESS,
        type: 'shaky',
        shakeTimer: 0,
        broken: false,
      };
      world.platforms = [plat];
      const player = makePlayer({
        x: 120,
        y: 300 - PLAYER_H + 2,
        vy: 120,
      });
      tryLand(world, player);
      expect(plat.shakeTimer).toBe(0.0001);
    });

    it('does not restart shaky timer if already shaking', () => {
      const plat = {
        x: 100,
        y: 300,
        w: 100,
        h: PLATFORM_THICKNESS,
        type: 'shaky',
        shakeTimer: 1.2,
        broken: false,
      };
      world.platforms = [plat];
      const player = makePlayer({
        x: 120,
        y: 300 - PLAYER_H + 2,
        vy: 120,
      });
      tryLand(world, player);
      expect(plat.shakeTimer).toBe(1.2);
    });

    it('returns null when ascending (vy <= 0)', () => {
      const plat = {
        x: 100,
        y: 300,
        w: 100,
        h: PLATFORM_THICKNESS,
        type: 'solid',
        shakeTimer: 0,
        broken: false,
      };
      world.platforms = [plat];
      expect(
        tryLand(world, makePlayer({ x: 120, y: 280, vy: -50 })),
      ).toBeNull();
      expect(
        tryLand(world, makePlayer({ x: 120, y: 280, vy: 0 })),
      ).toBeNull();
    });

    it('returns null when no X overlap', () => {
      const plat = {
        x: 300,
        y: 300,
        w: 40,
        h: PLATFORM_THICKNESS,
        type: 'solid',
        shakeTimer: 0,
        broken: false,
      };
      world.platforms = [plat];
      expect(
        tryLand(
          world,
          makePlayer({ x: 0, y: 300 - PLAYER_H - 2, vy: 120 }),
        ),
      ).toBeNull();
    });

    it('skips broken platforms', () => {
      const plat = {
        x: 100,
        y: 300,
        w: 100,
        h: PLATFORM_THICKNESS,
        type: 'solid',
        shakeTimer: 0,
        broken: true,
      };
      world.platforms = [plat];
      expect(
        tryLand(
          world,
          makePlayer({ x: 120, y: 300 - PLAYER_H - 2, vy: 120 }),
        ),
      ).toBeNull();
    });

    it('picks the highest (smallest y) overlapping platform when multiple qualify', () => {
      const lower = {
        x: 100,
        y: 320,
        w: 100,
        h: PLATFORM_THICKNESS,
        type: 'solid',
        shakeTimer: 0,
        broken: false,
      };
      const higher = {
        x: 100,
        y: 300,
        w: 100,
        h: PLATFORM_THICKNESS,
        type: 'solid',
        shakeTimer: 0,
        broken: false,
      };
      world.platforms = [lower, higher];
      // feet ≈ 318, prevFeet with large vy so both tops are crossed
      const player = makePlayer({
        x: 120,
        y: 318 - PLAYER_H,
        vy: 2000,
      });
      const landed = tryLand(world, player);
      expect(landed).toBe(higher);
    });

    it('rejects when feet never cross (already far below)', () => {
      const plat = {
        x: 100,
        y: 300,
        w: 100,
        h: PLATFORM_THICKNESS,
        type: 'solid',
        shakeTimer: 0,
        broken: false,
      };
      world.platforms = [plat];
      // Feet already well below platform and prevFeet also below
      const player = makePlayer({
        x: 120,
        y: 400,
        vy: 10,
      });
      expect(tryLand(world, player)).toBeNull();
    });
  });

  describe('getStandingPlatform', () => {
    it('returns platform when feet rest on the top', () => {
      const plat = {
        x: 100,
        y: 300,
        w: 100,
        h: PLATFORM_THICKNESS,
        type: 'solid',
        shakeTimer: 0,
        broken: false,
      };
      world.platforms = [plat];
      const player = makePlayer({
        x: 120,
        y: 300 - PLAYER_H,
        vy: 0,
      });
      expect(getStandingPlatform(world, player)).toBe(plat);
    });

    it('returns null when not overlapping or broken', () => {
      const plat = {
        x: 100,
        y: 300,
        w: 100,
        h: PLATFORM_THICKNESS,
        type: 'solid',
        shakeTimer: 0,
        broken: false,
      };
      world.platforms = [plat];
      expect(
        getStandingPlatform(world, makePlayer({ x: 0, y: 300 - PLAYER_H })),
      ).toBeNull();

      plat.broken = true;
      expect(
        getStandingPlatform(world, makePlayer({ x: 120, y: 300 - PLAYER_H })),
      ).toBeNull();
    });

    it('returns null when feet are buried mid-platform or far above', () => {
      const plat = {
        x: 100,
        y: 300,
        w: 100,
        h: PLATFORM_THICKNESS,
        type: 'solid',
        shakeTimer: 0,
        broken: false,
      };
      world.platforms = [plat];
      expect(
        getStandingPlatform(
          world,
          makePlayer({ x: 120, y: 300 - PLAYER_H + 10 }),
        ),
      ).toBeNull();
      expect(
        getStandingPlatform(
          world,
          makePlayer({ x: 120, y: 300 - PLAYER_H - 20 }),
        ),
      ).toBeNull();
    });
  });

  describe('spawnSafetyPlatform', () => {
    it('spawns a solid 100-wide ledge 40px below nearY', () => {
      const p = spawnSafetyPlatform(world, 180, 200);
      expect(p.type).toBe('solid');
      expect(p.w).toBe(100);
      expect(p.y).toBe(240);
      expect(p.x).toBe(180 - 50);
      expect(world.platforms).toContain(p);
    });

    it('clamps X to EDGE_PAD on the left', () => {
      const p = spawnSafetyPlatform(world, 0, 100);
      expect(p.x).toBe(EDGE_PAD);
    });

    it('clamps X to right edge', () => {
      const p = spawnSafetyPlatform(world, LOGICAL_WIDTH, 100);
      expect(p.x).toBe(LOGICAL_WIDTH - 100 - EDGE_PAD);
    });
  });

  describe('findRescueTarget', () => {
    it('prefers solid platforms near the player', () => {
      world.platforms = [
        {
          x: 10,
          y: 400,
          w: 80,
          h: PLATFORM_THICKNESS,
          type: 'shaky',
          shakeTimer: 0,
          broken: false,
        },
        {
          x: 130,
          y: 350,
          w: 80,
          h: PLATFORM_THICKNESS,
          type: 'solid',
          shakeTimer: 0,
          broken: false,
        },
        {
          x: 130,
          y: 100,
          w: 80,
          h: PLATFORM_THICKNESS,
          type: 'solid',
          shakeTimer: 0,
          broken: false,
        },
      ];
      const target = findRescueTarget(world, 360);
      expect(target).toBe(world.platforms[1]);
      expect(target.type).toBe('solid');
    });

    it('skips broken solids and out-of-range platforms', () => {
      world.platforms = [
        {
          x: 130,
          y: 350,
          w: 80,
          h: PLATFORM_THICKNESS,
          type: 'solid',
          shakeTimer: 0,
          broken: true,
        },
        {
          x: 130,
          y: 350 - LOGICAL_HEIGHT,
          w: 80,
          h: PLATFORM_THICKNESS,
          type: 'solid',
          shakeTimer: 0,
          broken: false,
        },
      ];
      // Both out of preferred band or broken — falls back to highest non-broken
      const target = findRescueTarget(world, 360);
      expect(target).toBe(world.platforms[1]);
    });

    it('fallback picks highest (smallest y) non-broken including shaky', () => {
      world.platforms = [
        {
          x: 0,
          y: 900,
          w: 50,
          h: PLATFORM_THICKNESS,
          type: 'shaky',
          shakeTimer: 0,
          broken: false,
        },
        {
          x: 0,
          y: 800,
          w: 50,
          h: PLATFORM_THICKNESS,
          type: 'shaky',
          shakeTimer: 0,
          broken: false,
        },
        {
          x: 0,
          y: 700,
          w: 50,
          h: PLATFORM_THICKNESS,
          type: 'solid',
          shakeTimer: 0,
          broken: true,
        },
      ];
      // playerY such that preferred solid band finds nothing (all shaky / broken)
      const target = findRescueTarget(world, 0);
      expect(target).toBe(world.platforms[1]);
      expect(target.y).toBe(800);
    });

    it('returns null when world has no platforms', () => {
      world.platforms = [];
      expect(findRescueTarget(world, 100)).toBeNull();
    });
  });

  describe('draw', () => {
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

    it('draws solid platform colors', () => {
      const ctx = makeCtx();
      world.platforms = [
        {
          x: 50,
          y: 100,
          w: 80,
          h: PLATFORM_THICKNESS,
          type: 'solid',
          shakeTimer: 0,
          broken: false,
        },
      ];
      draw(ctx, world, { y: 0 });
      const styles = ctx._calls.map((c) => c.style);
      expect(styles).toContain('#4a7c59');
      expect(styles).toContain('#6b9b76');
      expect(styles).toContain('#2d4a34');
    });

    it('draws shaky platform with cracks and shake offset', () => {
      vi.spyOn(Math, 'sin').mockReturnValue(1);
      vi.spyOn(Math, 'cos').mockReturnValue(0.5);
      const ctx = makeCtx();

      world.platforms = [
        {
          x: 50,
          y: 100,
          w: 80,
          h: PLATFORM_THICKNESS,
          type: 'shaky',
          shakeTimer: 0.5,
          broken: false,
        },
      ];
      draw(ctx, world, { y: 0 });

      expect(Math.sin).toHaveBeenCalled();
      expect(Math.cos).toHaveBeenCalled();
      const styles = ctx._calls.map((c) => c.style);
      expect(styles).toContain('#a67c52');
      expect(styles).toContain('#8b5a2b');
      expect(styles).toContain('#5c4030');

      // First fillRect should be offset: x+2.5, y+0.75
      const first = ctx._calls[0];
      expect(first.args[0]).toBeCloseTo(50 + 2.5);
      expect(first.args[1]).toBeCloseTo(100 + 0.75);
    });

    it('skips broken and off-screen platforms', () => {
      const ctx = makeCtx();
      world.platforms = [
        {
          x: 50,
          y: 100,
          w: 80,
          h: PLATFORM_THICKNESS,
          type: 'solid',
          shakeTimer: 0,
          broken: true,
        },
        {
          x: 50,
          y: -100,
          w: 80,
          h: PLATFORM_THICKNESS,
          type: 'solid',
          shakeTimer: 0,
          broken: false,
        },
        {
          x: 50,
          y: LOGICAL_HEIGHT + 100,
          w: 80,
          h: PLATFORM_THICKNESS,
          type: 'solid',
          shakeTimer: 0,
          broken: false,
        },
      ];
      draw(ctx, world, { y: 0 });
      expect(ctx._calls.length).toBe(0);
    });

    it('draws shaky without offset when shakeTimer is 0', () => {
      const ctx = makeCtx();
      world.platforms = [
        {
          x: 40,
          y: 80,
          w: 70,
          h: PLATFORM_THICKNESS,
          type: 'shaky',
          shakeTimer: 0,
          broken: false,
        },
      ];
      draw(ctx, world, { y: 0 });
      expect(ctx._calls[0].args[0]).toBe(40);
      expect(ctx._calls[0].args[1]).toBe(80);
    });
  });
});
