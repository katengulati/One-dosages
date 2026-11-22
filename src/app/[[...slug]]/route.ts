import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderSearch } from '@/lib/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const site = join(process.cwd(), 'site', 'replica');
const liveSite = 'https://peptidedosages.com';
const liveRoutes = new Set(['peptide-drop', 'peptide-slice', 'peptide-sort', 'account', 'wp-login.php']);
const policy = [
  "default-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://peptidedosages.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' https://peptidedosages.com",
  "frame-ancestors 'self'",
  "worker-src 'self' blob:",
  "media-src 'self' data: blob:"
].join('; ');

function page(body: string) {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': policy,
      'Cache-Control': 'no-cache'
    }
  });
}

export async function GET(request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await context.params;
  const url = new URL(request.url);
  if (slug.length === 0 && url.searchParams.has('s')) {
    const query = (url.searchParams.get('s') ?? '').trim().slice(0, 160);
    const requestedPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
    return page(await renderSearch(query, Math.max(1, Math.min(100, requestedPage || 1))));
  }
  const [route] = slug;
  if (slug.length === 1 && liveRoutes.has(route)) {
    return Response.redirect(liveSite + url.pathname + url.search, 302);
  }
  if (slug.length === 1 && route === 'peptide-dosage-calculator') {
    return new Response(null, { status: 302, headers: { Location: '/calculator/' } });
  }
  if (!slug.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) {
    return new Response('Page not found', { status: 404 });
  }
  try {
    return page(await readFile(join(site, ...slug, 'index.html'), 'utf8'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    return new Response('Page not found', { status: 404 });
  }
}
