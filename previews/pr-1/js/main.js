/**
 * Fantasy Peak Climber — entry point
 */

import { loadImages, loadAudio, IMAGE_PATHS, AUDIO_PATHS } from './assets.js';
import { init, startLoop, goMainMenu } from './game.js';

async function boot() {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    console.error('Missing #game-canvas');
    return;
  }

  const [images, audio] = await Promise.all([
    loadImages(IMAGE_PATHS),
    loadAudio(AUDIO_PATHS),
  ]);

  init(canvas, { images, audio });
  goMainMenu();
  startLoop();
}

boot().catch((err) => {
  console.error('Boot failed:', err);
});
