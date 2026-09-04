/**
 * Inventory helpers + high-score bird reward.
 *
 * When a run first beats the previous personal best, grant exactly +1 rescueBird
 * once per that achievement. No land-milestone or score-band mid-run grants.
 */
import * as storage from './storage.js';
/**
 * @returns {{ rescueBird: number, safetyPlatform: number }}
 */
export function getCounts() {
  return { ...storage.load().inventory };
}
/**
 * @param {'rescueBird'|'safetyPlatform'} key
 * @returns {boolean}
 */
export function canUse(key) {
  const inv = storage.load().inventory;
  return (inv[key] ?? 0) > 0;
}
/**
 * @param {'rescueBird'|'safetyPlatform'} key
 * @returns {{ ok: boolean, data: import('./storage.js').SaveData }}
 */
export function use(key) {
  return storage.spendInventory(key, 1);
}
/**
 * @typedef {{
 *   prevBestScore?: number,
 *   score?: number,
 *   currentScore?: number,
 *   highScoreBirdGranted?: boolean,
 * }} RunStats
 *
 * @typedef {{ type: string, item: string, amount: number, detail: string }} MilestoneGrant
 */
/**
 * Grant +1 rescueBird when the run beats the previous personal best.
 * Skips if highScoreBirdGranted is already true (mid-run grant already applied).
 *
 * Prefer passing runStats.currentScore / score during play; otherwise uses
 * save.bestScore (e.g. after addRun at end of run).
 *
 * @param {import('./storage.js').SaveData} save
 * @param {RunStats} [runStats={}]
 * @returns {{
 *   save: import('./storage.js').SaveData,
 *   grants: MilestoneGrant[],
 *   notified: boolean,
 * }}
 */
export function checkMilestones(save, runStats = {}) {
  /** @type {MilestoneGrant[]} */
  const grants = [];
  let data = save ?? storage.load();

  if (runStats.highScoreBirdGranted) {
    return { save: data, grants, notified: false };
  }

  const prevBest = Number.isFinite(runStats.prevBestScore)
    ? Math.max(0, Math.floor(runStats.prevBestScore))
    : 0;
  const liveScore = Number.isFinite(runStats.currentScore)
    ? runStats.currentScore
    : runStats.score;
  const score = Number.isFinite(liveScore)
    ? Math.max(0, Math.floor(liveScore))
    : Math.max(0, Math.floor(data.bestScore ?? 0));

  if (score > prevBest) {
    data = storage.addInventory('rescueBird', 1);
    runStats.highScoreBirdGranted = true;
    grants.push({
      type: 'newHighScore',
      item: 'rescueBird',
      amount: 1,
      detail: 'New high score: +1 rescue bird',
    });
  }

  const notified = grants.length > 0;
  if (notified && typeof console !== 'undefined') {
    for (const g of grants) {
      console.info(`[milestone] ${g.detail}`);
    }
  }
  return { save: data, grants, notified };
}
