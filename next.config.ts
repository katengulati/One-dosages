import type { NextConfig } from 'next';

// One value per build: appended to the design stylesheet and scripts so a new deploy
// is picked up immediately even though static files are browser-cached.
const assetVersion = process.env.VERCEL_DEPLOYMENT_ID ?? String(Date.now());

const config: NextConfig = {
  env: { OA_ASSET_VERSION: assetVersion },
  trailingSlash: true,
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingIncludes: { '/*': ['./site/**/*', './search-template.html', './search-corpus.json', './search-corpus.es.json', './capture.json'] },
  async headers() {
    // Static theme and design files: a short browser cache instead of re-checking every
    // file on every navigation. Ten minutes keeps post-deploy staleness small.
    const assetCache = [{ key: 'Cache-Control', value: 'public, max-age=600, stale-while-revalidate=86400' }];
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Referrer-Policy', value: 'same-origin' }
      ]
    },
    ...(process.env.NODE_ENV === 'production'
      ? ['/assets/:path*', '/one-aminos/:path*', '/sim-vials/:path*', '/sim-thumbs/:path*', '/data/:path*', '/preview/forms.js']
        .map((source) => ({ source, headers: assetCache }))
        // Images are only ever replaced under a new file name, so they can stay cached for a week.
        .concat([{ source: '/media/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] }])
      : [])];
  }
};

export default config;
