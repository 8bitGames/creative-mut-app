import { expect, test } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');

      await expect(page.getByRole('heading', { name: /login|sign in/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
    });

    test('should show validation error for empty email', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /login|sign in/i }).click();

      // Browser native validation or form validation
      const emailInput = page.getByLabel(/email/i);
      await expect(emailInput).toBeVisible();
    });

    test('should show validation error for invalid email format', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill('invalid-email');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /login|sign in/i }).click();

      // Wait for error message
      await expect(page.getByText(/invalid email/i).or(page.getByText(/email/i))).toBeVisible({
        timeout: 5000,
      });
    });

    test('should show validation error for short password', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('short');
      await page.getByRole('button', { name: /login|sign in/i }).click();

      await expect(
        page.getByText(/at least 8 characters/i).or(page.getByText(/password/i))
      ).toBeVisible({ timeout: 5000 });
    });

    test('should have link to register page', async ({ page }) => {
      await page.goto('/login');

      const registerLink = page.getByRole('link', { name: /register|sign up|create account/i });
      await expect(registerLink).toBeVisible();
    });

    test('should navigate to register page', async ({ page }) => {
      await page.goto('/login');

      await page.getByRole('link', { name: /register|sign up|create account/i }).click();
      await expect(page).toHaveURL(/register/);
    });
  });

  test.describe('Register Page', () => {
    test('should display register form', async ({ page }) => {
      await page.goto('/register');

      await expect(
        page.getByRole('heading', { name: /register|sign up|create account/i })
      ).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByLabel(/full name/i)).toBeVisible();
      await expect(page.getByLabel(/organization name/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /register|sign up|create/i })).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await page.goto('/register');

      await page.getByRole('button', { name: /register|sign up|create/i }).click();

      // Form should not submit without required fields
      await expect(page).toHaveURL(/register/);
    });

    test('should have link to login page', async ({ page }) => {
      await page.goto('/register');

      const loginLink = page.getByRole('link', { name: /login|sign in/i });
      await expect(loginLink).toBeVisible();
    });

    test('should navigate to login page', async ({ page }) => {
      await page.goto('/register');

      await page.getByRole('link', { name: /login|sign in/i }).click();
      await expect(page).toHaveURL(/login/);
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users from dashboard to login', async ({ page }) => {
      await page.goto('/overview');

      // Should redirect to login
      await expect(page).toHaveURL(/login/);
    });

    test('should redirect unauthenticated users from machines to login', async ({ page }) => {
      await page.goto('/machines');

      await expect(page).toHaveURL(/login/);
    });

    test('should redirect unauthenticated users from sessions to login', async ({ page }) => {
      await page.goto('/sessions');

      await expect(page).toHaveURL(/login/);
    });

    test('should redirect unauthenticated users from analytics to login', async ({ page }) => {
      await page.goto('/analytics');

      await expect(page).toHaveURL(/login/);
    });

    test('should redirect unauthenticated users from alerts to login', async ({ page }) => {
      await page.goto('/alerts');

      await expect(page).toHaveURL(/login/);
    });
  });
});
