import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STORAGE_KEY } from '../js/constants.js';
import * as storage from '../js/storage.js';
import { getCounts, canUse, use, checkMilestones } from '../js/inventory.js';

/** @param {Partial<import('../js/storage.js').SaveData>} data */
function seed(data) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      runs: [],
      bestScore: 0,
      wallet: 0,
      unlocked: [],
      equipped: { hat: null, sword: 'default' },
      inventory: { rescueBird: 0, safetyPlatform: 0 },
      muted: false,
      ...data,
    }),
  );
}

describe('inventory.getCounts / canUse / use', () => {
  it('getCounts returns a copy of inventory counts', () => {
    seed({ inventory: { rescueBird: 3, safetyPlatform: 1 } });
    const counts = getCounts();
    expect(counts).toEqual({ rescueBird: 3, safetyPlatform: 1 });
    counts.rescueBird = 99;
    expect(getCounts().rescueBird).toBe(3);
  });

  it('canUse is true only when count > 0', () => {
    seed({ inventory: { rescueBird: 2, safetyPlatform: 0 } });
    expect(canUse('rescueBird')).toBe(true);
    expect(canUse('safetyPlatform')).toBe(false);
    expect(canUse(/** @type {any} */ ('missingKey'))).toBe(false);
  });

  it('use spends one item via spendInventory', () => {
    seed({ inventory: { rescueBird: 2, safetyPlatform: 1 } });
    const result = use('rescueBird');
    expect(result.ok).toBe(true);
    expect(result.data.inventory.rescueBird).toBe(1);
    expect(use('safetyPlatform').ok).toBe(true);
    expect(use('safetyPlatform').ok).toBe(false);
  });
});

describe('inventory.checkMilestones', () => {
  beforeEach(() => {
    seed({ inventory: { rescueBird: 0, safetyPlatform: 0 }, bestScore: 0 });
  });

  it('grants birds when bestScore newly crosses a 500 band', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    seed({ bestScore: 500, inventory: { rescueBird: 0, safetyPlatform: 0 } });
    const save = storage.load();
    const result = checkMilestones(save, { prevBestScore: 499 });
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0]).toMatchObject({
      type: 'scoreBand',
      item: 'rescueBird',
      amount: 1,
    });
    expect(result.notified).toBe(true);
    expect(result.save.inventory.rescueBird).toBe(1);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining('[milestone]'),
    );
  });

  it('grants multiple birds when jumping several score bands', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    seed({ bestScore: 1600, inventory: { rescueBird: 0, safetyPlatform: 0 } });
    const result = checkMilestones(storage.load(), { prevBestScore: 100 });
    // prevBand 0, curBand 3 → 3 birds
    expect(result.grants).toEqual([
      expect.objectContaining({
        type: 'scoreBand',
        amount: 3,
        detail: expect.stringContaining('birds'),
      }),
    ]);
    expect(result.save.inventory.rescueBird).toBe(3);
  });

  it('does not grant when staying in the same score band', () => {
    seed({ bestScore: 900, inventory: { rescueBird: 0, safetyPlatform: 0 } });
    const result = checkMilestones(storage.load(), { prevBestScore: 500 });
    expect(result.grants.filter((g) => g.type === 'scoreBand')).toHaveLength(0);
    expect(result.notified).toBe(false);
  });

  it('grants solid-land birds every 15 lands and mutates landGrantsGiven', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const runStats = { solidLands: 30, landGrantsGiven: 0 };
    const result = checkMilestones(storage.load(), runStats);
    expect(result.grants).toEqual([
      expect.objectContaining({
        type: 'solidLands',
        amount: 2,
        detail: expect.stringContaining('birds'),
      }),
    ]);
    expect(runStats.landGrantsGiven).toBe(2);
    expect(result.save.inventory.rescueBird).toBe(2);
  });

  it('only awards newly earned land grants', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    seed({ inventory: { rescueBird: 1, safetyPlatform: 0 } });
    const runStats = { solidLands: 45, landGrantsGiven: 2 };
    const result = checkMilestones(storage.load(), runStats);
    expect(result.grants[0]).toMatchObject({ type: 'solidLands', amount: 1 });
    expect(runStats.landGrantsGiven).toBe(3);
    expect(result.save.inventory.rescueBird).toBe(2);
  });

  it('uses singular wording for a single land grant', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const runStats = { solidLands: 15, landGrantsGiven: 0 };
    const result = checkMilestones(storage.load(), runStats);
    expect(result.grants[0].detail).toMatch(/bird(?!s)/);
  });

  it('is a no-op when nothing is earned', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const runStats = { solidLands: 14, landGrantsGiven: 0, prevBestScore: 0 };
    seed({ bestScore: 100 });
    const result = checkMilestones(storage.load(), runStats);
    expect(result.grants).toEqual([]);
    expect(result.notified).toBe(false);
    expect(runStats.landGrantsGiven).toBe(0);
    expect(info).not.toHaveBeenCalled();
  });

  it('combines score-band and solid-land grants in one call', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    seed({ bestScore: 1000, inventory: { rescueBird: 0, safetyPlatform: 0 } });
    const runStats = { prevBestScore: 0, solidLands: 15, landGrantsGiven: 0 };
    const result = checkMilestones(storage.load(), runStats);
    expect(result.grants).toHaveLength(2);
    expect(result.grants.map((g) => g.type)).toEqual(['scoreBand', 'solidLands']);
    expect(result.save.inventory.rescueBird).toBe(3); // 2 bands + 1 land
    expect(runStats.landGrantsGiven).toBe(1);
  });

  it('loads save when save arg is nullish', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    seed({ bestScore: 500, inventory: { rescueBird: 0, safetyPlatform: 0 } });
    const result = checkMilestones(/** @type {any} */ (null), {
      prevBestScore: 0,
    });
    expect(result.grants[0].type).toBe('scoreBand');
  });

  it('treats non-finite prevBestScore / solidLands as zero', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    seed({ bestScore: 10 });
    const result = checkMilestones(storage.load(), {
      prevBestScore: NaN,
      solidLands: undefined,
      landGrantsGiven: undefined,
    });
    expect(result.grants).toEqual([]);
    expect(info).not.toHaveBeenCalled();
  });

  it('floors negative bestScore / solidLands when computing grants', () => {
    const save = { ...storage.load(), bestScore: -50 };
    const runStats = { solidLands: -5, landGrantsGiven: 0, prevBestScore: -10 };
    const result = checkMilestones(save, runStats);
    expect(result.grants).toEqual([]);
  });

  it('treats nullish bestScore as zero via nullish coalescing', () => {
    const save = { ...storage.load(), bestScore: /** @type {any} */ (null) };
    const result = checkMilestones(save, { prevBestScore: 0 });
    expect(result.grants).toEqual([]);
    expect(result.notified).toBe(false);
  });

  it('uses finite prevBestScore branch when provided', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    seed({ bestScore: 500, inventory: { rescueBird: 0, safetyPlatform: 0 } });
    const result = checkMilestones(storage.load(), { prevBestScore: 0 });
    expect(result.grants[0].amount).toBe(1);
  });
});
