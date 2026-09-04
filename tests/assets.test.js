import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('assets', () => {
  /** @type {typeof import('../js/assets.js')} */
  let assets;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    assets = await import('../js/assets.js');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('exports IMAGE_PATHS and AUDIO_PATHS', () => {
    expect(Array.isArray(assets.IMAGE_PATHS)).toBe(true);
    expect(assets.AUDIO_PATHS.length).toBeGreaterThan(0);
    expect(assets.AUDIO_PATHS.some((p) => p.includes('jump'))).toBe(true);
    expect(assets.AUDIO_PATHS.some((p) => /bgm\.(ogg|mp3)$/.test(p))).toBe(true);
  });

  describe('loadImages', () => {
    it('resolves successful Image loads keyed by basename', async () => {
      class OkImage {
        constructor() {
          this.onload = null;
          this.onerror = null;
          this._src = '';
        }
        set src(v) {
          this._src = v;
          queueMicrotask(() => this.onload?.());
        }
        get src() {
          return this._src;
        }
      }
      vi.stubGlobal('Image', OkImage);

      const result = await assets.loadImages([
        'assets/sprites/hero.png',
        'assets/platform.webp',
      ]);
      expect(result.hero).toBeInstanceOf(OkImage);
      expect(result.platform).toBeInstanceOf(OkImage);
    });

    it('sets null on Image failure', async () => {
      class FailImage {
        constructor() {
          this.onload = null;
          this.onerror = null;
        }
        set src(_v) {
          queueMicrotask(() => this.onerror?.());
        }
      }
      vi.stubGlobal('Image', FailImage);

      const result = await assets.loadImages(['assets/missing.png']);
      expect(result.missing).toBeNull();
    });

    it('returns empty object for empty path list', async () => {
      const result = await assets.loadImages([]);
      expect(result).toEqual({});
    });
  });

  describe('loadAudio', () => {
    function stubFailingAudio() {
      class FailAudio {
        constructor() {
          this.preload = '';
          this.src = '';
          this.loop = false;
        }
        addEventListener(type, fn) {
          if (type === 'error') {
            queueMicrotask(() => fn());
          }
        }
        removeEventListener() {}
      }
      vi.stubGlobal('Audio', FailAudio);
    }

    function stubOfflineAudioContext() {
      class MockOfflineAudioContext {
        constructor(_ch, length, sampleRate) {
          this.length = length;
          this.sampleRate = sampleRate;
          this.destination = {};
        }
        createOscillator() {
          return {
            type: 'sine',
            frequency: {
              setValueAtTime: vi.fn(),
              exponentialRampToValueAtTime: vi.fn(),
            },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
          };
        }
        createGain() {
          return {
            gain: {
              value: 1,
              setValueAtTime: vi.fn(),
              exponentialRampToValueAtTime: vi.fn(),
            },
            connect: vi.fn(),
          };
        }
        createBuffer(_ch, frames, sampleRate) {
          return {
            sampleRate,
            getChannelData: () => new Float32Array(frames),
          };
        }
        createBufferSource() {
          return { buffer: null, connect: vi.fn(), start: vi.fn() };
        }
        createBiquadFilter() {
          return {
            type: 'lowpass',
            frequency: { value: 0 },
            connect: vi.fn(),
          };
        }
        async startRendering() {
          return {
            sampleRate: this.sampleRate,
            getChannelData: () => new Float32Array(Math.max(1, this.length)),
          };
        }
      }
      vi.stubGlobal('OfflineAudioContext', MockOfflineAudioContext);
    }

    it('fills procedural audio when loads fail (OfflineAudioContext path)', async () => {
      stubFailingAudio();
      stubOfflineAudioContext();

      // After createProceduralAudio, Audio(uri) constructs with data URI
      const RealAudio = globalThis.Audio;
      let uriCount = 0;
      class DualAudio {
        constructor(uri) {
          this.preload = '';
          this.src = uri ?? '';
          this.loop = false;
          if (uri) uriCount += 1;
        }
        addEventListener(type, fn) {
          if (type === 'error') queueMicrotask(() => fn());
        }
        removeEventListener() {}
      }
      vi.stubGlobal('Audio', DualAudio);

      const result = await assets.loadAudio([
        'assets/audio/jump.wav',
        'assets/audio/land.wav',
      ]);

      expect(result.jump).toBeTruthy();
      expect(result.land).toBeTruthy();
      expect(result.break).toBeTruthy();
      expect(result.fall).toBeTruthy();
      expect(result.highscore).toBeTruthy();
      expect(result.rescue).toBeTruthy();
      expect(result.bgm).toBeTruthy();
      expect(result.bgm.loop).toBe(true);
      expect(uriCount).toBeGreaterThan(0);
      void RealAudio;
    });

    it('uses AUDIO_PATHS when paths argument is empty', async () => {
      stubFailingAudio();
      stubOfflineAudioContext();
      class DualAudio {
        constructor(uri) {
          this.preload = '';
          this.src = uri ?? '';
          this.loop = false;
        }
        addEventListener(type, fn) {
          if (type === 'error') queueMicrotask(() => fn());
        }
        removeEventListener() {}
      }
      vi.stubGlobal('Audio', DualAudio);

      const result = await assets.loadAudio([]);
      for (const key of ['jump', 'land', 'break', 'fall', 'highscore', 'rescue', 'bgm']) {
        expect(result[key]).toBeTruthy();
      }
    });

    it('succeeds when Audio fires canplaythrough', async () => {
      class OkAudio {
        constructor() {
          this.preload = '';
          this._src = '';
          this.loop = false;
          /** @type {Map<string, Function[]>} */
          this._listeners = new Map();
        }
        addEventListener(type, fn) {
          if (!this._listeners.has(type)) this._listeners.set(type, []);
          this._listeners.get(type).push(fn);
        }
        removeEventListener(type, fn) {
          const list = this._listeners.get(type);
          if (!list) return;
          const i = list.indexOf(fn);
          if (i >= 0) list.splice(i, 1);
        }
        set src(v) {
          this._src = v;
          queueMicrotask(() => {
            for (const fn of this._listeners.get('canplaythrough') ?? []) fn();
          });
        }
        get src() {
          return this._src;
        }
      }
      vi.stubGlobal('Audio', OkAudio);
      stubOfflineAudioContext();

      const result = await assets.loadAudio(['assets/audio/jump.wav']);
      expect(result.jump).toBeInstanceOf(OkAudio);
    });

    it('enables loop on successfully loaded bgm file', async () => {
      class OkAudio {
        constructor() {
          this.preload = '';
          this._src = '';
          this.loop = false;
          /** @type {Map<string, Function[]>} */
          this._listeners = new Map();
        }
        addEventListener(type, fn) {
          if (!this._listeners.has(type)) this._listeners.set(type, []);
          this._listeners.get(type).push(fn);
        }
        removeEventListener(type, fn) {
          const list = this._listeners.get(type);
          if (!list) return;
          const i = list.indexOf(fn);
          if (i >= 0) list.splice(i, 1);
        }
        set src(v) {
          this._src = v;
          queueMicrotask(() => {
            for (const fn of this._listeners.get('canplaythrough') ?? []) fn();
          });
        }
        get src() {
          return this._src;
        }
      }
      vi.stubGlobal('Audio', OkAudio);
      stubOfflineAudioContext();

      const result = await assets.loadAudio(['assets/audio/bgm.ogg']);
      expect(result.bgm).toBeInstanceOf(OkAudio);
      expect(result.bgm.loop).toBe(true);
      expect(String(result.bgm.src)).toContain('bgm.ogg');
    });

    it('falls back to PCM beep when OfflineAudioContext is unavailable', async () => {
      stubFailingAudio();
      vi.stubGlobal('OfflineAudioContext', undefined);
      // Ensure webkit alias also missing
      if (typeof window !== 'undefined') {
        // @ts-ignore
        delete window.webkitOfflineAudioContext;
      }

      class DualAudio {
        constructor(uri) {
          this.preload = '';
          this.src = uri ?? '';
          this.loop = false;
        }
        addEventListener(type, fn) {
          if (type === 'error') queueMicrotask(() => fn());
        }
        removeEventListener() {}
      }
      vi.stubGlobal('Audio', DualAudio);

      const result = await assets.loadAudio(['assets/audio/jump.wav']);
      expect(result.jump).toBeTruthy();
      expect(String(result.jump.src)).toMatch(/^data:audio\/wav;base64,/);
    });

    it('uses webkitOfflineAudioContext when OfflineAudioContext is missing', async () => {
      stubFailingAudio();
      vi.stubGlobal('OfflineAudioContext', undefined);

      class MockWebkit {
        constructor(_ch, length, sampleRate) {
          this.length = length;
          this.sampleRate = sampleRate;
          this.destination = {};
        }
        createOscillator() {
          return {
            type: 'sine',
            frequency: {
              setValueAtTime: vi.fn(),
              exponentialRampToValueAtTime: vi.fn(),
            },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
          };
        }
        createGain() {
          return {
            gain: {
              value: 1,
              setValueAtTime: vi.fn(),
              exponentialRampToValueAtTime: vi.fn(),
            },
            connect: vi.fn(),
          };
        }
        createBuffer(_ch, frames, sampleRate) {
          return {
            sampleRate,
            getChannelData: () => new Float32Array(frames),
          };
        }
        createBufferSource() {
          return { buffer: null, connect: vi.fn(), start: vi.fn() };
        }
        createBiquadFilter() {
          return { type: 'lowpass', frequency: { value: 0 }, connect: vi.fn() };
        }
        async startRendering() {
          return {
            sampleRate: this.sampleRate,
            getChannelData: () => new Float32Array(Math.max(1, this.length)),
          };
        }
      }
      window.webkitOfflineAudioContext = MockWebkit;

      class DualAudio {
        constructor(uri) {
          this.preload = '';
          this.src = uri ?? '';
          this.loop = false;
        }
        addEventListener(type, fn) {
          if (type === 'error') queueMicrotask(() => fn());
        }
        removeEventListener() {}
      }
      vi.stubGlobal('Audio', DualAudio);

      const result = await assets.loadAudio(['assets/audio/highscore.wav']);
      expect(result.highscore).toBeTruthy();
      expect(result.rescue).toBeTruthy();
    });

    it('rejects audio load on timeout and still fills procedural', async () => {
      class HangAudio {
        constructor() {
          this.preload = '';
          this.src = '';
        }
        addEventListener() {}
        removeEventListener() {}
      }
      vi.stubGlobal('Audio', HangAudio);
      stubOfflineAudioContext();

      // After hang rejects, procedural uses DualAudio with URI
      let phase = 'hang';
      class PhaseAudio {
        constructor(uri) {
          this.preload = '';
          this.src = uri ?? '';
          this.loop = false;
        }
        addEventListener() {}
        removeEventListener() {}
      }

      // First loads hang; procedural constructs with uri
      vi.stubGlobal(
        'Audio',
        class {
          constructor(uri) {
            if (uri) return new PhaseAudio(uri);
            return new HangAudio();
          }
          addEventListener() {}
          removeEventListener() {}
        },
      );

      const promise = assets.loadAudio(['assets/audio/jump.wav']);
      await vi.advanceTimersByTimeAsync(2100);
      const result = await promise;
      expect(result.jump).toBeTruthy();
      void phase;
    });

    it('returns null procedural clips when Audio construction throws', async () => {
      stubOfflineAudioContext();
      let calls = 0;
      vi.stubGlobal(
        'Audio',
        class {
          constructor(uri) {
            calls += 1;
            if (uri) throw new Error('no audio');
            this.preload = '';
            this.src = '';
          }
          addEventListener(type, fn) {
            if (type === 'error') queueMicrotask(() => fn());
          }
          removeEventListener() {}
        },
      );

      const result = await assets.loadAudio(['assets/audio/jump.wav']);
      // createProceduralAudio catches and returns null; gaps stay null after fill attempt
      expect(result.jump).toBeNull();
      expect(calls).toBeGreaterThan(0);
    });

    it('uses jump spec for unknown procedural names via gap fill only', async () => {
      // Cover specs[name] ?? specs.jump by requesting a weird path that becomes an unknown key
      // then needed keys still get filled with known specs.
      stubFailingAudio();
      stubOfflineAudioContext();
      class DualAudio {
        constructor(uri) {
          this.preload = '';
          this.src = uri ?? '';
          this.loop = false;
        }
        addEventListener(type, fn) {
          if (type === 'error') queueMicrotask(() => fn());
        }
        removeEventListener() {}
      }
      vi.stubGlobal('Audio', DualAudio);

      const result = await assets.loadAudio(['assets/audio/custom_fx.wav']);
      expect(result.custom_fx).toBeNull();
      expect(result.jump).toBeTruthy();
    });
  });
});
