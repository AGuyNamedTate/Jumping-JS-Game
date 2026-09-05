/**
 * Store UI — cosmetics + boosts, wallet display, buy/equip flows.
 */
import {
  PRICE_RESCUE_BIRD,
  PRICE_SAFETY_PLATFORM,
} from './constants.js';
import * as storage from './storage.js';
import { CATALOG, getEquippedVisuals, drawPreview } from './cosmetics.js';

let tabsWired = false;
let buyWired = false;

const ROW_STYLE =
  'display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.75rem;';
/**
 * @param {'cosmetics'|'boosts'} tab
 */
function switchStoreTab(tab) {
  const cos = document.getElementById('store-cosmetics');
  const boosts = document.getElementById('store-boosts');
  const tabCos = document.getElementById('tab-cosmetics');
  const tabBoosts = document.getElementById('tab-boosts');
  const showCos = tab === 'cosmetics';
  cos?.classList.toggle('hidden', !showCos);
  boosts?.classList.toggle('hidden', showCos);
  tabCos?.classList.toggle('active', showCos);
  tabBoosts?.classList.toggle('active', !showCos);
  tabCos?.setAttribute('aria-selected', String(showCos));
  tabBoosts?.setAttribute('aria-selected', String(!showCos));
}
function wireTabsOnce() {
  if (tabsWired) return;
  tabsWired = true;
  document
    .getElementById('tab-cosmetics')
    ?.addEventListener('click', () => switchStoreTab('cosmetics'));
  document
    .getElementById('tab-boosts')
    ?.addEventListener('click', () => switchStoreTab('boosts'));
}
function wireBuyDelegationOnce() {
  if (buyWired) return;
  buyWired = true;
  document.getElementById('store-cosmetics')?.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const btn = t.closest?.('[data-action]');
    if (!(btn instanceof HTMLElement)) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (!id || !action) return;
    if (action === 'buy') buyCosmetic(id);
    else if (action === 'equip') toggleEquip(id);
  });
  document.getElementById('store-boosts')?.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const btn = t.closest?.('[data-action="buy-boost"]');
    if (!(btn instanceof HTMLElement)) return;
    const key = btn.getAttribute('data-key');
    if (key === 'rescueBird' || key === 'safetyPlatform') buyBoost(key);
  });
}
/**
 * @param {string} id
 */
function buyCosmetic(id) {
  const item = CATALOG[id];
  if (!item) return;
  const data = storage.load();
  if (data.unlocked.includes(id)) {
    refreshStore();
    return;
  }
  if (data.wallet < item.price) return;
  const spent = storage.spendWallet(item.price);
  if (!spent.ok) return;
  storage.unlock(id);
  storage.equip(id);
  refreshStore();
}
/**
 * @param {string} id
 */
function toggleEquip(id) {
  const data = storage.load();
  if (!data.unlocked.includes(id)) return;
  const visuals = getEquippedVisuals(data);
  if (id === 'hat') {
    storage.equip(visuals.hat ? 'hat:off' : 'hat');
  } else if (id === 'goldenSword') {
    storage.equip(visuals.goldenSword ? 'goldenSword:off' : 'goldenSword');
  }
  refreshStore();
}
/**
 * @param {'rescueBird'|'safetyPlatform'} key
 */
function buyBoost(key) {
  const price = key === 'rescueBird' ? PRICE_RESCUE_BIRD : PRICE_SAFETY_PLATFORM;
  const data = storage.load();
  if (data.wallet < price) return;
  const spent = storage.spendWallet(price);
  if (!spent.ok) return;
  storage.addInventory(key, 1);
  refreshStore();
}
/**
 * @param {number} n
 */
function fmt(n) {
  return n.toLocaleString('en-US');
}
/**
 * @param {import('./storage.js').SaveData} data
 * @param {{ id: string, name: string, price: number }} item
 * @param {boolean} isEquipped
 */
function cosmeticRowHtml(data, item, isEquipped) {
  const owned = data.unlocked.includes(item.id);
  const canAfford = data.wallet >= item.price;
  let actions = '';
  if (!owned) {
    actions = `<button type="button" class="btn btn-primary" data-action="buy" data-id="${item.id}" ${canAfford ? '' : 'disabled'}>Buy (${fmt(item.price)})</button>`;
  } else {
    actions = `<button type="button" class="btn ${isEquipped ? 'btn-primary' : ''}" data-action="equip" data-id="${item.id}">${isEquipped ? 'Equipped' : 'Equip'}</button>`;
  }
  const status = owned ? (isEquipped ? ' · equipped' : ' · owned') : '';
  return `<div class="store-row" data-item="${item.id}" style="${ROW_STYLE}">
    <div class="store-row-info"><strong>${item.name}</strong>${status}<br/>${fmt(item.price)} pts</div>
    <div class="store-row-actions">${actions}</div>
  </div>`;
}
/**
 * Paint a small canvas preview of equipped cosmetics.
 * @param {import('./storage.js').SaveData} data
 */
function renderPreview(data) {
  const panel = document.getElementById('store-cosmetics');
  if (!panel) return;
  let canvas = /** @type {HTMLCanvasElement | null} */ (
    document.getElementById('store-preview')
  );
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'store-preview';
    canvas.width = 72;
    canvas.height = 72;
    canvas.setAttribute('aria-label', 'Cosmetic preview');
    canvas.style.cssText =
      'display:block;margin:0.5rem auto;image-rendering:pixelated;background:rgba(0,0,0,0.35);border:2px solid #3d4048;';
    panel.prepend(canvas);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#152238';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawPreview(ctx, 24, 18, getEquippedVisuals(data));
}
/**
 * Build store panels from current save. Pass root elements or omit to query DOM.
 *
 * @param {{
 *   wallet?: HTMLElement | null,
 *   cosmetics?: HTMLElement | null,
 *   boosts?: HTMLElement | null,
 * } | HTMLElement | null} [roots]
 */
export function renderStore(roots) {
  wireTabsOnce();
  wireBuyDelegationOnce();
  let walletEl;
  let cosEl;
  let boostEl;
  if (roots && typeof roots === 'object' && 'querySelector' in roots) {
    const root = /** @type {HTMLElement} */ (roots);
    walletEl = root.querySelector('#store-wallet') ?? document.getElementById('store-wallet');
    cosEl = root.querySelector('#store-cosmetics') ?? document.getElementById('store-cosmetics');
    boostEl = root.querySelector('#store-boosts') ?? document.getElementById('store-boosts');
  } else {
    const r = /** @type {{ wallet?: HTMLElement | null, cosmetics?: HTMLElement | null, boosts?: HTMLElement | null } | undefined} */ (
      roots ?? undefined
    );
    walletEl = r?.wallet ?? document.getElementById('store-wallet');
    cosEl = r?.cosmetics ?? document.getElementById('store-cosmetics');
    boostEl = r?.boosts ?? document.getElementById('store-boosts');
  }
  const data = storage.load();
  const visuals = getEquippedVisuals(data);
  if (walletEl) walletEl.textContent = `Wallet: ${fmt(data.wallet)}`;
  if (cosEl) {
    // Preserve / recreate preview after innerHTML
    cosEl.innerHTML =
      cosmeticRowHtml(data, CATALOG.hat, visuals.hat) +
      cosmeticRowHtml(data, CATALOG.goldenSword, visuals.goldenSword);
    renderPreview(data);
  }
  if (boostEl) {
    const birdCount = data.inventory.rescueBird;
    const safetyCount = data.inventory.safetyPlatform;
    const canBird = data.wallet >= PRICE_RESCUE_BIRD;
    const canSafety = data.wallet >= PRICE_SAFETY_PLATFORM;
    boostEl.innerHTML = `
      <div class="store-row" data-item="rescueBird" style="${ROW_STYLE}">
        <div class="store-row-info"><strong>Rescue Bird</strong> · owned: ${birdCount}<br/>${fmt(PRICE_RESCUE_BIRD)} pts</div>
        <div class="store-row-actions">
          <button type="button" class="btn btn-primary" data-action="buy-boost" data-key="rescueBird" ${canBird ? '' : 'disabled'}>Buy</button>
        </div>
      </div>
      <div class="store-row" data-item="safetyPlatform" style="${ROW_STYLE}">
        <div class="store-row-info"><strong>Safety Platform</strong> · owned: ${safetyCount}<br/>${fmt(PRICE_SAFETY_PLATFORM)} pts</div>
        <div class="store-row-actions">
          <button type="button" class="btn btn-primary" data-action="buy-boost" data-key="safetyPlatform" ${canSafety ? '' : 'disabled'}>Buy</button>
        </div>
      </div>`;
  }
  switchStoreTab(
    document.getElementById('tab-boosts')?.classList.contains('active')
      ? 'boosts'
      : 'cosmetics',
  );
}
/** Re-read save and redraw store panels. */
export function refreshStore() {
  renderStore();
}
