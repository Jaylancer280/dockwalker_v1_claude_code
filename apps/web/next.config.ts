import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const isCapacitorBuild = process.env.CAPACITOR_BUILD === '1';

const nextConfig: NextConfig = {
  ...(isCapacitorBuild
    ? {
        output: 'export',
        typescript: { ignoreBuildErrors: true },
        eslint: { ignoreDuringBuilds: true },
      }
    : {}),
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
