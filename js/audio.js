/**
 * Audio manager — BGM + SFX with procedural oscillator fallback.
 */

import {
  VOLUME_MASTER,
  VOLUME_MUSIC,
  VOLUME_SFX,
} from './constants.js';

/** @type {Record<string, HTMLAudioElement|null>} */
let audioMap = {};

/** @type {boolean} */
let muted = false;

/** @type {HTMLAudioElement|null} */
let bgmEl = null;

/** @type {AudioContext|null} */
let synthCtx = null;

const SFX_NAMES = /** @type {const} */ ([
  'jump',
  'land',
  'break',
  'fall',
  'highscore',
  'rescue',
]);

/** @typedef {typeof SFX_NAMES[number]} SfxName */

/**
 * @param {Record<string, HTMLAudioElement|null>} loaded
 * @param {boolean} [startMuted=false]
 */
export function init(loaded = {}, startMuted = false) {
  audioMap = { ...loaded };
  muted = Boolean(startMuted);
  bgmEl = pickBgm();
  applyVolumes();
}

/**
 * @returns {HTMLAudioElement|null}
 */
function pickBgm() {
  return audioMap.bgm ?? audioMap.music ?? audioMap.theme ?? null;
}

function sfxGain() {
  return VOLUME_MASTER * VOLUME_SFX;
}

function musicGain() {
  return VOLUME_MASTER * VOLUME_MUSIC;
}

function applyVolumes() {
  const sfxVol = muted ? 0 : sfxGain();
  const musicVol = muted ? 0 : musicGain();
  for (const [key, el] of Object.entries(audioMap)) {
    if (!el) continue;
    const isMusic = key === 'bgm' || key === 'music' || key === 'theme';
    el.volume = Math.max(0, Math.min(1, isMusic ? musicVol : sfxVol));
    el.muted = muted;
  }
  if (bgmEl) {
    bgmEl.volume = Math.max(0, Math.min(1, musicVol));
    bgmEl.muted = muted;
  }
}

/**
 * @param {boolean} value
 */
export function setMuted(value) {
  muted = Boolean(value);
  applyVolumes();
  if (muted && bgmEl && !bgmEl.paused) {
    // Keep playing silently so unmute resumes mid-track without restart
    bgmEl.muted = true;
    bgmEl.volume = 0;
  }
}

export function isMuted() {
  return muted;
}

export function playBgm() {
  if (!bgmEl) bgmEl = pickBgm();
  if (!bgmEl) {
    // Soft procedural drone if no BGM asset
    if (!muted) playSynthTone('bgm');
    return;
  }
  bgmEl.loop = true;
  bgmEl.volume = muted ? 0 : musicGain();
  bgmEl.muted = muted;
  const p = bgmEl.play();
  if (p && typeof p.catch === 'function') p.catch(() => {});
}

export function stopBgm() {
  if (!bgmEl) return;
  bgmEl.pause();
  try {
    bgmEl.currentTime = 0;
  } catch {
    /* ignore */
  }
}

/**
 * @param {SfxName|string} name
 */
export function playSfx(name) {
  if (muted) return;
  const key = String(name);
  const el = audioMap[key];
  if (el) {
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    el.volume = sfxGain();
    el.muted = false;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return;
  }
  playSynthTone(key);
}

/**
 * Ensure AudioContext for procedural beeps (created on first user gesture ideally).
 * @returns {AudioContext|null}
 */
function ensureSynth() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!synthCtx) synthCtx = new AC();
  if (synthCtx.state === 'suspended') {
    synthCtx.resume().catch(() => {});
  }
  return synthCtx;
}

/**
 * Short synthesized cues when asset files are missing.
 * @param {string} name
 */
function playSynthTone(name) {
  const ctx = ensureSynth();
  if (!ctx || muted) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = sfxGain() * 0.55;
  master.connect(ctx.destination);

  /** @type {Record<string, { type: OscillatorType, f0: number, f1: number, dur: number, noise?: boolean }[]>} */
  const presets = {
    jump: [{ type: 'square', f0: 220, f1: 520, dur: 0.12 }],
    land: [{ type: 'triangle', f0: 180, f1: 90, dur: 0.08 }, { type: 'square', f0: 90, f1: 60, dur: 0.06 }],
    break: [{ type: 'sawtooth', f0: 140, f1: 40, dur: 0.18, noise: true }],
    fall: [{ type: 'sawtooth', f0: 400, f1: 80, dur: 0.45 }],
    highscore: [
      { type: 'square', f0: 440, f1: 440, dur: 0.08 },
      { type: 'square', f0: 554, f1: 554, dur: 0.08 },
      { type: 'square', f0: 659, f1: 659, dur: 0.16 },
    ],
    rescue: [
      { type: 'triangle', f0: 520, f1: 780, dur: 0.14 },
      { type: 'triangle', f0: 780, f1: 1040, dur: 0.16 },
    ],
    bgm: [{ type: 'sine', f0: 110, f1: 110, dur: 0.6 }],
  };

  const voices = presets[name] ?? [{ type: 'square', f0: 300, f1: 200, dur: 0.1 }];
  let t = now;

  for (const v of voices) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + v.dur);
    g.connect(master);

    if (v.noise) {
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * v.dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 600;
      src.connect(filter);
      filter.connect(g);
      src.start(t);
      src.stop(t + v.dur);
    } else {
      const osc = ctx.createOscillator();
      osc.type = v.type;
      osc.frequency.setValueAtTime(v.f0, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, v.f1), t + v.dur);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + v.dur + 0.02);
    }
    t += v.dur * 0.85;
  }
}
