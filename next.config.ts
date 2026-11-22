import type { NextConfig } from 'next';

const config: NextConfig = {
  trailingSlash: true,
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingIncludes: { '/*': ['./site/**/*', './search-template.html', './search-corpus.json', './capture.json'] },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Referrer-Policy', value: 'same-origin' }
      ]
    }];
  }
};

export default config;
