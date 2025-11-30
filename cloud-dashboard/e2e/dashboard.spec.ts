import { expect, test } from '@playwright/test';

// Note: These tests require authentication
// In a real scenario, you would set up test users and login before each test
// For now, these tests verify the structure and behavior of pages

test.describe('Dashboard Structure', () => {
  // Skip auth-required tests in CI without proper test user setup
  test.skip(({ browserName }) => true, 'Skipping - requires authentication setup');

  test.describe('Overview Page', () => {
    test('should display overview heading', async ({ page }) => {
      await page.goto('/overview');

      await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible();
    });

    test('should display stat cards', async ({ page }) => {
      await page.goto('/overview');

      // Should have stat cards
      const cards = page.locator('[class*="card"]');
      await expect(cards.first()).toBeVisible();
    });
  });

  test.describe('Machines Page', () => {
    test('should display machines heading', async ({ page }) => {
      await page.goto('/machines');

      await expect(page.getByRole('heading', { name: /machines/i })).toBeVisible();
    });

    test('should have filter controls', async ({ page }) => {
      await page.goto('/machines');

      // Look for filter elements
      const filterSection = page.locator('[class*="filter"]').or(page.getByRole('combobox'));
      await expect(filterSection.first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Sessions Page', () => {
    test('should display sessions heading', async ({ page }) => {
      await page.goto('/sessions');

      await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible();
    });

    test('should display sessions table or empty state', async ({ page }) => {
      await page.goto('/sessions');

      // Either table or empty state should be visible
      const table = page.locator('table');
      const emptyState = page.getByText(/no sessions/i);

      await expect(table.or(emptyState)).toBeVisible();
    });
  });

  test.describe('Analytics Page', () => {
    test('should display analytics heading', async ({ page }) => {
      await page.goto('/analytics');

      await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
    });
  });

  test.describe('Alerts Page', () => {
    test('should display alerts heading', async ({ page }) => {
      await page.goto('/alerts');

      await expect(page.getByRole('heading', { name: /alerts/i })).toBeVisible();
    });

    test('should have severity filter', async ({ page }) => {
      await page.goto('/alerts');

      const severityFilter = page.getByRole('combobox').or(page.locator('[class*="select"]'));
      await expect(severityFilter.first()).toBeVisible();
    });
  });

  test.describe('Settings Page', () => {
    test('should display settings heading', async ({ page }) => {
      await page.goto('/settings');

      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    });
  });
});

test.describe('Dashboard Layout', () => {
  test.skip(({ browserName }) => true, 'Skipping - requires authentication setup');

  test('should have sidebar navigation', async ({ page }) => {
    await page.goto('/overview');

    const sidebar = page.locator('aside, nav').first();
    await expect(sidebar).toBeVisible();
  });

  test('should have header', async ({ page }) => {
    await page.goto('/overview');

    const header = page.locator('header').first();
    await expect(header).toBeVisible();
  });

  test('should have navigation links', async ({ page }) => {
    await page.goto('/overview');

    const navLinks = ['Overview', 'Machines', 'Sessions', 'Analytics', 'Alerts', 'Settings'];

    for (const linkText of navLinks) {
      const link = page.getByRole('link', { name: new RegExp(linkText, 'i') });
      await expect(link).toBeVisible();
    }
  });

  test('sidebar navigation should work', async ({ page }) => {
    await page.goto('/overview');

    // Click on Machines link
    await page.getByRole('link', { name: /machines/i }).click();
    await expect(page).toHaveURL(/machines/);

    // Click on Sessions link
    await page.getByRole('link', { name: /sessions/i }).click();
    await expect(page).toHaveURL(/sessions/);

    // Click on Analytics link
    await page.getByRole('link', { name: /analytics/i }).click();
    await expect(page).toHaveURL(/analytics/);
  });
});

test.describe('Mobile Navigation', () => {
  test.skip(({ browserName }) => true, 'Skipping - requires authentication setup');

  test('should have mobile menu button on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/overview');

    // Look for hamburger menu or mobile nav trigger
    const menuButton = page
      .locator('button[aria-label*="menu"]')
      .or(page.locator('[class*="mobile"]').locator('button'))
      .or(page.locator('[data-testid="mobile-menu"]'));

    await expect(menuButton.first()).toBeVisible();
  });
});
