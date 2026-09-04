import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEY } from '../js/constants.js';
import {
  load,
  save,
  addRun,
  addWallet,
  spendWallet,
  unlock,
  equip,
  addInventory,
  spendInventory,
} from '../js/storage.js';

/** @param {Partial<import('../js/storage.js').SaveData> & { equipped?: unknown }} data */
function seed(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

describe('storage.load', () => {
  it('returns default save when localStorage is empty', () => {
    expect(load()).toEqual({
      runs: [],
      bestScore: 0,
      wallet: 0,
      unlocked: [],
      equipped: { hat: null, sword: 'default' },
      inventory: { rescueBird: 0, safetyPlatform: 0 },
      muted: false,
    });
  });

  it('loads and normalizes a valid save', () => {
    seed({
      runs: [{ score: 10, height: 100, at: '2020-01-01T00:00:00.000Z' }],
      bestScore: 10,
      wallet: 42,
      unlocked: ['hat'],
      equipped: { hat: 'hat', sword: 'golden' },
      inventory: { rescueBird: 2, safetyPlatform: 1 },
      muted: true,
    });
    const data = load();
    expect(data.wallet).toBe(42);
    expect(data.bestScore).toBe(10);
    expect(data.unlocked).toEqual(['hat']);
    expect(data.equipped).toEqual({ hat: 'hat', sword: 'golden' });
    expect(data.inventory).toEqual({ rescueBird: 2, safetyPlatform: 1 });
    expect(data.muted).toBe(true);
    expect(data.runs).toHaveLength(1);
  });

  it('returns default save for corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json');
    expect(load()).toEqual({
      runs: [],
      bestScore: 0,
      wallet: 0,
      unlocked: [],
      equipped: { hat: null, sword: 'default' },
      inventory: { rescueBird: 0, safetyPlatform: 0 },
      muted: false,
    });
  });

  it('normalizes invalid shapes to safe defaults', () => {
    seed({
      runs: 'nope',
      bestScore: 'x',
      wallet: NaN,
      unlocked: null,
      equipped: 123,
      inventory: { rescueBird: 'a', safetyPlatform: undefined },
      muted: 'yes',
    });
    const data = load();
    expect(data.runs).toEqual([]);
    expect(data.bestScore).toBe(0);
    expect(data.wallet).toBe(0);
    expect(data.unlocked).toEqual([]);
    expect(data.equipped).toEqual({ hat: null, sword: 'default' });
    expect(data.inventory).toEqual({ rescueBird: 0, safetyPlatform: 0 });
    expect(data.muted).toBe(true);
  });

  it('fills missing inventory fields from defaults', () => {
    seed({ inventory: {} });
    expect(load().inventory).toEqual({ rescueBird: 0, safetyPlatform: 0 });
  });
});

describe('storage normalizeEquipped (via load/save)', () => {
  it('normalizes legacy equipped string "hat"', () => {
    seed({ equipped: 'hat' });
    expect(load().equipped).toEqual({ hat: 'hat', sword: 'default' });
  });

  it('normalizes legacy equipped string "goldenSword"', () => {
    seed({ equipped: 'goldenSword' });
    expect(load().equipped).toEqual({ hat: null, sword: 'golden' });
  });

  it('ignores unknown legacy equipped strings', () => {
    seed({ equipped: 'cape' });
    expect(load().equipped).toEqual({ hat: null, sword: 'default' });
  });

  it('normalizes null / undefined equipped', () => {
    seed({ equipped: null });
    expect(load().equipped).toEqual({ hat: null, sword: 'default' });
    seed({});
    expect(load().equipped).toEqual({ hat: null, sword: 'default' });
  });

  it('normalizes object forms with invalid slot values', () => {
    seed({ equipped: { hat: 'cape', sword: 'silver' } });
    expect(load().equipped).toEqual({ hat: null, sword: 'default' });
  });

  it('keeps valid object equipped form', () => {
    seed({ equipped: { hat: 'hat', sword: 'golden' } });
    expect(load().equipped).toEqual({ hat: 'hat', sword: 'golden' });
  });
});

describe('storage.save', () => {
  it('persists normalized data and returns it', () => {
    const result = save({
      runs: [],
      bestScore: 5,
      wallet: 9,
      unlocked: ['hat'],
      equipped: { hat: 'hat', sword: 'default' },
      inventory: { rescueBird: 1, safetyPlatform: 0 },
      muted: false,
    });
    expect(result.wallet).toBe(9);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toMatchObject({
      wallet: 9,
      unlocked: ['hat'],
    });
  });
});

describe('storage.addRun', () => {
  it('records a run, awards wallet, and updates bestScore', () => {
    const data = addRun(120.7, 45.9);
    expect(data.runs[0]).toMatchObject({ score: 120, height: 45 });
    expect(data.runs[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(data.bestScore).toBe(120);
    expect(data.wallet).toBe(120);
  });

  it('floors negatives to zero for score and height', () => {
    const data = addRun(-10, -3);
    expect(data.runs[0]).toMatchObject({ score: 0, height: 0 });
    expect(data.bestScore).toBe(0);
    expect(data.wallet).toBe(0);
  });

  it('does not lower bestScore when new score is lower', () => {
    seed({ bestScore: 500, wallet: 0, runs: [] });
    const data = addRun(100, 10);
    expect(data.bestScore).toBe(500);
    expect(data.wallet).toBe(100);
  });

  it('caps run history at 50', () => {
    seed({
      bestScore: 0,
      wallet: 0,
      runs: Array.from({ length: 50 }, (_, i) => ({
        score: i,
        height: i,
        at: `2020-01-01T00:00:${String(i).padStart(2, '0')}.000Z`,
      })),
    });
    const data = addRun(999, 1);
    expect(data.runs).toHaveLength(50);
    expect(data.runs[0].score).toBe(999);
  });

  it('keeps wallet non-negative when adding score to a negative wallet', () => {
    seed({ wallet: -5, bestScore: 0, runs: [] });
    const data = addRun(0, 0);
    expect(data.wallet).toBe(0);
  });
});

describe('storage.addWallet', () => {
  it('adds floored amount to wallet', () => {
    seed({ wallet: 10 });
    expect(addWallet(5.9).wallet).toBe(15);
  });

  it('floors wallet to zero when result would be negative', () => {
    seed({ wallet: 3 });
    expect(addWallet(-10).wallet).toBe(0);
  });
});

describe('storage.spendWallet', () => {
  it('spends when affordable', () => {
    seed({ wallet: 100 });
    const result = spendWallet(40.8);
    expect(result.ok).toBe(true);
    expect(result.data.wallet).toBe(60);
  });

  it('rejects insufficient funds', () => {
    seed({ wallet: 10 });
    const result = spendWallet(11);
    expect(result.ok).toBe(false);
    expect(result.data.wallet).toBe(10);
    expect(load().wallet).toBe(10);
  });

  it('rejects negative cost', () => {
    seed({ wallet: 50 });
    const result = spendWallet(-1);
    expect(result.ok).toBe(false);
    expect(result.data.wallet).toBe(50);
  });

  it('allows spending exact balance', () => {
    seed({ wallet: 25 });
    expect(spendWallet(25)).toEqual({
      ok: true,
      data: expect.objectContaining({ wallet: 0 }),
    });
  });
});

describe('storage.unlock', () => {
  it('adds item id once', () => {
    expect(unlock('hat').unlocked).toEqual(['hat']);
    expect(unlock('hat').unlocked).toEqual(['hat']);
    expect(unlock('goldenSword').unlocked).toEqual(['hat', 'goldenSword']);
  });
});

describe('storage.equip', () => {
  beforeEach(() => {
    seed({
      unlocked: ['hat', 'goldenSword'],
      equipped: { hat: null, sword: 'default' },
    });
  });

  it('clears both slots when itemId is null', () => {
    seed({
      unlocked: ['hat', 'goldenSword'],
      equipped: { hat: 'hat', sword: 'golden' },
    });
    expect(equip(null).equipped).toEqual({ hat: null, sword: 'default' });
  });

  it('unequips hat with hat:off', () => {
    seed({
      unlocked: ['hat'],
      equipped: { hat: 'hat', sword: 'default' },
    });
    expect(equip('hat:off').equipped).toEqual({ hat: null, sword: 'default' });
  });

  it('unequips golden sword with goldenSword:off', () => {
    seed({
      unlocked: ['goldenSword'],
      equipped: { hat: null, sword: 'golden' },
    });
    expect(equip('goldenSword:off').equipped).toEqual({
      hat: null,
      sword: 'default',
    });
  });

  it('equips unlocked hat and goldenSword', () => {
    expect(equip('hat').equipped.hat).toBe('hat');
    expect(equip('goldenSword').equipped.sword).toBe('golden');
  });

  it('does not equip locked cosmetics', () => {
    seed({ unlocked: [], equipped: { hat: null, sword: 'default' } });
    expect(equip('hat').equipped.hat).toBeNull();
    expect(equip('goldenSword').equipped.sword).toBe('default');
  });

  it('ignores unknown item ids', () => {
    const before = load().equipped;
    expect(equip('cape').equipped).toEqual(before);
  });
});

describe('storage.addInventory / spendInventory', () => {
  it('adds inventory for valid keys', () => {
    expect(addInventory('rescueBird', 2.9).inventory.rescueBird).toBe(2);
    expect(addInventory('safetyPlatform').inventory.safetyPlatform).toBe(1);
  });

  it('rejects invalid addInventory keys without persisting', () => {
    const before = load();
    const result = addInventory(/** @type {any} */ ('coins'), 5);
    expect(result).toEqual(before);
    expect(load().inventory).toEqual({ rescueBird: 0, safetyPlatform: 0 });
  });

  it('floors inventory to zero when adding a large negative amount', () => {
    seed({ inventory: { rescueBird: 2, safetyPlatform: 0 } });
    expect(addInventory('rescueBird', -10).inventory.rescueBird).toBe(0);
  });

  it('spends inventory when sufficient', () => {
    seed({ inventory: { rescueBird: 3, safetyPlatform: 2 } });
    const result = spendInventory('rescueBird', 2);
    expect(result.ok).toBe(true);
    expect(result.data.inventory.rescueBird).toBe(1);
  });

  it('rejects invalid spendInventory keys', () => {
    const result = spendInventory(/** @type {any} */ ('coins'), 1);
    expect(result.ok).toBe(false);
  });

  it('rejects insufficient inventory', () => {
    seed({ inventory: { rescueBird: 1, safetyPlatform: 0 } });
    const result = spendInventory('rescueBird', 2);
    expect(result.ok).toBe(false);
    expect(result.data.inventory.rescueBird).toBe(1);
  });

  it('rejects negative spend cost', () => {
    seed({ inventory: { rescueBird: 5, safetyPlatform: 0 } });
    expect(spendInventory('rescueBird', -1).ok).toBe(false);
  });

  it('defaults spend amount to 1', () => {
    seed({ inventory: { rescueBird: 2, safetyPlatform: 1 } });
    expect(spendInventory('safetyPlatform').data.inventory.safetyPlatform).toBe(0);
  });
});
