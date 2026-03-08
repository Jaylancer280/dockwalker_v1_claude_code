#!/usr/bin/env node
// Cross-platform Capacitor build wrapper.
// Sets CAPACITOR_BUILD=1 so next.config.ts enables static export,
// then runs `next build` followed by `npx cap sync`.

import { execSync } from 'node:child_process';

const env = { ...process.env, CAPACITOR_BUILD: '1' };

try {
  console.log('Building Next.js in static export mode...');
  execSync('npx next build', { stdio: 'inherit', env });

  console.log('Syncing Capacitor...');
  execSync('npx cap sync', { stdio: 'inherit', env });

  console.log('Capacitor build complete.');
} catch {
  process.exit(1);
}
