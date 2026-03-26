import { test as base, expect } from '@playwright/test';
import path from 'path';

/**
 * Performance baseline tests — measure page load times.
 *
 * Captures navigation timing for critical routes. Not hard assertions
 * (flaky on CI), but screenshots + timing data for regression detection.
 * The testing agent compares timings across runs.
 */

const authDir = path.join(__dirname, '.auth');

const employerTest = base.extend({
  storageState: path.join(authDir, 'employer.json'),
});
const crewTest = base.extend({
  storageState: path.join(authDir, 'crew.json'),
});

interface TimingResult {
  route: string;
  ttfb: number;
  domContentLoaded: number;
  load: number;
}

async function measureTiming(page: any, route: string): Promise<TimingResult> {
  await page.goto(route, { waitUntil: 'load' });
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      ttfb: Math.round(nav.responseStart - nav.requestStart),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.requestStart),
      load: Math.round(nav.loadEventEnd - nav.requestStart),
    };
  });
  return { route, ...timing };
}

// ============================================================
// CRITICAL ROUTES — Timing baselines
// ============================================================
employerTest.describe('Performance — Employer Routes', () => {
  employerTest('daywork/mine loads within acceptable time', async ({ page }) => {
    const timing = await measureTiming(page, '/daywork/mine');
    // Log timing for registry comparison
    console.log(`PERF: ${timing.route} — TTFB: ${timing.ttfb}ms, DCL: ${timing.domContentLoaded}ms, Load: ${timing.load}ms`);
    // Soft assertion: page should load in under 10s even on slow local dev
    expect(timing.load).toBeLessThan(10_000);
  });

  employerTest('daywork/post loads within acceptable time', async ({ page }) => {
    const timing = await measureTiming(page, '/daywork/post');
    console.log(`PERF: ${timing.route} — TTFB: ${timing.ttfb}ms, DCL: ${timing.domContentLoaded}ms, Load: ${timing.load}ms`);
    expect(timing.load).toBeLessThan(10_000);
  });

  employerTest('profile loads within acceptable time', async ({ page }) => {
    const timing = await measureTiming(page, '/profile');
    console.log(`PERF: ${timing.route} — TTFB: ${timing.ttfb}ms, DCL: ${timing.domContentLoaded}ms, Load: ${timing.load}ms`);
    expect(timing.load).toBeLessThan(10_000);
  });

  employerTest('vessels loads within acceptable time', async ({ page }) => {
    const timing = await measureTiming(page, '/vessels');
    console.log(`PERF: ${timing.route} — TTFB: ${timing.ttfb}ms, DCL: ${timing.domContentLoaded}ms, Load: ${timing.load}ms`);
    expect(timing.load).toBeLessThan(10_000);
  });
});

crewTest.describe('Performance — Crew Routes', () => {
  crewTest('discover loads within acceptable time', async ({ page }) => {
    const timing = await measureTiming(page, '/discover');
    console.log(`PERF: ${timing.route} — TTFB: ${timing.ttfb}ms, DCL: ${timing.domContentLoaded}ms, Load: ${timing.load}ms`);
    expect(timing.load).toBeLessThan(10_000);
  });

  crewTest('messages loads within acceptable time', async ({ page }) => {
    const timing = await measureTiming(page, '/messages');
    console.log(`PERF: ${timing.route} — TTFB: ${timing.ttfb}ms, DCL: ${timing.domContentLoaded}ms, Load: ${timing.load}ms`);
    expect(timing.load).toBeLessThan(10_000);
  });

  crewTest('availability loads within acceptable time', async ({ page }) => {
    const timing = await measureTiming(page, '/availability');
    console.log(`PERF: ${timing.route} — TTFB: ${timing.ttfb}ms, DCL: ${timing.domContentLoaded}ms, Load: ${timing.load}ms`);
    expect(timing.load).toBeLessThan(10_000);
  });

  crewTest('profile loads within acceptable time', async ({ page }) => {
    const timing = await measureTiming(page, '/profile');
    console.log(`PERF: ${timing.route} — TTFB: ${timing.ttfb}ms, DCL: ${timing.domContentLoaded}ms, Load: ${timing.load}ms`);
    expect(timing.load).toBeLessThan(10_000);
  });
});

// ============================================================
// PUBLIC ROUTES — No auth overhead
// ============================================================
base.describe('Performance — Public Routes', () => {
  base('landing page loads within acceptable time', async ({ page }) => {
    const timing = await measureTiming(page, '/');
    console.log(`PERF: ${timing.route} — TTFB: ${timing.ttfb}ms, DCL: ${timing.domContentLoaded}ms, Load: ${timing.load}ms`);
    expect(timing.load).toBeLessThan(10_000);
  });

  base('login page loads within acceptable time', async ({ page }) => {
    const timing = await measureTiming(page, '/auth/login');
    console.log(`PERF: ${timing.route} — TTFB: ${timing.ttfb}ms, DCL: ${timing.domContentLoaded}ms, Load: ${timing.load}ms`);
    expect(timing.load).toBeLessThan(10_000);
  });
});
