import { test as base, expect } from '@playwright/test';

// Test user credentials
export const TEST_USER = {
  email: 'admin@mut.com',
  password: 'asdf1234',
};

// Extend base test with authentication
export const test = base.extend<{ authenticatedPage: typeof base }>({
  authenticatedPage: async ({ page }, use) => {
    // Login before test
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL(/overview|machines|dashboard/, { timeout: 10000 });

    await use(page);
  },
});

export { expect };
