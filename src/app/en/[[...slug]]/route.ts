import { allPaths, findPage, renderPage } from "@/lib/site";

import { applyOneAminosDesign } from "@/lib/one-aminos-design";

export const dynamic = "force-static";
export const dynamicParams = false;

const locale = "en";

export function generateStaticParams() {
  return allPaths().filter((path) => path.locale === locale).map((path) => ({ slug: path.slug }));
}

export async function GET(_request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await context.params;
  const canonicalPath = [locale, ...slug].join("/");
  const key = findPage(locale, `/${canonicalPath}/`);
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(applyOneAminosDesign(renderPage(locale, key)), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
