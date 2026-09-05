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

  it('grants exactly one bird when beating previous personal best', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    seed({ bestScore: 500, inventory: { rescueBird: 0, safetyPlatform: 0 } });
    const runStats = { prevBestScore: 100, currentScore: 500 };
    const result = checkMilestones(storage.load(), runStats);
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0]).toMatchObject({
      type: 'newHighScore',
      item: 'rescueBird',
      amount: 1,
    });
    expect(result.notified).toBe(true);
    expect(result.save.inventory.rescueBird).toBe(1);
    expect(runStats.highScoreBirdGranted).toBe(true);
    expect(info).toHaveBeenCalledWith(expect.stringContaining('[milestone]'));
  });

  it('grants only one bird even when jumping far past previous best', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    seed({ bestScore: 1600, inventory: { rescueBird: 0, safetyPlatform: 0 } });
    const result = checkMilestones(storage.load(), { prevBestScore: 100 });
    expect(result.grants).toEqual([
      expect.objectContaining({ type: 'newHighScore', amount: 1 }),
    ]);
    expect(result.save.inventory.rescueBird).toBe(1);
  });

  it('does not grant when score does not beat previous best', () => {
    seed({ bestScore: 900, inventory: { rescueBird: 0, safetyPlatform: 0 } });
    const result = checkMilestones(storage.load(), { prevBestScore: 1000 });
    expect(result.grants).toEqual([]);
    expect(result.notified).toBe(false);
  });

  it('does not grant when already granted this run', () => {
    seed({ bestScore: 500, inventory: { rescueBird: 0, safetyPlatform: 0 } });
    const result = checkMilestones(storage.load(), {
      prevBestScore: 0,
      highScoreBirdGranted: true,
    });
    expect(result.grants).toEqual([]);
    expect(result.notified).toBe(false);
    expect(storage.load().inventory.rescueBird).toBe(0);
  });

  it('does not grant birds for solid-land milestones', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const runStats = {
      solidLands: 30,
      landGrantsGiven: 0,
      prevBestScore: 100,
      currentScore: 50,
    };
    seed({ bestScore: 50 });
    const result = checkMilestones(storage.load(), runStats);
    expect(result.grants).toEqual([]);
    expect(result.notified).toBe(false);
    expect(storage.load().inventory.rescueBird).toBe(0);
    expect(info).not.toHaveBeenCalled();
  });

  it('does not grant birds for score-band crossings alone without beating prev best via grant path already covered', () => {
    // Staying at or below prevBest: no grant even if bestScore is a round band.
    seed({ bestScore: 1000, inventory: { rescueBird: 0, safetyPlatform: 0 } });
    const result = checkMilestones(storage.load(), { prevBestScore: 1000 });
    expect(result.grants).toEqual([]);
  });

  it('is a no-op when nothing is earned', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    seed({ bestScore: 100 });
    const result = checkMilestones(storage.load(), {
      prevBestScore: 100,
      currentScore: 50,
    });
    expect(result.grants).toEqual([]);
    expect(result.notified).toBe(false);
    expect(info).not.toHaveBeenCalled();
  });

  it('uses currentScore when it exceeds prevBest even if save.bestScore lags', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    seed({ bestScore: 10, inventory: { rescueBird: 0, safetyPlatform: 0 } });
    const runStats = { prevBestScore: 10, currentScore: 40 };
    const result = checkMilestones(storage.load(), runStats);
    expect(result.grants[0].type).toBe('newHighScore');
    expect(result.save.inventory.rescueBird).toBe(1);
    expect(runStats.highScoreBirdGranted).toBe(true);
  });

  it('loads save when save arg is nullish', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    seed({ bestScore: 500, inventory: { rescueBird: 0, safetyPlatform: 0 } });
    const result = checkMilestones(/** @type {any} */ (null), {
      prevBestScore: 0,
    });
    expect(result.grants[0].type).toBe('newHighScore');
  });

  it('treats non-finite prevBestScore / currentScore as zero', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    seed({ bestScore: 10 });
    const result = checkMilestones(storage.load(), {
      prevBestScore: NaN,
      currentScore: undefined,
    });
    // bestScore 10 > prevBest 0 → grant
    expect(result.grants).toHaveLength(1);
    expect(info).toHaveBeenCalled();
  });

  it('floors negative bestScore when computing grants', () => {
    const save = { ...storage.load(), bestScore: -50 };
    const result = checkMilestones(save, { prevBestScore: -10, currentScore: -5 });
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
