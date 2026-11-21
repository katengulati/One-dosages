import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localeTags, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { builtinHref, getAlternatesMap } from "@/lib/content";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: t.site.name, template: `%s | ${t.site.name}` },
    description: t.site.tagline,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale as Locale);

  return (
    <html lang={localeTags[locale]}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="wrap header-inner">
            <Link href={builtinHref(locale, "home")} className="brand">
              {t.site.name}
            </Link>
            <nav aria-label={t.nav.menu}>
              <ul>
                <li><Link href={builtinHref(locale, "dosages")}>{t.nav.dosages}</Link></li>
                <li><Link href={builtinHref(locale, "calculator")}>{t.nav.calculator}</Link></li>
                <li><Link href={builtinHref(locale, "blog")}>{t.nav.blog}</Link></li>
              </ul>
            </nav>
            <LanguageSwitcher locale={locale} label={t.nav.language} alternates={getAlternatesMap()} />
          </div>
        </header>
        <main id="main" className="wrap">
          {children}
        </main>
        <footer className="site-footer">
          <div className="wrap">
            <p className="research">{t.site.researchOnly}</p>
            <p>{t.footer.disclaimer}</p>
            <p>
              © {new Date().getFullYear()} {t.site.name}. {t.footer.rights}
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
