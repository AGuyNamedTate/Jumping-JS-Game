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

describe('Store UI typography CSS', () => {
  it('enlarges store tab labels to reduce Press Start 2P glyph gaps', () => {
    const body = ruleBody('.tab');
    expect(body).toMatch(/font-size:\s*0\.55rem/);
  });

  it('enlarges store panel body text', () => {
    expect(ruleBody('.store-panel')).toMatch(/font-size:\s*0\.5rem/);
  });
});
