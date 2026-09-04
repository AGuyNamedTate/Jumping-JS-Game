import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountAppShell } from './setup.js';

describe('main boot', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('../js/assets.js');
    vi.doUnmock('../js/game.js');
    vi.restoreAllMocks();
  });

  it('boots successfully: loads assets, inits game, starts loop', async () => {
    mountAppShell();
    const loadImages = vi.fn(async () => ({ hero: null }));
    const loadAudio = vi.fn(async () => ({ jump: null }));
    const init = vi.fn();
    const goMainMenu = vi.fn();
    const startLoop = vi.fn();

    vi.doMock('../js/assets.js', () => ({
      loadImages,
      loadAudio,
      IMAGE_PATHS: ['x.png'],
      AUDIO_PATHS: ['y.wav'],
    }));
    vi.doMock('../js/game.js', () => ({
      init,
      goMainMenu,
      startLoop,
    }));

    await import('../js/main.js');
    // allow async boot to settle
    await vi.waitFor(() => {
      expect(init).toHaveBeenCalled();
    });

    expect(loadImages).toHaveBeenCalledWith(['x.png']);
    expect(loadAudio).toHaveBeenCalledWith(['y.wav']);
    expect(init).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({ images: { hero: null }, audio: { jump: null } }),
    );
    expect(goMainMenu).toHaveBeenCalled();
    expect(startLoop).toHaveBeenCalled();
  });

  it('logs error when #game-canvas is missing', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.doMock('../js/assets.js', () => ({
      loadImages: vi.fn(async () => ({})),
      loadAudio: vi.fn(async () => ({})),
      IMAGE_PATHS: [],
      AUDIO_PATHS: [],
    }));
    vi.doMock('../js/game.js', () => ({
      init: vi.fn(),
      goMainMenu: vi.fn(),
      startLoop: vi.fn(),
    }));

    await import('../js/main.js');
    await vi.waitFor(() => {
      expect(err).toHaveBeenCalledWith('Missing #game-canvas');
    });
  });

  it('logs boot failure when loadImages rejects', async () => {
    mountAppShell();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.doMock('../js/assets.js', () => ({
      loadImages: vi.fn(async () => {
        throw new Error('image boom');
      }),
      loadAudio: vi.fn(async () => ({})),
      IMAGE_PATHS: [],
      AUDIO_PATHS: [],
    }));
    vi.doMock('../js/game.js', () => ({
      init: vi.fn(),
      goMainMenu: vi.fn(),
      startLoop: vi.fn(),
    }));

    await import('../js/main.js');
    await vi.waitFor(() => {
      expect(err).toHaveBeenCalledWith('Boot failed:', expect.any(Error));
    });
  });
});
