import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  ...(process.env.CAPACITOR_BUILD === '1' ? { output: 'export' } : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: '1mb',
    },
  },
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    })
  : nextConfig;
