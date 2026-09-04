import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VOLUME_MASTER,
  VOLUME_MUSIC,
  VOLUME_SFX,
} from '../js/constants.js';
import {
  init,
  setMuted,
  isMuted,
  playBgm,
  stopBgm,
  playSfx,
} from '../js/audio.js';

function createMockAudio() {
  return {
    volume: 1,
    muted: false,
    paused: true,
    loop: false,
    currentTime: 0,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(function pause() {
      this.paused = true;
    }),
  };
}

function createAudioContextMock() {
  const destination = {};
  const makeGain = () => {
    const node = {
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    return node;
  };
  const makeOsc = () => ({
    type: 'sine',
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });
  const makeBuffer = (channels, length, sampleRate) => ({
    sampleRate,
    getChannelData: vi.fn(() => new Float32Array(length)),
  });
  const makeBufferSource = () => ({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });
  const makeFilter = () => ({
    type: 'lowpass',
    frequency: { value: 0 },
    connect: vi.fn(),
  });

  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    destination,
    resume: vi.fn(() => Promise.resolve()),
    createGain: vi.fn(makeGain),
    createOscillator: vi.fn(makeOsc),
    createBuffer: vi.fn(makeBuffer),
    createBufferSource: vi.fn(makeBufferSource),
    createBiquadFilter: vi.fn(makeFilter),
  };
}

describe('audio', () => {
  // Module caches AudioContext in synthCtx — reuse one mock for the suite.
  const ctx = createAudioContextMock();

  beforeEach(() => {
    ctx.state = 'running';
    ctx.createGain.mockClear();
    ctx.createOscillator.mockClear();
    ctx.createBuffer.mockClear();
    ctx.createBufferSource.mockClear();
    ctx.createBiquadFilter.mockClear();
    ctx.resume.mockClear();
    vi.stubGlobal('AudioContext', vi.fn(() => ctx));
    vi.stubGlobal('webkitAudioContext', undefined);
    // clear any prior module mute/map by re-init
    init({}, false);
  });

  afterEach(() => {
    setMuted(false);
  });

  it('init applies volumes for sfx vs bgm/music/theme keys', () => {
    const jump = createMockAudio();
    const bgm = createMockAudio();
    const music = createMockAudio();
    const theme = createMockAudio();
    init({ jump, bgm, music, theme, land: null }, false);

    const sfxVol = VOLUME_MASTER * VOLUME_SFX;
    const musicVol = VOLUME_MASTER * VOLUME_MUSIC;
    expect(jump.volume).toBeCloseTo(sfxVol);
    expect(bgm.volume).toBeCloseTo(musicVol);
    expect(music.volume).toBeCloseTo(musicVol);
    expect(theme.volume).toBeCloseTo(musicVol);
    expect(jump.muted).toBe(false);
    expect(isMuted()).toBe(false);
  });

  it('setMuted zeroes volumes and reports muted', () => {
    const jump = createMockAudio();
    const bgm = createMockAudio();
    bgm.paused = false;
    init({ jump, bgm }, false);
    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(jump.volume).toBe(0);
    expect(bgm.volume).toBe(0);
    expect(jump.muted).toBe(true);
    expect(bgm.muted).toBe(true);

    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(jump.volume).toBeCloseTo(VOLUME_MASTER * VOLUME_SFX);
    expect(bgm.volume).toBeCloseTo(VOLUME_MASTER * VOLUME_MUSIC);
  });

  describe('playBgm', () => {
    it('plays looping bgm element and swallows play rejection', async () => {
      const bgm = createMockAudio();
      bgm.play = vi.fn(() => Promise.reject(new Error('autoplay')));
      init({ bgm }, false);
      playBgm();
      expect(bgm.loop).toBe(true);
      expect(bgm.volume).toBeCloseTo(VOLUME_MASTER * VOLUME_MUSIC);
      expect(bgm.muted).toBe(false);
      expect(bgm.play).toHaveBeenCalled();
      await Promise.resolve();
    });

    it('plays muted bgm silently when muted', () => {
      const bgm = createMockAudio();
      init({ bgm }, true);
      playBgm();
      expect(bgm.volume).toBe(0);
      expect(bgm.muted).toBe(true);
      expect(bgm.play).toHaveBeenCalled();
    });

    it('falls back to synth bgm when no bgm asset', () => {
      init({}, false);
      playBgm();
      expect(ctx.createOscillator).toHaveBeenCalled();
      expect(ctx.createGain).toHaveBeenCalled();
    });

    it('does not synth bgm when muted and no element', () => {
      init({}, true);
      playBgm();
      expect(ctx.createOscillator).not.toHaveBeenCalled();
    });

    it('picks music then theme as bgm aliases', () => {
      const music = createMockAudio();
      init({ music }, false);
      playBgm();
      expect(music.play).toHaveBeenCalled();

      const theme = createMockAudio();
      init({ theme }, false);
      playBgm();
      expect(theme.play).toHaveBeenCalled();
    });
  });

  describe('stopBgm', () => {
    it('pauses and seeks to start', () => {
      const bgm = createMockAudio();
      bgm.paused = false;
      bgm.currentTime = 12;
      init({ bgm }, false);
      playBgm();
      stopBgm();
      expect(bgm.pause).toHaveBeenCalled();
      expect(bgm.currentTime).toBe(0);
    });

    it('no-ops without bgm', () => {
      init({}, false);
      expect(() => stopBgm()).not.toThrow();
    });

    it('ignores currentTime setter errors', () => {
      const bgm = createMockAudio();
      Object.defineProperty(bgm, 'currentTime', {
        get: () => 5,
        set: () => {
          throw new Error('seek fail');
        },
      });
      init({ bgm }, false);
      expect(() => stopBgm()).not.toThrow();
    });
  });

  describe('playSfx', () => {
    it('plays element sfx from start', () => {
      const jump = createMockAudio();
      jump.currentTime = 0.5;
      jump.paused = false;
      init({ jump }, false);
      playSfx('jump');
      expect(jump.pause).toHaveBeenCalled();
      expect(jump.currentTime).toBe(0);
      expect(jump.volume).toBeCloseTo(VOLUME_MASTER * VOLUME_SFX);
      expect(jump.muted).toBe(false);
      expect(jump.play).toHaveBeenCalled();
    });

    it('is a no-op when muted', () => {
      const jump = createMockAudio();
      init({ jump }, true);
      playSfx('jump');
      expect(jump.play).not.toHaveBeenCalled();
      expect(ctx.createOscillator).not.toHaveBeenCalled();
    });

    it('uses synth fallback for each known SFX and unknown names', () => {
      init({}, false);
      const names = ['jump', 'land', 'break', 'fall', 'highscore', 'rescue', 'unknown'];
      for (const name of names) {
        ctx.createOscillator.mockClear();
        ctx.createBufferSource.mockClear();
        playSfx(name);
        if (name === 'break') {
          expect(ctx.createBuffer).toHaveBeenCalled();
          expect(ctx.createBufferSource).toHaveBeenCalled();
          expect(ctx.createBiquadFilter).toHaveBeenCalled();
        } else {
          expect(ctx.createOscillator).toHaveBeenCalled();
        }
      }
    });

    it('swallows element play rejection and pause/seek errors', async () => {
      const land = createMockAudio();
      land.play = vi.fn(() => Promise.reject(new Error('blocked')));
      land.pause = vi.fn(() => {
        throw new Error('pause fail');
      });
      init({ land }, false);
      expect(() => playSfx('land')).not.toThrow();
      await Promise.resolve();
    });

    it('resumes suspended AudioContext for synth', () => {
      ctx.state = 'suspended';
      init({}, false);
      playSfx('jump');
      expect(ctx.resume).toHaveBeenCalled();
    });

    it('no-ops synth when AudioContext is unavailable', async () => {
      vi.resetModules();
      vi.stubGlobal('AudioContext', undefined);
      vi.stubGlobal('webkitAudioContext', undefined);
      const audio = await import('../js/audio.js');
      audio.init({}, false);
      expect(() => audio.playSfx('jump')).not.toThrow();
    });
  });
});
