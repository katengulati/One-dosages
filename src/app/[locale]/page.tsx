import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { builtinHref, getEntries, hrefFor } from "@/lib/content";
import { languageAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { alternates: languageAlternates(builtinHref(locale, "home")) };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const latest = getEntries(locale).filter((e) => e.type !== "category").slice(0, 6);

  return (
    <>
      <section className="hero">
        <h1>{t.home.title}</h1>
        <p>{t.home.intro}</p>
        <div className="actions">
          <Link className="btn primary" href={builtinHref(locale, "calculator")}>{t.home.ctaCalculator}</Link>
          <Link className="btn" href={builtinHref(locale, "dosages")}>{t.home.ctaDosages}</Link>
        </div>
      </section>
      {latest.length > 0 && (
        <section>
          <h2>{t.home.latest}</h2>
          <ul className="cards">
            {latest.map((e) => (
              <li key={e.key}>
                <Link href={hrefFor(locale, e.slug)}>{e.title}</Link>
                {e.description && <p>{e.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
