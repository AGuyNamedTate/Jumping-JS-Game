/**
 * localStorage save/load for Fantasy Peak Climber.
 */
import { STORAGE_KEY } from './constants.js';
/**
 * @typedef {{ hat: string | null, sword: 'default' | 'golden' }} Equipped
 *
 * @typedef {{
 *   runs: Array<{ score: number, height: number, at: string }>,
 *   bestScore: number,
 *   wallet: number,
 *   unlocked: string[],
 *   equipped: Equipped,
 *   inventory: { rescueBird: number, safetyPlatform: number },
 *   muted: boolean
 * }} SaveData
 */
/** @returns {Equipped} */
function defaultEquipped() {
  return { hat: null, sword: 'default' };
}
/**
 * Normalize legacy `string | null` or partial objects into Equipped.
 * @param {unknown} equipped
 * @returns {Equipped}
 */
function normalizeEquipped(equipped) {
  if (equipped == null) return defaultEquipped();
  // Legacy: single cosmetic id string
  if (typeof equipped === 'string') {
    const next = defaultEquipped();
    if (equipped === 'hat') next.hat = 'hat';
    else if (equipped === 'goldenSword') next.sword = 'golden';
    return next;
  }
  if (typeof equipped === 'object') {
    const obj = /** @type {{ hat?: unknown, sword?: unknown }} */ (equipped);
    return {
      hat: obj.hat === 'hat' ? 'hat' : null,
      sword: obj.sword === 'golden' ? 'golden' : 'default',
    };
  }
  return defaultEquipped();
}
/** @returns {SaveData} */
function defaultSave() {
  return {
    runs: [],
    bestScore: 0,
    wallet: 0,
    unlocked: [],
    equipped: defaultEquipped(),
    inventory: {
      rescueBird: 0,
      safetyPlatform: 0,
    },
    muted: false,
  };
}
/** @returns {SaveData} */
export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return normalize(parsed);
  } catch {
    return defaultSave();
  }
}
/**
 * @param {Partial<SaveData> & { equipped?: unknown }} data
 * @returns {SaveData}
 */
function normalize(data) {
  const base = defaultSave();
  return {
    runs: Array.isArray(data.runs) ? data.runs : base.runs,
    bestScore: Number.isFinite(data.bestScore) ? data.bestScore : base.bestScore,
    wallet: Number.isFinite(data.wallet) ? data.wallet : base.wallet,
    unlocked: Array.isArray(data.unlocked) ? data.unlocked : base.unlocked,
    equipped: normalizeEquipped(data.equipped),
    inventory: {
      rescueBird: Number.isFinite(data.inventory?.rescueBird)
        ? data.inventory.rescueBird
        : base.inventory.rescueBird,
      safetyPlatform: Number.isFinite(data.inventory?.safetyPlatform)
        ? data.inventory.safetyPlatform
        : base.inventory.safetyPlatform,
    },
    muted: Boolean(data.muted),
  };
}
/**
 * @param {SaveData} data
 */
export function save(data) {
  const normalized = normalize(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
/**
 * Record a run and award wallet points equal to score.
 * @param {number} score
 * @param {number} height
 * @returns {SaveData}
 */
export function addRun(score, height) {
  const data = load();
  const scored = Math.max(0, Math.floor(score));
  data.runs.unshift({
    score: scored,
    height: Math.max(0, Math.floor(height)),
    at: new Date().toISOString(),
  });
  // Keep a reasonable history length
  if (data.runs.length > 50) data.runs.length = 50;
  if (scored > data.bestScore) data.bestScore = scored;
  data.wallet = Math.max(0, data.wallet + scored);
  return save(data);
}
/**
 * @param {number} amount
 * @returns {SaveData}
 */
export function addWallet(amount) {
  const data = load();
  data.wallet = Math.max(0, data.wallet + Math.floor(amount));
  return save(data);
}
/**
 * @param {number} amount
 * @returns {{ ok: boolean, data: SaveData }}
 */
export function spendWallet(amount) {
  const data = load();
  const cost = Math.floor(amount);
  if (cost < 0 || data.wallet < cost) {
    return { ok: false, data };
  }
  data.wallet -= cost;
  return { ok: true, data: save(data) };
}
/**
 * @param {string} itemId
 * @returns {SaveData}
 */
export function unlock(itemId) {
  const data = load();
  if (!data.unlocked.includes(itemId)) {
    data.unlocked.push(itemId);
  }
  return save(data);
}
/**
 * Equip a cosmetic by catalog id, or pass null to clear both slots.
 * Known ids: 'hat', 'goldenSword'. Unequip hat with 'hat:off', sword with 'goldenSword:off'.
 * @param {string | null} itemId
 * @returns {SaveData}
 */
export function equip(itemId) {
  const data = load();
  const eq = normalizeEquipped(data.equipped);
  if (itemId === null) {
    data.equipped = defaultEquipped();
    return save(data);
  }
  if (itemId === 'hat:off') {
    eq.hat = null;
    data.equipped = eq;
    return save(data);
  }
  if (itemId === 'goldenSword:off') {
    eq.sword = 'default';
    data.equipped = eq;
    return save(data);
  }
  if (itemId === 'hat' && data.unlocked.includes('hat')) {
    eq.hat = 'hat';
    data.equipped = eq;
  } else if (itemId === 'goldenSword' && data.unlocked.includes('goldenSword')) {
    eq.sword = 'golden';
    data.equipped = eq;
  }
  return save(data);
}
/**
 * @param {'rescueBird'|'safetyPlatform'} key
 * @param {number} [amount=1]
 * @returns {SaveData}
 */
export function addInventory(key, amount = 1) {
  const data = load();
  if (key !== 'rescueBird' && key !== 'safetyPlatform') return data;
  data.inventory[key] = Math.max(0, data.inventory[key] + Math.floor(amount));
  return save(data);
}
/**
 * @param {'rescueBird'|'safetyPlatform'} key
 * @param {number} [amount=1]
 * @returns {{ ok: boolean, data: SaveData }}
 */
export function spendInventory(key, amount = 1) {
  const data = load();
  if (key !== 'rescueBird' && key !== 'safetyPlatform') {
    return { ok: false, data };
  }
  const cost = Math.floor(amount);
  if (cost < 0 || data.inventory[key] < cost) {
    return { ok: false, data };
  }
  data.inventory[key] -= cost;
  return { ok: true, data: save(data) };
}
