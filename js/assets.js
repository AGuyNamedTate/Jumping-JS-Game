/**
 * Asset loader — resolves missing media with procedural WAV / canvas stubs
 * so the game boots with sound and no external downloads required.
 */

/**
 * @param {string[]} paths
 * @returns {Promise<Record<string, HTMLImageElement|null>>}
 */
export async function loadImages(paths = []) {
  const result = {};
  await Promise.all(
    paths.map(async (path) => {
      const key = path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? path;
      try {
        const img = await loadImage(path);
        result[key] = img;
      } catch {
        // Missing file — leave null; gameplay can draw procedural fallbacks
        result[key] = null;
      }
    }),
  );
  return result;
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Load audio files; missing paths are filled with procedural WAV data-URIs.
 * @param {string[]} paths
 * @returns {Promise<Record<string, HTMLAudioElement|null>>}
 */
export async function loadAudio(paths = []) {
  const list = paths.length ? paths : AUDIO_PATHS;
  const result = {};
  await Promise.all(
    list.map(async (path) => {
      const key = path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? path;
      try {
        const audio = await loadAudioElement(path);
        result[key] = audio;
      } catch {
        result[key] = null;
      }
    }),
  );

  // Fill gaps with synthesized WAV clips (no external downloads)
  const needed = ['jump', 'land', 'break', 'fall', 'highscore', 'rescue', 'bgm'];
  for (const key of needed) {
    if (!result[key]) {
      result[key] = await createProceduralAudio(key);
    }
  }
  return result;
}

/**
 * @param {string} src
 * @returns {Promise<HTMLAudioElement>}
 */
function loadAudioElement(src) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const onReady = () => {
      cleanup();
      resolve(audio);
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Failed to load audio: ${src}`));
    };
    const cleanup = () => {
      audio.removeEventListener('canplaythrough', onReady);
      audio.removeEventListener('error', onError);
    };
    audio.addEventListener('canplaythrough', onReady, { once: true });
    audio.addEventListener('error', onError, { once: true });
    // Timeout so missing files don't hang forever in some browsers
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Audio load timeout: ${src}`));
    }, 2000);
    audio.addEventListener(
      'canplaythrough',
      () => clearTimeout(timer),
      { once: true },
    );
    audio.addEventListener(
      'error',
      () => clearTimeout(timer),
      { once: true },
    );
    audio.preload = 'auto';
    audio.src = src;
  });
}

/**
 * Generate a short WAV via OfflineAudioContext (or PCM fallback) as data-URI.
 * @param {string} name
 * @returns {Promise<HTMLAudioElement|null>}
 */
async function createProceduralAudio(name) {
  try {
    const uri = await renderProceduralWav(name);
    const audio = new Audio(uri);
    audio.preload = 'auto';
    if (name === 'bgm') audio.loop = true;
    return audio;
  } catch {
    return null;
  }
}

/**
 * @param {string} name
 * @returns {Promise<string>} data URI
 */
async function renderProceduralWav(name) {
  const sampleRate = 22050;
  /** @type {Record<string, { dur: number, build: (ctx: OfflineAudioContext) => void }>} */
  const specs = {
    jump: {
      dur: 0.14,
      build(ctx) {
        tone(ctx, 'square', 220, 520, 0.14, 0.3);
      },
    },
    land: {
      dur: 0.12,
      build(ctx) {
        tone(ctx, 'triangle', 160, 70, 0.1, 0.35);
        noiseBurst(ctx, 0.08, 0.2, 400);
      },
    },
    break: {
      dur: 0.22,
      build(ctx) {
        noiseBurst(ctx, 0.2, 0.35, 700);
        tone(ctx, 'sawtooth', 120, 40, 0.18, 0.2);
      },
    },
    fall: {
      dur: 0.5,
      build(ctx) {
        tone(ctx, 'sawtooth', 420, 70, 0.48, 0.25);
      },
    },
    highscore: {
      dur: 0.4,
      build(ctx) {
        const notes = [440, 554, 659, 880];
        notes.forEach((f, i) => {
          toneAt(ctx, 'square', f, f, 0.09, 0.22, i * 0.09);
        });
      },
    },
    rescue: {
      dur: 0.35,
      build(ctx) {
        toneAt(ctx, 'triangle', 520, 780, 0.14, 0.25, 0);
        toneAt(ctx, 'triangle', 780, 1040, 0.16, 0.22, 0.12);
      },
    },
    bgm: {
      dur: 2.4,
      build(ctx) {
        // Soft looping drone + sparse fifths
        toneAt(ctx, 'sine', 110, 110, 2.4, 0.12, 0);
        toneAt(ctx, 'sine', 165, 165, 2.4, 0.06, 0);
        toneAt(ctx, 'triangle', 220, 220, 0.4, 0.08, 0.2);
        toneAt(ctx, 'triangle', 330, 330, 0.35, 0.07, 0.9);
        toneAt(ctx, 'triangle', 262, 262, 0.4, 0.07, 1.6);
      },
    },
  };

  const spec = specs[name] ?? specs.jump;
  const AC =
    typeof OfflineAudioContext !== 'undefined'
      ? OfflineAudioContext
      : typeof window !== 'undefined' && window.webkitOfflineAudioContext
        ? window.webkitOfflineAudioContext
        : null;

  if (AC) {
    const frames = Math.max(1, Math.floor(sampleRate * spec.dur));
    const ctx = new AC(1, frames, sampleRate);
    spec.build(ctx);
    const buffer = await ctx.startRendering();
    return bufferToWavDataUri(buffer);
  }

  // Extremely minimal PCM beep if OfflineAudioContext unavailable
  const samples = Math.floor(sampleRate * 0.12);
  const data = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    data[i] = Math.sin((i / sampleRate) * 440 * Math.PI * 2) * (1 - i / samples) * 0.3;
  }
  return floatToWavDataUri(data, sampleRate);
}

/**
 * @param {OfflineAudioContext} ctx
 * @param {OscillatorType} type
 * @param {number} f0
 * @param {number} f1
 * @param {number} dur
 * @param {number} gain
 */
function tone(ctx, type, f0, f1, dur, gain) {
  toneAt(ctx, type, f0, f1, dur, gain, 0);
}

/**
 * @param {OfflineAudioContext} ctx
 * @param {OscillatorType} type
 * @param {number} f0
 * @param {number} f1
 * @param {number} dur
 * @param {number} gain
 * @param {number} when
 */
function toneAt(ctx, type, f0, f1, dur, gain, when) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, when);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), when + dur);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

/**
 * @param {OfflineAudioContext} ctx
 * @param {number} dur
 * @param {number} gain
 * @param {number} freq
 */
function noiseBurst(ctx, dur, gain, freq) {
  const frames = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  src.start(0);
}

/**
 * @param {AudioBuffer} buffer
 * @returns {string}
 */
function bufferToWavDataUri(buffer) {
  const ch = buffer.getChannelData(0);
  return floatToWavDataUri(ch, buffer.sampleRate);
}

/**
 * @param {Float32Array|number[]} samples
 * @param {number} sampleRate
 * @returns {string}
 */
function floatToWavDataUri(samples, sampleRate) {
  const n = samples.length;
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const dataSize = n * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      /** @type {number[]} */ (Array.from(bytes.subarray(i, i + chunk))),
    );
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/**
 * @param {DataView} view
 * @param {number} offset
 * @param {string} str
 */
function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/** Default asset path lists — files optional; procedural fills gaps */
export const IMAGE_PATHS = [
  // Prefer canvas generators in art.js; list real sprites here when available
  // 'assets/player.png',
  // 'assets/platform.png',
];

export const AUDIO_PATHS = [
  'assets/audio/jump.wav',
  'assets/audio/land.wav',
  'assets/audio/break.wav',
  'assets/audio/fall.wav',
  'assets/audio/highscore.wav',
  'assets/audio/rescue.wav',
  'assets/audio/bgm.wav',
];
