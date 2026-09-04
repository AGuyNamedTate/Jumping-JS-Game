import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STORAGE_KEY, HUD_SCORE_SCALE_MIN } from '../js/constants.js';
import * as storage from '../js/storage.js';
import {
  showScreen,
  setDisplayScore,
  getDisplayScore,
  updateHud,
  updateMainMenu,
  applyMuteToUi,
  bindMenuButtons,
  openStoreUi,
  renderHistory,
} from '../js/ui.js';
import { mountAppShell } from './setup.js';

function isHidden(id) {
  return document.getElementById(id)?.classList.contains('hidden') ?? false;
}

function seedSave(partial) {
  const data = storage.load();
  storage.save({ ...data, ...partial });
}

describe('ui', () => {
  beforeEach(() => {
    setDisplayScore(0);
  });

  describe('showScreen', () => {
    it('shows mainMenu and hides other overlays + HUD', () => {
      showScreen('playing');
      showScreen('mainMenu');
      expect(isHidden('screen-main')).toBe(false);
      expect(isHidden('screen-history')).toBe(true);
      expect(isHidden('screen-store')).toBe(true);
      expect(isHidden('screen-continue')).toBe(true);
      expect(isHidden('screen-gameover')).toBe(true);
      expect(isHidden('hud')).toBe(true);
    });

    it('shows runHistory', () => {
      showScreen('runHistory');
      expect(isHidden('screen-history')).toBe(false);
      expect(isHidden('screen-main')).toBe(true);
      expect(isHidden('hud')).toBe(true);
    });

    it('shows store', () => {
      showScreen('store');
      expect(isHidden('screen-store')).toBe(false);
      expect(isHidden('hud')).toBe(true);
    });

    it('shows HUD for playing and hides all menu screens', () => {
      showScreen('mainMenu');
      showScreen('playing');
      expect(isHidden('hud')).toBe(false);
      expect(isHidden('screen-main')).toBe(true);
      expect(isHidden('screen-history')).toBe(true);
      expect(isHidden('screen-store')).toBe(true);
      expect(isHidden('screen-continue')).toBe(true);
      expect(isHidden('screen-gameover')).toBe(true);
    });

    it('shows continueOffer', () => {
      showScreen('continueOffer');
      expect(isHidden('screen-continue')).toBe(false);
      expect(isHidden('hud')).toBe(true);
    });

    it('shows gameOver', () => {
      showScreen('gameOver');
      expect(isHidden('screen-gameover')).toBe(false);
      expect(isHidden('hud')).toBe(true);
    });
  });

  describe('setDisplayScore / getDisplayScore', () => {
    it('sets floored non-negative score and transform scale', () => {
      setDisplayScore(12.9, 1.2);
      expect(getDisplayScore()).toBe(12);
      const el = document.getElementById('hud-score');
      expect(el.textContent).toBe('12');
      expect(el.style.transform).toBe('translateX(-50%) scale(1.2)');
      expect(el.style.transformOrigin).toBe('center top');
    });

    it('clamps negative values and uses default scale', () => {
      setDisplayScore(-5);
      expect(getDisplayScore()).toBe(0);
      expect(document.getElementById('hud-score').style.transform).toBe(
        `translateX(-50%) scale(${HUD_SCORE_SCALE_MIN})`,
      );
    });

    it('uses min scale when scale is non-finite', () => {
      setDisplayScore(3, Number.NaN);
      expect(document.getElementById('hud-score').style.transform).toBe(
        `translateX(-50%) scale(${HUD_SCORE_SCALE_MIN})`,
      );
    });

    it('still updates internal score when #hud-score is missing', () => {
      document.getElementById('hud-score')?.remove();
      setDisplayScore(42, 1.1);
      expect(getDisplayScore()).toBe(42);
      expect(document.getElementById('hud-score')).toBeNull();
    });
  });

  describe('updateHud', () => {
    it('writes best, displayScore, bird, safety, and charge bar', () => {
      seedSave({
        bestScore: 99,
        inventory: { rescueBird: 2, safetyPlatform: 1 },
      });
      updateHud({
        best: 150,
        displayScore: 33.7,
        scoreScale: 1.25,
        bird: 4,
        safety: 5,
        charging: true,
        charge: 0.42,
      });
      expect(document.getElementById('hud-highscore').textContent).toBe('Best: 150');
      expect(getDisplayScore()).toBe(33);
      expect(document.getElementById('hud-score').textContent).toBe('33');
      expect(document.getElementById('hud-score').style.transform).toContain('scale(1.25)');
      expect(document.getElementById('hud-bird').textContent).toBe('Bird: 4');
      expect(document.getElementById('hud-safety').textContent).toBe('Safety: 5');
      const wrap = document.getElementById('charge-bar-wrap');
      expect(wrap.getAttribute('aria-hidden')).toBe('false');
      expect(wrap.style.opacity).toBe('1');
      expect(document.getElementById('charge-bar').style.width).toBe('42%');
    });

    it('falls back to storage best/bird/safety and uses score when displayScore omitted', () => {
      seedSave({
        bestScore: 77,
        inventory: { rescueBird: 3, safetyPlatform: 8 },
      });
      updateHud({ score: 10.2, charging: false, charge: 2 });
      expect(document.getElementById('hud-highscore').textContent).toBe('Best: 77');
      expect(getDisplayScore()).toBe(10);
      expect(document.getElementById('hud-bird').textContent).toBe('Bird: 3');
      expect(document.getElementById('hud-safety').textContent).toBe('Safety: 8');
      const wrap = document.getElementById('charge-bar-wrap');
      expect(wrap.getAttribute('aria-hidden')).toBe('true');
      expect(wrap.style.opacity).toBe('0.35');
      expect(document.getElementById('charge-bar').style.width).toBe('100%');
    });

    it('applies scoreScale-only path without changing display score', () => {
      setDisplayScore(55);
      updateHud({ scoreScale: 1.33 });
      expect(getDisplayScore()).toBe(55);
      expect(document.getElementById('hud-score').textContent).toBe('55');
      expect(document.getElementById('hud-score').style.transform).toBe(
        'translateX(-50%) scale(1.33)',
      );
      expect(document.getElementById('hud-score').style.transformOrigin).toBe(
        'center top',
      );
    });

    it('uses score when displayScore is explicitly null', () => {
      updateHud({ displayScore: null, score: 17 });
      expect(getDisplayScore()).toBe(17);
    });

    it('clamps charge to [0,1] and ignores missing charge bar nodes', () => {
      document.getElementById('charge-bar')?.remove();
      updateHud({ charging: true, charge: -0.5 });
      expect(document.getElementById('charge-bar')).toBeNull();
    });
  });

  describe('updateMainMenu', () => {
    beforeEach(() => {
      const main = document.getElementById('screen-main');
      if (main && !main.querySelector('.tagline')) {
        const tag = document.createElement('p');
        tag.className = 'tagline';
        main.appendChild(tag);
      }
    });

    it('sets default tagline and unmute labels when bestScore is 0', () => {
      updateMainMenu({ ...storage.load(), bestScore: 0, muted: false });
      expect(document.querySelector('#screen-main .tagline').textContent).toBe(
        "Climb the peaks. Don't look down.",
      );
      expect(document.getElementById('btn-mute').textContent).toBe('Mute');
      expect(document.getElementById('btn-mute').getAttribute('aria-pressed')).toBe(
        'false',
      );
    });

    it('shows best climb when bestScore > 0 and loads save when omitted', () => {
      seedSave({ bestScore: 240, muted: true });
      updateMainMenu();
      expect(document.querySelector('#screen-main .tagline').textContent).toBe(
        'Best climb: 240',
      );
      expect(document.getElementById('btn-mute').textContent).toBe('Unmute');
      expect(document.getElementById('btn-mute-hud').textContent).toBe('Unmute');
    });

    it('skips tagline update when element is missing', () => {
      document.querySelector('#screen-main .tagline')?.remove();
      expect(() =>
        updateMainMenu({ ...storage.load(), bestScore: 10, muted: false }),
      ).not.toThrow();
    });
  });

  describe('applyMuteToUi', () => {
    it('toggles mute button labels and aria-pressed', () => {
      applyMuteToUi(true);
      expect(document.getElementById('btn-mute').textContent).toBe('Unmute');
      expect(document.getElementById('btn-mute-hud').getAttribute('aria-pressed')).toBe(
        'true',
      );
      applyMuteToUi(false);
      expect(document.getElementById('btn-mute-hud').textContent).toBe('Mute');
      expect(document.getElementById('btn-mute').getAttribute('aria-pressed')).toBe(
        'false',
      );
    });

    it('tolerates missing mute buttons', () => {
      document.getElementById('btn-mute')?.remove();
      document.getElementById('btn-mute-hud')?.remove();
      expect(() => applyMuteToUi(true)).not.toThrow();
    });
  });

  describe('bindMenuButtons', () => {
    it('fires all provided handlers including mute-hud and continue binds', () => {
      const handlers = {
        onPlay: vi.fn(),
        onHistory: vi.fn(),
        onStore: vi.fn(),
        onHistoryBack: vi.fn(),
        onStoreBack: vi.fn(),
        onPlayAgain: vi.fn(),
        onGameOverMenu: vi.fn(),
        onMute: vi.fn(),
        onUseBird: vi.fn(),
        onUseSafety: vi.fn(),
        onLetGo: vi.fn(),
      };
      bindMenuButtons(handlers);

      const click = (id) => document.getElementById(id).click();
      click('btn-play');
      click('btn-history');
      click('btn-store');
      click('btn-history-back');
      click('btn-store-back');
      click('btn-play-again');
      click('btn-gameover-menu');
      click('btn-mute');
      click('btn-mute-hud');
      click('btn-use-bird');
      click('btn-use-safety');
      click('btn-let-go');

      expect(handlers.onPlay).toHaveBeenCalledTimes(1);
      expect(handlers.onHistory).toHaveBeenCalledTimes(1);
      expect(handlers.onStore).toHaveBeenCalledTimes(1);
      expect(handlers.onHistoryBack).toHaveBeenCalledTimes(1);
      expect(handlers.onStoreBack).toHaveBeenCalledTimes(1);
      expect(handlers.onPlayAgain).toHaveBeenCalledTimes(1);
      expect(handlers.onGameOverMenu).toHaveBeenCalledTimes(1);
      expect(handlers.onMute).toHaveBeenCalledTimes(2);
      expect(handlers.onUseBird).toHaveBeenCalledTimes(1);
      expect(handlers.onUseSafety).toHaveBeenCalledTimes(1);
      expect(handlers.onLetGo).toHaveBeenCalledTimes(1);
    });

    it('skips binds when handlers are omitted', () => {
      expect(() => bindMenuButtons({})).not.toThrow();
      document.getElementById('btn-play').click();
    });
  });

  describe('openStoreUi', () => {
    it('opens store screen and renders wallet content', () => {
      seedSave({ wallet: 1234 });
      openStoreUi();
      expect(isHidden('screen-store')).toBe(false);
      expect(document.getElementById('store-wallet').textContent).toBe(
        'Wallet: 1,234',
      );
      expect(document.getElementById('store-cosmetics')?.innerHTML.length).toBeGreaterThan(
        0,
      );
    });
  });

  describe('renderHistory', () => {
    it('shows empty message when no runs', () => {
      renderHistory();
      expect(document.getElementById('history-list').textContent).toBe(
        'No climbs yet.',
      );
    });

    it('renders run rows from save', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...storage.load(),
          runs: [
            { score: 100, height: 40, at: '2026-01-01T00:00:00.000Z' },
            { score: 50, height: 20, at: '2026-01-02T00:00:00.000Z' },
          ],
        }),
      );
      renderHistory();
      const html = document.getElementById('history-list').innerHTML;
      expect(html).toContain('#1 — Score 100 · Height 40');
      expect(html).toContain('#2 — Score 50 · Height 20');
    });

    it('no-ops when history list is missing', () => {
      document.getElementById('history-list')?.remove();
      expect(() => renderHistory()).not.toThrow();
    });
  });

  describe('remount helper', () => {
    it('can remount shell via mountAppShell', () => {
      mountAppShell();
      expect(document.getElementById('hud-score')).toBeTruthy();
      showScreen('playing');
      expect(isHidden('hud')).toBe(false);
    });
  });
});
