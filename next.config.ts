import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: false,

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 3600,
    remotePatterns: [
      { protocol: 'https', hostname: 'kalshi-public-docs.s3.amazonaws.com' },
      { protocol: 'https', hostname: 'polymarket.com' },
      { protocol: 'https', hostname: '*.polymarket.com' },
      { protocol: 'https', hostname: 'clob.polymarket.com' },
    ],
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion', '@supabase/supabase-js'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/api/markets',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=30, stale-while-revalidate=60' },
        ],
      },
      {
        source: '/api/markets/trending',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=10, stale-while-revalidate=30' },
        ],
      },
    ];
  },
};

// Wrap Next.js config with Sentry only if configured
const isSentryConfigured = 
  process.env.SENTRY_ORG && 
  process.env.SENTRY_PROJECT && 
  process.env.NEXT_PUBLIC_SENTRY_DSN;

// Export the config - conditionally wrap with Sentry if configured
export default isSentryConfigured
  ? withSentryConfig(nextConfig, {
      // For all available options, see:
      // https://github.com/getsentry/sentry-webpack-plugin#options

      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,

      // Only print logs for uploading source maps in CI
      silent: !process.env.CI,

      // For all available options, see:
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

      // Upload a larger set of source maps for prettier stack traces (increases build time)
      widenClientFileUpload: true,

      // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
      // This can increase your server load as well as your hosting bill.
      // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
      // side errors will fail.
      tunnelRoute: "/monitoring",

      // Source maps configuration
      sourcemaps: {
        disable: false,
      },

      // Automatically tree-shake Sentry logger statements to reduce bundle size
      disableLogger: true,

      // Enables automatic instrumentation of Vercel Cron Monitors.
      // See the following for more information:
      // https://docs.sentry.io/product/crons/
      // https://vercel.com/docs/cron-jobs
      automaticVercelMonitors: true,
    })
  : nextConfig;
