/**
 * Fantasy Peak Climber — tunable constants
 * All gameplay knobs live here for other agents to adjust.
 */

/** Logical (internal) canvas resolution */
export const LOGICAL_WIDTH = 360;
export const LOGICAL_HEIGHT = 640;

/** Physics */
export const GRAVITY = 1800; // px/s^2
export const CHARGE_TIME = 0.85; // seconds to full charge
export const MIN_JUMP_VY = -320; // weakest charged jump (up is negative)
export const MAX_JUMP_VY = -780; // strongest charged jump
/** Grounded / air target horizontal speed (px/s) */
export const MOVE_SPEED = 230;
/** Horizontal impulse scale on jump release */
export const JUMP_HX = 280;
/** How quickly vx approaches target in air */
export const AIR_ACCEL = 3600;
/** Horizontal air control multipliers relative to grounded move speed */
export const AIR_CONTROL_PRE_APEX = 0.8;
export const AIR_CONTROL_POST_APEX = 1.05;

/** Platforms */
export const PLATFORM_WIDTH_MIN = 48;
export const PLATFORM_WIDTH_MAX = 120;
export const PLATFORM_GAP_MIN = 40;
export const PLATFORM_GAP_MAX = 90;
export const PLATFORM_THICKNESS = 16;
export const SHAKY_CHANCE = 0.25;
export const SHAKE_BREAK_TIME = 2.5; // seconds until shaky platform breaks

/** Scoring */
/** Score from climb height: Math.floor(height / SCORE_PER_HEIGHT) */
export const SCORE_PER_HEIGHT = 10;
export const HUD_SCORE_SCALE_MIN = 1;
export const HUD_SCORE_SCALE_MAX = 1.35;
export const SCORE_TICK_RATE = 40; // display score catch-up units per second

/** Store prices (wallet currency) */
export const PRICE_HAT = 500;
export const PRICE_GOLDEN_SWORD = 1_000_000;
export const PRICE_RESCUE_BIRD = 250;
export const PRICE_SAFETY_PLATFORM = 400;

/** Continue / fail */
export const CONTINUE_TIMEOUT = 6; // seconds
/** Max continues per run: one bird rescue + one safety platform (tracked separately). */
export const MAX_CONTINUES = 2;
/** Pixels below viewport before danger-line / fall triggers */
export const DANGER_LINE_MARGIN = 48;

/** Persistence */
export const STORAGE_KEY = 'fantasyPeakSave';

/** Audio defaults (0–1) */
export const VOLUME_MASTER = 0.7;
export const VOLUME_MUSIC = 0.45;
export const VOLUME_SFX = 0.8;

/** Fixed timestep (seconds) */
export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = 0.25;

/** Sky clear color used by stub renderer */
export const SKY_COLOR = '#152238';
