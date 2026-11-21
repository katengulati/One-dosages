import { isLocale } from "@/i18n/config";
import { allPaths, findPage, renderPage } from "@/lib/site";

// Every page is pre-rendered at build time; unknown URLs return 404.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return allPaths();
}

export async function GET(_req: Request, { params }: { params: Promise<{ locale: string; slug?: string[] }> }) {
  const { locale, slug = [] } = await params;
  if (!isLocale(locale)) return new Response("Not found", { status: 404 });
  const urlPath = `/${[locale, ...slug.map(decodeURIComponent)].join("/")}/`;
  const key = findPage(locale, urlPath);
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(renderPage(locale, key), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
