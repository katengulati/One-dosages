import code from '@/generated/asset-code.json';
import index from '@/generated/asset-index.json';

// One stylesheet or script per run of former WordPress assets, e.g. /bundle/3.1a.f-<version>.css.
// The version is a hash of every file's code, so a bundle URL never changes content and
// can be cached forever at the edge and in the browser.
export const runtime = 'nodejs';

const types = { css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8' } as const;

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const match = file.match(/^([0-9a-z]+(?:\.[0-9a-z]+)*)-([0-9a-f]{10})\.(css|js)$/);
  if (!match || match[2] !== index.version) return new Response('Not found', { status: 404 });
  const ids = match[1].split('.').map((id) => Number.parseInt(id, 36));
  if (ids.some((id) => !(id >= 0 && id < code.length))) return new Response('Not found', { status: 404 });
  const type = match[3] as keyof typeof types;
  return new Response(ids.map((id) => code[id]).join('\n'), {
    headers: {
      'Content-Type': types[type],
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}
