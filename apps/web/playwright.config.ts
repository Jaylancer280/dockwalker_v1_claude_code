import { defineConfig } from '@playwright/test';
import path from 'path';

const authDir = path.join(__dirname, 'e2e/.auth');

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'on',
    viewport: { width: 390, height: 844 },
  },
  projects: [
    // --- Auth setup (runs first) ---
    { name: 'auth-setup', testMatch: /auth\.setup\.ts/, use: { browserName: 'chromium' } },

    // --- Public tests (no auth needed) ---
    {
      name: 'public-mobile',
      testMatch: /smoke\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 } },
    },
    {
      name: 'public-desktop',
      testMatch: /smoke\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } },
    },

    // --- Employer tests ---
    {
      name: 'employer-mobile',
      testMatch: /employer\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        storageState: path.join(authDir, 'employer.json'),
      },
    },
    {
      name: 'employer-desktop',
      testMatch: /employer\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        storageState: path.join(authDir, 'employer.json'),
      },
    },

    // --- Crew tests ---
    {
      name: 'crew-mobile',
      testMatch: /crew\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        storageState: path.join(authDir, 'crew.json'),
      },
    },
    {
      name: 'crew-desktop',
      testMatch: /crew\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        storageState: path.join(authDir, 'crew.json'),
      },
    },

    // --- Crew-alt tests (g@1 — different location, fewer certs) ---
    {
      name: 'crew-alt-mobile',
      testMatch: /crew-alt\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        storageState: path.join(authDir, 'crew-alt.json'),
      },
    },

    // --- Agent tests (a@1 — agency identity, cannot switch hats) ---
    {
      name: 'agent-mobile',
      testMatch: /agent\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        storageState: path.join(authDir, 'agent.json'),
      },
    },
    {
      name: 'agent-desktop',
      testMatch: /agent\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        storageState: path.join(authDir, 'agent.json'),
      },
    },

    // --- Interaction tests (multi-user, uses seed engagement data) ---
    {
      name: 'interactions-mobile',
      testMatch: /interactions\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },

    // --- Permanent hiring flow tests ---
    {
      name: 'permanent-mobile',
      testMatch: /permanent\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },

    // --- Data validation tests (assert seed content renders) ---
    {
      name: 'data-validation-mobile',
      testMatch: /data-validation\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },

    // --- Performance baseline tests ---
    {
      name: 'performance',
      testMatch: /performance\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },

    // --- RLS isolation tests (cross-user data leakage) ---
    {
      name: 'rls-isolation-mobile',
      testMatch: /rls-isolation\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },

    // --- Negative space tests (business rule enforcement) ---
    {
      name: 'negative-space-mobile',
      testMatch: /negative-space\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },

    // --- Edge case tests (validation, errors, flows, modals) ---
    {
      name: 'edge-cases-mobile',
      testMatch: /edge-cases\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },

    // --- Consistency tests (cross-route comparison, multi-user) ---
    {
      name: 'consistency-mobile',
      testMatch: /consistency\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },

    // --- Uncovered routes (edit experience, reset password, docky, settings, preview) ---
    {
      name: 'uncovered-routes-mobile',
      testMatch: /uncovered-routes\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },

    // --- User flow tests (filters, tab navigation, profile sections) ---
    {
      name: 'flows-mobile',
      testMatch: /flows\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },

    // --- Onboarding tests (unboarded user d@1) ---
    {
      name: 'onboarding-mobile',
      testMatch: /onboarding\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        storageState: path.join(authDir, 'unboarded.json'),
      },
    },
  ],
});
