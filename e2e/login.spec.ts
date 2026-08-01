import { test, expect } from '@playwright/test';

/**
 * Smoke test: verify the app loads and the login page renders.
 *
 * This is the minimal E2E sanity check — everything else builds on it.
 */
test('login page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/TrustVault/);

  // Should see the login form (verified via error-context.yaml)
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Master Password' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});
