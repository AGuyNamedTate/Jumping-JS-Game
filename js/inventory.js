/**
 * Inventory helpers + milestone rewards.
 *
 * Milestone rules (simple, first-time / per-run):
 * 1. Best-score bands — every time bestScore newly crosses a multiple of 500
 *    (500, 1000, 1500, …), grant +1 rescueBird. Uses runStats.prevBestScore
 *    (best before this run) vs current save.bestScore.
 * 2. Solid lands — every 15 solid platform lands within a single run grants
 *    +1 rescueBird. Tracks progress via runStats.landGrantsGiven (mutated).
 */
import * as storage from './storage.js';
const SCORE_BAND = 500;
const LANDS_PER_BIRD = 15;
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
 *   solidLands?: number,
 *   prevBestScore?: number,
 *   landGrantsGiven?: number,
 * }} RunStats
 *
 * @typedef {{ type: string, item: string, amount: number, detail: string }} MilestoneGrant
 */
/**
 * Check and apply milestone grants. Mutates runStats.landGrantsGiven when awarding land bands.
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
  const prevBest = Number.isFinite(runStats.prevBestScore)
    ? Math.max(0, Math.floor(runStats.prevBestScore))
    : 0;
  const best = Math.max(0, Math.floor(data.bestScore ?? 0));
  const prevBand = Math.floor(prevBest / SCORE_BAND);
  const curBand = Math.floor(best / SCORE_BAND);
  if (curBand > prevBand) {
    const birds = curBand - prevBand;
    data = storage.addInventory('rescueBird', birds);
    grants.push({
      type: 'scoreBand',
      item: 'rescueBird',
      amount: birds,
      detail: `Best score band ×${SCORE_BAND}: +${birds} rescue bird${birds > 1 ? 's' : ''}`,
    });
  }
  const solidLands = Math.max(0, Math.floor(runStats.solidLands ?? 0));
  const already = Math.max(0, Math.floor(runStats.landGrantsGiven ?? 0));
  const earned = Math.floor(solidLands / LANDS_PER_BIRD);
  const newLandGrants = earned - already;
  if (newLandGrants > 0) {
    data = storage.addInventory('rescueBird', newLandGrants);
    runStats.landGrantsGiven = already + newLandGrants;
    grants.push({
      type: 'solidLands',
      item: 'rescueBird',
      amount: newLandGrants,
      detail: `Solid lands (every ${LANDS_PER_BIRD}): +${newLandGrants} rescue bird${newLandGrants > 1 ? 's' : ''}`,
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
