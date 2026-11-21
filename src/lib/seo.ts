import { defaultLocale, localeTags, locales } from "@/i18n/config";
import { alternatesFor } from "./content";

/** canonical + hreflang links for a page, so search engines pair the languages. */
export function languageAlternates(href: string) {
  const alts = alternatesFor(href);
  if (!alts) return { canonical: href };
  const languages: Record<string, string> = {};
  for (const l of locales) languages[localeTags[l]] = alts[l];
  languages["x-default"] = alts[defaultLocale];
  return { canonical: href, languages };
}
