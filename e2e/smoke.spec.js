import { test, expect } from '@playwright/test';

test.describe('Fantasy Peak Climber smoke', () => {
  test('loads canvas and main menu, Play starts a run', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#game-canvas')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fantasy Peak Climber' })).toBeVisible();
    await expect(page.locator('#btn-play')).toBeVisible();

    await page.locator('#btn-play').click();

    await expect(page.locator('#screen-main')).toHaveClass(/hidden/);
    await expect(page.locator('#hud')).toBeVisible();
  });
});
