import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import {
  builtinRoutes,
  findBuiltin,
  findBySlug,
  getEntries,
  hrefFor,
  type BuiltinKey,
} from "@/lib/content";
import { languageAlternates } from "@/lib/seo";
import { Calculator } from "@/components/Calculator";

type Params = Promise<{ locale: string; slug: string[] }>;

export function generateStaticParams() {
  return locales.flatMap((locale) => [
    ...(Object.keys(builtinRoutes) as BuiltinKey[])
      .filter((k) => k !== "home")
      .map((k) => ({ locale, slug: builtinRoutes[k][locale].split("/") })),
    ...getEntries(locale).map((e) => ({ locale, slug: e.slug.split("/") })),
  ]);
}

function resolve(locale: Locale, slugParts: string[]) {
  const slug = slugParts.map(decodeURIComponent).join("/");
  const builtin = findBuiltin(locale, slug);
  if (builtin) return { kind: "builtin" as const, builtin, slug };
  const entry = findBySlug(locale, slug);
  if (entry) return { kind: "content" as const, entry, slug };
  return null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const r = resolve(locale, slug);
  if (!r) return {};
  const t = getDictionary(locale);
  const alternates = languageAlternates(hrefFor(locale, r.slug));
  if (r.kind === "builtin") {
    const title = r.builtin === "calculator" ? t.calculator.title : t.nav[r.builtin as "dosages" | "blog"];
    return { title, alternates };
  }
  return { title: r.entry.title, description: r.entry.description, alternates };
}

export default async function Page({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const r = resolve(locale, slug);
  if (!r) notFound();
  const t = getDictionary(locale);

  if (r.kind === "builtin") {
    if (r.builtin === "calculator") {
      return (
        <article>
          <h1>{t.calculator.title}</h1>
          <p className="lead">{t.calculator.intro}</p>
          <Calculator t={t.calculator} locale={locale} />
          <p className="research">{t.site.researchOnly}</p>
        </article>
      );
    }
    const type = r.builtin === "blog" ? "post" : "page";
    const items = getEntries(locale).filter((e) => e.type === type);
    return (
      <section>
        <h1>{r.builtin === "blog" ? t.nav.blog : t.listing.allDosages}</h1>
        {items.length === 0 ? (
          <p>{t.listing.empty}</p>
        ) : (
          <ul className="cards">
            {items.map((e) => (
              <li key={e.key}>
                <Link href={hrefFor(locale, e.slug)}>{e.title}</Link>
                {e.description && <p>{e.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const { entry } = r;
  return (
    <article className="content">
      {entry.fallback && <p className="notice">{t.page.notTranslated}</p>}
      <h1>{entry.title}</h1>
      {entry.updated && (
        <p className="meta">
          {t.page.updated}:{" "}
          {new Date(entry.updated).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })}
        </p>
      )}
      <div lang={entry.fallback ? "en" : undefined} dangerouslySetInnerHTML={{ __html: entry.html }} />
    </article>
  );
}
