import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CONTINUE_TIMEOUT } from '../js/constants.js';
import {
  startContinueOffer,
  manageContinueOffer,
  cancelContinueOffer,
  isActive,
} from '../js/continue.js';
import { mountAppShell } from './setup.js';

function makeHandlers(overrides = {}) {
  return {
    hasBird: true,
    hasSafety: true,
    onUseBird: vi.fn(),
    onUseSafety: vi.fn(),
    onLetGo: vi.fn(),
    ...overrides,
  };
}

describe('continue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cancelContinueOffer();
  });

  afterEach(() => {
    cancelContinueOffer();
    vi.useRealTimers();
  });

  it('startContinueOffer aliases manageContinueOffer and sets active', () => {
    const opts = makeHandlers({ timeoutSec: 4 });
    startContinueOffer(opts);
    expect(isActive()).toBe(true);
    expect(document.getElementById('continue-timer').textContent).toBe('4');
    expect(document.getElementById('btn-use-bird').disabled).toBe(false);
    expect(document.getElementById('btn-use-safety').disabled).toBe(false);
  });

  it('disables bird/safety buttons when inventory flags are false', () => {
    manageContinueOffer(makeHandlers({ hasBird: false, hasSafety: false }));
    const bird = document.getElementById('btn-use-bird');
    const safety = document.getElementById('btn-use-safety');
    expect(bird.disabled).toBe(true);
    expect(safety.disabled).toBe(true);
    expect(bird.getAttribute('aria-disabled')).toBe('true');
    expect(safety.getAttribute('aria-disabled')).toBe('true');
  });

  it('shows both buttons but disables only the unavailable option', () => {
    manageContinueOffer(makeHandlers({ hasBird: false, hasSafety: true }));
    const bird = document.getElementById('btn-use-bird');
    const safety = document.getElementById('btn-use-safety');
    expect(bird).toBeTruthy();
    expect(safety).toBeTruthy();
    expect(bird.disabled).toBe(true);
    expect(safety.disabled).toBe(false);
  });

  it('counts down the timer and triggers onLetGo on timeout', () => {
    const opts = makeHandlers({ timeoutSec: 3 });
    manageContinueOffer(opts);
    expect(document.getElementById('continue-timer').textContent).toBe('3');

    vi.advanceTimersByTime(1000);
    expect(document.getElementById('continue-timer').textContent).toBe('2');
    expect(isActive()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(document.getElementById('continue-timer').textContent).toBe('1');

    vi.advanceTimersByTime(1000);
    expect(opts.onLetGo).toHaveBeenCalledTimes(1);
    expect(isActive()).toBe(false);
  });

  it('uses CONTINUE_TIMEOUT by default', () => {
    manageContinueOffer(makeHandlers());
    expect(document.getElementById('continue-timer').textContent).toBe(
      String(CONTINUE_TIMEOUT),
    );
  });

  it('bird / safety / letGo callbacks cancel and fire once', () => {
    const opts = makeHandlers();
    manageContinueOffer(opts);

    document.getElementById('btn-use-bird').click();
    expect(opts.onUseBird).toHaveBeenCalledTimes(1);
    expect(isActive()).toBe(false);
    expect(opts.onLetGo).not.toHaveBeenCalled();

    manageContinueOffer(opts);
    document.getElementById('btn-use-safety').click();
    expect(opts.onUseSafety).toHaveBeenCalledTimes(1);
    expect(isActive()).toBe(false);

    manageContinueOffer(opts);
    document.getElementById('btn-let-go').click();
    expect(opts.onLetGo).toHaveBeenCalledTimes(1);
    expect(isActive()).toBe(false);
  });

  it('ignores inactive and disabled inventory clicks', () => {
    const opts = makeHandlers({ hasBird: false, hasSafety: false });
    manageContinueOffer(opts);
    document.getElementById('btn-use-bird').click();
    document.getElementById('btn-use-safety').click();
    expect(opts.onUseBird).not.toHaveBeenCalled();
    expect(opts.onUseSafety).not.toHaveBeenCalled();
    expect(isActive()).toBe(true);

    cancelContinueOffer();
    expect(isActive()).toBe(false);
    document.getElementById('btn-let-go').click();
    document.getElementById('btn-use-bird').click();
    expect(opts.onLetGo).not.toHaveBeenCalled();
    expect(opts.onUseBird).not.toHaveBeenCalled();
  });

  it('cancelContinueOffer stops the timer mid-countdown', () => {
    const opts = makeHandlers({ timeoutSec: 5 });
    manageContinueOffer(opts);
    vi.advanceTimersByTime(2000);
    cancelContinueOffer();
    expect(isActive()).toBe(false);
    vi.advanceTimersByTime(10000);
    expect(opts.onLetGo).not.toHaveBeenCalled();
  });

  it('ensureTimerEl creates timer when missing', () => {
    document.getElementById('continue-timer')?.remove();
    expect(document.getElementById('continue-timer')).toBeNull();

    // Prefer insert before .menu-buttons when present
    const screen = document.getElementById('screen-continue');
    const nav = document.createElement('div');
    nav.className = 'menu-buttons';
    screen.appendChild(nav);

    manageContinueOffer(makeHandlers({ timeoutSec: 2 }));
    const timer = document.getElementById('continue-timer');
    expect(timer).toBeTruthy();
    expect(timer.className).toBe('continue-timer');
    expect(timer.textContent).toBe('2');
    expect(timer.nextElementSibling).toBe(nav);
  });

  it('ensureTimerEl appends when no menu-buttons and returns null without screen', () => {
    document.getElementById('continue-timer')?.remove();
    manageContinueOffer(makeHandlers({ timeoutSec: 2 }));
    expect(document.getElementById('continue-timer')?.textContent).toBe('2');

    document.body.innerHTML = '';
    expect(() => manageContinueOffer(makeHandlers())).not.toThrow();
    expect(isActive()).toBe(true);
    cancelContinueOffer();
    mountAppShell();
  });

  it('floors timeoutSec to at least 1', () => {
    manageContinueOffer(makeHandlers({ timeoutSec: 0.2 }));
    expect(document.getElementById('continue-timer').textContent).toBe('1');
  });
});
