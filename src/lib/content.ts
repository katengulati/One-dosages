import fs from "node:fs";
import path from "node:path";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

/**
 * One page of content in one language, stored at content/<locale>/<key>.json.
 * `key` is shared by every language version of the same page (it is the
 * original English URL path, with "/" replaced by "__"), so pages can be
 * matched across languages even when their slugs differ.
 */
export type ContentEntry = {
  key: string;
  slug: string; // URL path without leading/trailing slash, e.g. "dosis-peptidos/bpc-157"
  type: "page" | "post" | "category";
  title: string;
  description?: string;
  html: string;
  category?: string;
  updated?: string;
};

export type ResolvedContent = ContentEntry & {
  locale: Locale;
  /** True when the requested language is missing and English is shown instead. */
  fallback: boolean;
};

/** Pages rendered by React components rather than content files. */
export const builtinRoutes = {
  home: { en: "", es: "" },
  calculator: { en: "calculator", es: "calculadora" },
  dosages: { en: "dosages", es: "dosis" },
  blog: { en: "blog", es: "blog" },
} as const satisfies Record<string, Record<Locale, string>>;

export type BuiltinKey = keyof typeof builtinRoutes;

const CONTENT_DIR = path.join(process.cwd(), "content");

let cache: Record<Locale, ContentEntry[]> | null = null;

function loadAll(): Record<Locale, ContentEntry[]> {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const result = {} as Record<Locale, ContentEntry[]>;
  for (const locale of locales) {
    const dir = path.join(CONTENT_DIR, locale);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
    result[locale] = files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as ContentEntry);
  }
  cache = result;
  return result;
}

export function getEntries(locale: Locale): ResolvedContent[] {
  const all = loadAll();
  const own = new Map(all[locale].map((e) => [e.key, e]));
  const out: ResolvedContent[] = [];
  for (const e of all[defaultLocale]) {
    const translated = own.get(e.key);
    out.push(translated ? { ...translated, locale, fallback: false } : { ...e, locale, fallback: locale !== defaultLocale });
  }
  // Pages that exist only in this language.
  for (const e of all[locale]) {
    if (!all[defaultLocale].some((d) => d.key === e.key)) out.push({ ...e, locale, fallback: false });
  }
  return out;
}

export function findBySlug(locale: Locale, slug: string): ResolvedContent | undefined {
  return getEntries(locale).find((e) => e.slug === slug);
}

export function findBuiltin(locale: Locale, slug: string): BuiltinKey | undefined {
  return (Object.keys(builtinRoutes) as BuiltinKey[]).find((k) => builtinRoutes[k][locale] === slug);
}

export function hrefFor(locale: Locale, slug: string): string {
  return slug ? `/${locale}/${slug}/` : `/${locale}/`;
}

export function builtinHref(locale: Locale, key: BuiltinKey): string {
  return hrefFor(locale, builtinRoutes[key][locale]);
}

/**
 * For every URL on the site, the matching URL in each language.
 * Used by the language switcher and for hreflang tags.
 */
export function getAlternatesMap(): Record<string, Record<Locale, string>> {
  const map: Record<string, Record<Locale, string>> = {};
  const add = (alts: Record<Locale, string>) => {
    for (const l of locales) map[alts[l]] = alts;
  };
  for (const k of Object.keys(builtinRoutes) as BuiltinKey[]) {
    add(Object.fromEntries(locales.map((l) => [l, builtinHref(l, k)])) as Record<Locale, string>);
  }
  const byLocale = Object.fromEntries(locales.map((l) => [l, new Map(getEntries(l).map((e) => [e.key, e]))]));
  for (const e of getEntries(defaultLocale)) {
    add(Object.fromEntries(locales.map((l) => [l, hrefFor(l, byLocale[l].get(e.key)!.slug)])) as Record<Locale, string>);
  }
  return map;
}

export function alternatesFor(href: string) {
  return getAlternatesMap()[href];
}
