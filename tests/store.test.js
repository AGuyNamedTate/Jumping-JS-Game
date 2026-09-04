import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountAppShell } from './setup.js';
import {
  STORAGE_KEY,
  PRICE_HAT,
  PRICE_GOLDEN_SWORD,
  PRICE_RESCUE_BIRD,
  PRICE_SAFETY_PLATFORM,
} from '../js/constants.js';

/**
 * Store module keeps tabsWired/buyWired true after first import.
 * Reset modules + remount DOM so each test gets fresh listeners.
 */
async function loadStore() {
  return import('../js/store.js');
}

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

describe('store', () => {
  /** @type {typeof import('../js/store.js')} */
  let store;

  beforeEach(async () => {
    vi.doUnmock('../js/storage.js');
    vi.resetModules();
    localStorage.clear();
    mountAppShell();
    store = await loadStore();
  });

  it('renderStore updates wallet text and cosmetic / boost rows', () => {
    seed({
      wallet: 1234,
      unlocked: ['hat'],
      equipped: { hat: 'hat', sword: 'default' },
      inventory: { rescueBird: 2, safetyPlatform: 3 },
    });
    store.renderStore();
    expect(document.getElementById('store-wallet')?.textContent).toBe(
      'Wallet: 1,234',
    );
    expect(document.querySelector('[data-item="hat"]')?.textContent).toMatch(
      /Adventurer Hat/,
    );
    expect(document.querySelector('[data-item="hat"]')?.textContent).toMatch(
      /equipped/,
    );
    expect(
      document.querySelector('[data-item="goldenSword"]')?.textContent,
    ).toMatch(/Golden Sword/);
    expect(
      document.querySelector('[data-item="rescueBird"]')?.textContent,
    ).toMatch(/owned: 2/);
    expect(
      document.querySelector('[data-item="safetyPlatform"]')?.textContent,
    ).toMatch(/owned: 3/);
  });

  it('renderStore accepts an HTMLElement roots form', () => {
    seed({ wallet: 50 });
    const app = document.getElementById('app');
    store.renderStore(app);
    expect(document.getElementById('store-wallet')?.textContent).toBe(
      'Wallet: 50',
    );
    expect(document.querySelectorAll('.store-row').length).toBeGreaterThan(0);
  });

  it('renderStore accepts an object roots form', () => {
    seed({ wallet: 77 });
    const wallet = document.getElementById('store-wallet');
    const cosmetics = document.getElementById('store-cosmetics');
    const boosts = document.getElementById('store-boosts');
    store.renderStore({ wallet, cosmetics, boosts });
    expect(wallet?.textContent).toBe('Wallet: 77');
    expect(cosmetics?.querySelector('[data-item="hat"]')).toBeTruthy();
    expect(boosts?.querySelector('[data-item="rescueBird"]')).toBeTruthy();
  });

  it('renderStore works with null / omitted roots', () => {
    seed({ wallet: 1 });
    store.renderStore(null);
    expect(document.getElementById('store-wallet')?.textContent).toBe(
      'Wallet: 1',
    );
    store.renderStore();
    expect(document.getElementById('store-wallet')?.textContent).toBe(
      'Wallet: 1',
    );
  });

  it('creates a preview canvas on render and paints when getContext works', () => {
    seed({
      unlocked: ['hat'],
      equipped: { hat: 'hat', sword: 'default' },
    });
    const mockCtx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    };
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
      const el = originalCreate(tag, options);
      if (tag === 'canvas') {
        vi.spyOn(el, 'getContext').mockReturnValue(/** @type {any} */ (mockCtx));
      }
      return el;
    });
    store.renderStore();
    const canvas = document.getElementById('store-preview');
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas?.getAttribute('aria-label')).toBe('Cosmetic preview');
    expect(/** @type {HTMLCanvasElement} */ (canvas).width).toBe(72);
    expect(/** @type {HTMLCanvasElement} */ (canvas).height).toBe(72);
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 72, 72);
    expect(mockCtx.fillRect).toHaveBeenCalled();
    // Re-render reuses existing canvas (still mocked)
    store.renderStore();
    expect(document.querySelectorAll('#store-preview')).toHaveLength(1);
  });

  it('skips preview paint when getContext returns null', () => {
    seed({});
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
      const el = originalCreate(tag, options);
      if (tag === 'canvas') {
        vi.spyOn(el, 'getContext').mockReturnValue(null);
      }
      return el;
    });
    store.renderStore();
    expect(document.getElementById('store-preview')).toBeTruthy();
  });

  it('switches tabs between cosmetics and boosts', () => {
    store.renderStore();
    const tabBoosts = document.getElementById('tab-boosts');
    const tabCos = document.getElementById('tab-cosmetics');
    const cos = document.getElementById('store-cosmetics');
    const boosts = document.getElementById('store-boosts');

    tabBoosts?.click();
    expect(boosts?.classList.contains('hidden')).toBe(false);
    expect(cos?.classList.contains('hidden')).toBe(true);
    expect(tabBoosts?.classList.contains('active')).toBe(true);
    expect(tabCos?.getAttribute('aria-selected')).toBe('false');
    expect(tabBoosts?.getAttribute('aria-selected')).toBe('true');

    tabCos?.click();
    expect(cos?.classList.contains('hidden')).toBe(false);
    expect(boosts?.classList.contains('hidden')).toBe(true);
    expect(tabCos?.classList.contains('active')).toBe(true);
  });

  it('preserves active boosts tab across refreshStore', () => {
    store.renderStore();
    document.getElementById('tab-boosts')?.click();
    store.refreshStore();
    expect(
      document.getElementById('store-boosts')?.classList.contains('hidden'),
    ).toBe(false);
    expect(
      document.getElementById('tab-boosts')?.classList.contains('active'),
    ).toBe(true);
  });

  it('buys a cosmetic when affordable', () => {
    seed({ wallet: PRICE_HAT });
    store.renderStore();
    const buyBtn = document.querySelector(
      '[data-action="buy"][data-id="hat"]',
    );
    expect(buyBtn).toBeTruthy();
    expect(buyBtn?.hasAttribute('disabled')).toBe(false);
    buyBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(raw.unlocked).toContain('hat');
    expect(raw.wallet).toBe(0);
    expect(raw.equipped.hat).toBe('hat');
    expect(
      document.querySelector('[data-action="equip"][data-id="hat"]')?.textContent,
    ).toMatch(/Equipped/);
  });

  it('does not buy when unaffordable (disabled button still gated in handler)', () => {
    seed({ wallet: PRICE_HAT - 1 });
    store.renderStore();
    const buyBtn = document.querySelector(
      '[data-action="buy"][data-id="hat"]',
    );
    expect(buyBtn?.hasAttribute('disabled')).toBe(true);
    // Force click even if disabled — handler checks wallet
    buyBtn?.removeAttribute('disabled');
    buyBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(raw.unlocked || []).not.toContain('hat');
    expect(raw.wallet).toBe(PRICE_HAT - 1);
  });

  it('does not re-buy an already owned cosmetic', () => {
    seed({
      wallet: 10_000,
      unlocked: ['hat'],
      equipped: { hat: 'hat', sword: 'default' },
    });
    store.renderStore();
    expect(document.querySelector('[data-action="buy"][data-id="hat"]')).toBeNull();
    // Simulate stale buy click via delegation path with owned id
    const actions = document.querySelector(
      '[data-item="hat"] .store-row-actions',
    );
    const ghost = document.createElement('button');
    ghost.setAttribute('data-action', 'buy');
    ghost.setAttribute('data-id', 'hat');
    actions?.appendChild(ghost);
    ghost.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(raw.wallet).toBe(10_000);
  });

  it('toggles equip / unequip for hat', () => {
    seed({
      wallet: 0,
      unlocked: ['hat'],
      equipped: { hat: null, sword: 'default' },
    });
    store.renderStore();
    const equipBtn = document.querySelector(
      '[data-action="equip"][data-id="hat"]',
    );
    expect(equipBtn?.textContent).toBe('Equip');
    equipBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').equipped.hat,
    ).toBe('hat');
    expect(
      document.querySelector('[data-action="equip"][data-id="hat"]')?.textContent,
    ).toBe('Equipped');

    document
      .querySelector('[data-action="equip"][data-id="hat"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').equipped.hat,
    ).toBeNull();
  });

  it('toggles equip / unequip for goldenSword', () => {
    seed({
      wallet: 0,
      unlocked: ['goldenSword'],
      equipped: { hat: null, sword: 'default' },
    });
    store.renderStore();
    document
      .querySelector('[data-action="equip"][data-id="goldenSword"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').equipped.sword,
    ).toBe('golden');

    document
      .querySelector('[data-action="equip"][data-id="goldenSword"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').equipped.sword,
    ).toBe('default');
  });

  it('ignores equip for locked items', () => {
    seed({ wallet: 0, unlocked: [], equipped: { hat: null, sword: 'default' } });
    store.renderStore();
    const actions = document.querySelector(
      '[data-item="hat"] .store-row-actions',
    );
    const ghost = document.createElement('button');
    ghost.setAttribute('data-action', 'equip');
    ghost.setAttribute('data-id', 'hat');
    actions?.appendChild(ghost);
    ghost.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').equipped?.hat ?? null,
    ).toBeNull();
  });

  it('buys rescueBird boost when affordable', () => {
    seed({ wallet: PRICE_RESCUE_BIRD });
    store.renderStore();
    document
      .querySelector('[data-action="buy-boost"][data-key="rescueBird"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(raw.wallet).toBe(0);
    expect(raw.inventory.rescueBird).toBe(1);
    expect(
      document.querySelector('[data-item="rescueBird"]')?.textContent,
    ).toMatch(/owned: 1/);
  });

  it('buys safetyPlatform boost when affordable', () => {
    seed({ wallet: PRICE_SAFETY_PLATFORM });
    store.renderStore();
    document
      .querySelector('[data-action="buy-boost"][data-key="safetyPlatform"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(raw.wallet).toBe(0);
    expect(raw.inventory.safetyPlatform).toBe(1);
  });

  it('does not buy boosts when unaffordable', () => {
    seed({ wallet: 1 });
    store.renderStore();
    const birdBtn = document.querySelector(
      '[data-action="buy-boost"][data-key="rescueBird"]',
    );
    expect(birdBtn?.hasAttribute('disabled')).toBe(true);
    birdBtn?.removeAttribute('disabled');
    birdBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').inventory.rescueBird,
    ).toBe(0);
  });

  it('refreshStore re-reads save and redraws wallet', () => {
    seed({ wallet: 10 });
    store.renderStore();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'),
        wallet: 999,
      }),
    );
    store.refreshStore();
    expect(document.getElementById('store-wallet')?.textContent).toBe(
      'Wallet: 999',
    );
  });

  it('shows disabled buy for expensive goldenSword when wallet is short', () => {
    seed({ wallet: PRICE_GOLDEN_SWORD - 1 });
    store.renderStore();
    const btn = document.querySelector(
      '[data-action="buy"][data-id="goldenSword"]',
    );
    expect(btn?.hasAttribute('disabled')).toBe(true);
    expect(
      document.querySelector('[data-item="goldenSword"]')?.textContent,
    ).toMatch(/1,000,000/);
  });

  it('ignores clicks without data-action or data-id', () => {
    seed({ wallet: 10_000 });
    store.renderStore();
    const panel = document.getElementById('store-cosmetics');
    const stray = document.createElement('button');
    panel?.appendChild(stray);
    stray.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const noId = document.createElement('button');
    noId.setAttribute('data-action', 'buy');
    panel?.appendChild(noId);
    noId.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').wallet,
    ).toBe(10_000);
  });

  it('ignores boost panel clicks that are not buy-boost', () => {
    seed({ wallet: 10_000 });
    store.renderStore();
    document
      .getElementById('store-boosts')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').wallet,
    ).toBe(10_000);
  });

  it('skips renderPreview when #store-cosmetics is not in the document', () => {
    seed({ wallet: 8 });
    const detachedCosmetics = document.createElement('div');
    const wallet = document.getElementById('store-wallet');
    const boosts = document.getElementById('store-boosts');
    document.getElementById('store-cosmetics')?.remove();
    store.renderStore({ wallet, cosmetics: detachedCosmetics, boosts });
    expect(detachedCosmetics.querySelector('[data-item="hat"]')).toBeTruthy();
    expect(document.getElementById('store-preview')).toBeNull();
  });

  it('bails when spendWallet fails after cosmetic affordability check', async () => {
    vi.resetModules();
    localStorage.clear();
    mountAppShell();
    seed({ wallet: PRICE_HAT });
    vi.doMock('../js/storage.js', async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        spendWallet: () => ({ ok: false, data: actual.load() }),
      };
    });
    const fresh = await import('../js/store.js');
    fresh.renderStore();
    document
      .querySelector('[data-action="buy"][data-id="hat"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(raw.unlocked || []).not.toContain('hat');
    expect(raw.wallet).toBe(PRICE_HAT);
    vi.doUnmock('../js/storage.js');
  });

  it('bails when spendWallet fails after boost affordability check', async () => {
    vi.resetModules();
    localStorage.clear();
    mountAppShell();
    seed({ wallet: PRICE_RESCUE_BIRD });
    vi.doMock('../js/storage.js', async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        spendWallet: () => ({ ok: false, data: actual.load() }),
      };
    });
    const fresh = await import('../js/store.js');
    fresh.renderStore();
    document
      .querySelector('[data-action="buy-boost"][data-key="rescueBird"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(raw.inventory?.rescueBird ?? 0).toBe(0);
    expect(raw.wallet).toBe(PRICE_RESCUE_BIRD);
    vi.doUnmock('../js/storage.js');
  });

  it('ignores unknown boost keys on buy-boost clicks', () => {
    seed({ wallet: 10_000 });
    store.renderStore();
    const panel = document.getElementById('store-boosts');
    const ghost = document.createElement('button');
    ghost.setAttribute('data-action', 'buy-boost');
    ghost.setAttribute('data-key', 'mystery');
    panel?.appendChild(ghost);
    ghost.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').wallet,
    ).toBe(10_000);
  });

  it('ignores buy of unknown cosmetic id', () => {
    seed({ wallet: 10_000 });
    store.renderStore();
    const panel = document.getElementById('store-cosmetics');
    const ghost = document.createElement('button');
    ghost.setAttribute('data-action', 'buy');
    ghost.setAttribute('data-id', 'cape');
    panel?.appendChild(ghost);
    ghost.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').wallet,
    ).toBe(10_000);
  });

  it('falls back to document.getElementById when HTMLElement root lacks store nodes', () => {
    seed({ wallet: 33 });
    const emptyRoot = document.createElement('div');
    store.renderStore(emptyRoot);
    expect(document.getElementById('store-wallet')?.textContent).toBe(
      'Wallet: 33',
    );
  });

  it('renderStore no-ops panel updates when wallet/cosmetics/boosts are missing', () => {
    seed({ wallet: 5 });
    document.getElementById('store-wallet')?.remove();
    document.getElementById('store-cosmetics')?.remove();
    document.getElementById('store-boosts')?.remove();
    expect(() => store.renderStore()).not.toThrow();
  });
});
