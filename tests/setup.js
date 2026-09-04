/**
 * Shared Vitest setup: DOM shell matching index.html + localStorage reset.
 */
import { beforeEach, afterEach, vi } from 'vitest';

/**
 * Node 22+ may expose a broken localStorage (--localstorage-file without path).
 * Always install an in-memory Storage for happy-dom tests.
 */
const memoryStore = new Map();
const memoryLocalStorage = {
  get length() {
    return memoryStore.size;
  },
  clear() {
    memoryStore.clear();
  },
  getItem(key) {
    const k = String(key);
    return memoryStore.has(k) ? memoryStore.get(k) : null;
  },
  setItem(key, value) {
    memoryStore.set(String(key), String(value));
  },
  removeItem(key) {
    memoryStore.delete(String(key));
  },
  key(index) {
    return [...memoryStore.keys()][index] ?? null;
  },
};

export function installMemoryLocalStorage() {
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: memoryLocalStorage,
    });
  } catch {
    globalThis.localStorage = memoryLocalStorage;
  }
  if (typeof window !== 'undefined') {
    try {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: memoryLocalStorage,
      });
    } catch {
      /* ignore */
    }
  }
}

installMemoryLocalStorage();

/**
 * happy-dom often returns null from canvas.getContext('2d').
 * @returns {CanvasRenderingContext2D}
 */
export function createMock2dContext() {
  const gradient = { addColorStop: vi.fn() };
  /** @type {any} */
  const ctx = {
    fillStyle: '#000',
    strokeStyle: '#000',
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    createLinearGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    fillText: vi.fn(),
  };
  return ctx;
}

/**
 * @param {HTMLCanvasElement|null} canvas
 * @returns {CanvasRenderingContext2D}
 */
export function stubCanvas2d(canvas) {
  const ctx = createMock2dContext();
  if (canvas) {
    canvas.getContext = vi.fn((type) => (type === '2d' ? ctx : null));
  }
  return ctx;
}

/** Minimal DOM matching index.html overlays used by ui/game/store/continue */
export function mountAppShell(doc = document) {
  doc.body.innerHTML = `
    <div id="app">
      <div id="stage" class="stage">
        <canvas id="game-canvas" width="360" height="640"></canvas>
        <section id="screen-main" class="screen overlay"></section>
        <section id="screen-history" class="screen overlay hidden">
          <div id="history-list" class="history-list"></div>
        </section>
        <section id="screen-store" class="screen overlay hidden">
          <button type="button" id="tab-cosmetics" class="btn tab active" role="tab" aria-selected="true"></button>
          <button type="button" id="tab-boosts" class="btn tab" role="tab" aria-selected="false"></button>
          <div id="store-cosmetics" class="store-panel"></div>
          <div id="store-boosts" class="store-panel hidden"></div>
          <p id="store-wallet" class="wallet-display">Wallet: 0</p>
        </section>
        <section id="screen-gameover" class="screen overlay hidden">
          <p id="gameover-score" class="result-line">Score: 0</p>
          <p id="gameover-height" class="result-line">Height: 0</p>
        </section>
        <section id="screen-continue" class="screen overlay hidden">
          <p id="continue-timer" class="continue-timer">6</p>
          <button type="button" id="btn-use-bird" class="btn"></button>
          <button type="button" id="btn-use-safety" class="btn"></button>
          <button type="button" id="btn-let-go" class="btn"></button>
        </section>
        <div id="hud" class="hud hidden">
          <div id="hud-highscore" class="hud-highscore">Best: 0</div>
          <div id="hud-score" class="hud-score">0</div>
          <div id="hud-inventory" class="hud-inventory">
            <span id="hud-bird" class="hud-item">Bird: 0</span>
            <span id="hud-safety" class="hud-item">Safety: 0</span>
          </div>
          <div id="charge-bar-wrap" class="charge-bar-wrap" aria-hidden="true">
            <div id="charge-bar" class="charge-bar"></div>
          </div>
          <button type="button" id="btn-mute-hud" class="btn btn-mute" aria-pressed="false">Mute</button>
        </div>
        <button type="button" id="btn-play"></button>
        <button type="button" id="btn-history"></button>
        <button type="button" id="btn-store"></button>
        <button type="button" id="btn-mute" aria-pressed="false">Mute</button>
        <button type="button" id="btn-history-back"></button>
        <button type="button" id="btn-store-back"></button>
        <button type="button" id="btn-play-again"></button>
        <button type="button" id="btn-gameover-menu"></button>
      </div>
    </div>
  `;
  const canvas = /** @type {HTMLCanvasElement} */ (doc.getElementById('game-canvas'));
  stubCanvas2d(canvas);
  return canvas;
}

beforeEach(() => {
  installMemoryLocalStorage();
  localStorage.clear();
  mountAppShell();
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb) => {
      const id = setTimeout(() => cb(performance.now()), 16);
      return id;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id) => clearTimeout(id)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  installMemoryLocalStorage();
  localStorage.clear();
  document.body.innerHTML = '';
});
