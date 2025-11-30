import { expect, test } from '@playwright/test';

test.describe('Navigation', () => {
  test.describe('Public Routes', () => {
    test('should load login page', async ({ page }) => {
      await page.goto('/login');

      await expect(page).toHaveURL(/login/);
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    });

    test('should load register page', async ({ page }) => {
      await page.goto('/register');

      await expect(page).toHaveURL(/register/);
      await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    });

    test('should handle 404 gracefully', async ({ page }) => {
      const response = await page.goto('/non-existent-page');

      // Should either 404 or redirect to login
      expect(response?.status()).toBeLessThan(500);
    });
  });

  test.describe('Page Accessibility', () => {
    test('login page should have proper heading structure', async ({ page }) => {
      await page.goto('/login');

      const h1 = page.locator('h1');
      await expect(h1.first()).toBeVisible();
    });

    test('register page should have proper heading structure', async ({ page }) => {
      await page.goto('/register');

      const h1 = page.locator('h1');
      await expect(h1.first()).toBeVisible();
    });

    test('forms should have proper labels', async ({ page }) => {
      await page.goto('/login');

      const emailLabel = page.getByText(/email/i);
      const passwordLabel = page.getByText(/password/i);

      await expect(emailLabel).toBeVisible();
      await expect(passwordLabel).toBeVisible();
    });

    test('buttons should be keyboard accessible', async ({ page }) => {
      await page.goto('/login');

      // Tab to button and check it receives focus
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Some element should be focused
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('login page should be responsive on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      await page.goto('/login');

      await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
    });

    test('login page should be responsive on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      await page.goto('/login');

      await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
    });

    test('login page should be responsive on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 }); // Desktop
      await page.goto('/login');

      await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
    });
  });

  test.describe('Form Interactions', () => {
    test('should allow typing in email field', async ({ page }) => {
      await page.goto('/login');

      const emailInput = page.getByLabel(/email/i);
      await emailInput.fill('test@example.com');

      await expect(emailInput).toHaveValue('test@example.com');
    });

    test('should allow typing in password field', async ({ page }) => {
      await page.goto('/login');

      const passwordInput = page.getByLabel(/password/i);
      await passwordInput.fill('mypassword123');

      await expect(passwordInput).toHaveValue('mypassword123');
    });

    test('password field should be masked', async ({ page }) => {
      await page.goto('/login');

      const passwordInput = page.getByLabel(/password/i);
      await expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('should support form submission via Enter key', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.keyboard.press('Enter');

      // Form should attempt submission (may show error if credentials invalid)
      // Just verify it doesn't crash
      await page.waitForTimeout(1000);
    });
  });
});
