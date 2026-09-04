import { describe, it, expect } from 'vitest';
import {
  BIRD_RESCUE_DURATION,
  BIRD_RESCUE_DURATION_MIN,
  BIRD_RESCUE_DURATION_MAX,
  createBirdRescue,
  updateBirdRescue,
  phaseAt,
  isBirdRescueActive,
} from '../js/birdRescue.js';
import { LOGICAL_WIDTH } from '../js/constants.js';

describe('birdRescue', () => {
  const player = { x: 100, y: 400, w: 18, h: 26 };
  const platform = { x: 140, y: 300, w: 80 };

  it('clamps duration into 2–3s bounds', () => {
    expect(BIRD_RESCUE_DURATION).toBeGreaterThanOrEqual(BIRD_RESCUE_DURATION_MIN);
    expect(BIRD_RESCUE_DURATION).toBeLessThanOrEqual(BIRD_RESCUE_DURATION_MAX);

    const short = createBirdRescue(player, platform, { duration: 0.5 });
    expect(short.duration).toBe(BIRD_RESCUE_DURATION_MIN);

    const long = createBirdRescue(player, platform, { duration: 9 });
    expect(long.duration).toBe(BIRD_RESCUE_DURATION_MAX);
  });

  it('phaseAt walks approach → lift → carry → done', () => {
    expect(phaseAt(0).phase).toBe('approach');
    expect(phaseAt(0.2).phase).toBe('approach');
    expect(phaseAt(0.4).phase).toBe('lift');
    expect(phaseAt(0.7).phase).toBe('carry');
    expect(phaseAt(1).phase).toBe('done');
  });

  it('bird starts off-screen and approaches the player', () => {
    const anim = createBirdRescue(player, platform);
    expect(anim.active).toBe(true);
    expect(anim.phase).toBe('approach');
    expect(anim.birdX < 0 || anim.birdX > LOGICAL_WIDTH).toBe(true);

    const startBirdX = anim.birdX;
    updateBirdRescue(anim, anim.duration * 0.15);
    expect(anim.phase).toBe('approach');
    expect(Math.abs(anim.birdX - player.x)).toBeLessThan(Math.abs(startBirdX - player.x));
    expect(anim.playerX).toBe(player.x);
    expect(anim.playerY).toBe(player.y);
  });

  it('lifts then carries player to platform destination', () => {
    const anim = createBirdRescue(player, platform, { duration: 2.5 });
    const destX = platform.x + platform.w / 2 - player.w / 2;
    const destY = platform.y - player.h;

    // Into lift
    updateBirdRescue(anim, 2.5 * 0.4);
    expect(anim.phase).toBe('lift');
    expect(anim.playerY).toBeLessThan(player.y);

    // Into carry
    updateBirdRescue(anim, 2.5 * 0.2);
    expect(anim.phase).toBe('carry');

    // Finish
    const { done, phase } = updateBirdRescue(anim, 2.5);
    expect(done).toBe(true);
    expect(phase).toBe('done');
    expect(anim.active).toBe(false);
    expect(anim.playerX).toBeCloseTo(destX, 5);
    expect(anim.playerY).toBeCloseTo(destY, 5);
    expect(isBirdRescueActive(anim)).toBe(false);
  });

  it('completes within nominal duration and ignores further updates', () => {
    const anim = createBirdRescue(player, platform, { duration: 2.5 });
    let steps = 0;
    while (anim.active && steps < 200) {
      updateBirdRescue(anim, 1 / 60);
      steps += 1;
    }
    expect(anim.active).toBe(false);
    expect(steps / 60).toBeGreaterThanOrEqual(BIRD_RESCUE_DURATION_MIN - 0.05);
    expect(steps / 60).toBeLessThanOrEqual(BIRD_RESCUE_DURATION_MAX + 0.05);

    const x = anim.playerX;
    updateBirdRescue(anim, 1);
    expect(anim.playerX).toBe(x);
  });
});
