import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cssPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'css', 'styles.css');
const css = readFileSync(cssPath, 'utf8');

/**
 * @param {string} selector
 * @returns {string}
 */
function ruleBody(selector) {
  const re = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]+)\\}`,
  );
  const match = css.match(re);
  expect(match, `expected CSS rule for ${selector}`).toBeTruthy();
  return match[1];
}

describe('HUD typography / layout CSS', () => {
  it('sizes Best and inventory ~10–15% larger than prior HUD chrome', () => {
    expect(ruleBody('.hud-highscore')).toMatch(/font-size:\s*0\.45rem/);
    expect(ruleBody('.hud-inventory')).toMatch(/font-size:\s*0\.4rem/);
  });

  it('centers #hud-score with left:50% + translateX(-50%) for scale pulse', () => {
    const body = ruleBody('.hud-score');
    expect(body).toMatch(/left:\s*50%/);
    expect(body).toMatch(/transform:\s*translateX\(-50%\)\s+scale\(/);
    expect(body).toMatch(/transform-origin:\s*center\s+top/);
    expect(body).not.toMatch(/right:\s*0/);
    expect(body).not.toMatch(/left:\s*0\b/);
  });
});
