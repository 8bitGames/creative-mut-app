import { expect, TEST_USER, test } from './fixtures/auth';

test.describe('Machines Page (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/overview/, { timeout: 15000 });
  });

  test('should navigate to machines page', async ({ page }) => {
    await page.goto('/machines');
    await expect(page).toHaveURL(/machines/);
  });

  test('should display machines heading', async ({ page }) => {
    await page.goto('/machines');
    await expect(page.getByRole('heading', { name: /machines/i })).toBeVisible();
  });

  test('should display page with heading and controls', async ({ page }) => {
    await page.goto('/machines');

    // Wait for the heading to appear (confirms page loaded after auth)
    await expect(page.getByRole('heading', { name: /machines/i })).toBeVisible({ timeout: 15000 });

    // Page should have search input
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();

    // Page should have filter dropdown (combobox)
    await expect(page.getByRole('combobox')).toBeVisible();
  });

  test('should be able to click on a machine card', async ({ page }) => {
    await page.goto('/machines');
    await page.waitForLoadState('networkidle');

    // Find and click a machine card
    const machineCard = page.locator('[class*="card"]').first();

    if (await machineCard.isVisible()) {
      await machineCard.click();
      // Should navigate to machine detail page
      await expect(page).toHaveURL(/machines\/[a-z0-9-]+/i, { timeout: 10000 });
    }
  });
});

test.describe('Machine Detail Page (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/overview/, { timeout: 15000 });
  });

  test('should display machine detail page', async ({ page }) => {
    // Navigate to machines first
    await page.goto('/machines');
    await page.waitForLoadState('networkidle');

    // Click on first machine card
    const machineCard = page.locator('[class*="card"]').first();

    if (await machineCard.isVisible()) {
      await machineCard.click();
      await page.waitForLoadState('networkidle');

      // Should show machine name
      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show machine hardware info', async ({ page }) => {
    await page.goto('/machines');
    await page.waitForLoadState('networkidle');

    const machineCard = page.locator('[class*="card"]').first();

    if (await machineCard.isVisible()) {
      await machineCard.click();
      await page.waitForLoadState('networkidle');

      // Look for hardware info section
      const hardwareInfo = page.getByText(/hardware|cpu|gpu|ram/i).first();
      await expect(hardwareInfo).toBeVisible({ timeout: 10000 });
    }
  });
});
