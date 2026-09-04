import { describe, it, expect } from 'vitest';
import {
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  GRAVITY,
  CHARGE_TIME,
  MIN_JUMP_VY,
  MAX_JUMP_VY,
  MOVE_SPEED,
  JUMP_HX,
  AIR_ACCEL,
  AIR_CONTROL_PRE_APEX,
  AIR_CONTROL_POST_APEX,
  PLATFORM_WIDTH_MIN,
  PLATFORM_WIDTH_MAX,
  PLATFORM_GAP_MIN,
  PLATFORM_GAP_MAX,
  PLATFORM_THICKNESS,
  SHAKY_CHANCE,
  SHAKE_BREAK_TIME,
  SCORE_PER_HEIGHT,
  DANGER_LINE_MARGIN,
  FIXED_DT,
  CONTINUE_TIMEOUT,
  MAX_CONTINUES,
  STORAGE_KEY,
  SKY_COLOR,
} from '../js/constants.js';

describe('constants', () => {
  it('exports expected core gameplay values', () => {
    expect(LOGICAL_WIDTH).toBe(360);
    expect(LOGICAL_HEIGHT).toBe(640);
    expect(GRAVITY).toBe(1800);
    expect(CHARGE_TIME).toBe(0.85);
    expect(MIN_JUMP_VY).toBe(-320);
    expect(MAX_JUMP_VY).toBe(-780);
    expect(MOVE_SPEED).toBe(230);
    expect(JUMP_HX).toBe(280);
    expect(AIR_ACCEL).toBe(3600);
    expect(AIR_CONTROL_PRE_APEX).toBe(0.8);
    expect(AIR_CONTROL_POST_APEX).toBe(1.05);
    expect(PLATFORM_WIDTH_MIN).toBe(48);
    expect(PLATFORM_WIDTH_MAX).toBe(120);
    expect(PLATFORM_GAP_MIN).toBe(40);
    expect(PLATFORM_GAP_MAX).toBe(90);
    expect(PLATFORM_THICKNESS).toBe(16);
    expect(SHAKY_CHANCE).toBe(0.25);
    expect(SHAKE_BREAK_TIME).toBe(2.5);
    expect(SCORE_PER_HEIGHT).toBe(10);
    expect(DANGER_LINE_MARGIN).toBe(48);
    expect(FIXED_DT).toBeCloseTo(1 / 60);
    expect(CONTINUE_TIMEOUT).toBe(6);
    expect(MAX_CONTINUES).toBe(2);
    expect(STORAGE_KEY).toBe('fantasyPeakSave');
    expect(SKY_COLOR).toBe('#152238');
  });
});
