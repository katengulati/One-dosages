import type { Locale } from "./config";
import en from "./dictionaries/en.json";
import es from "./dictionaries/es.json";

export type Dictionary = typeof en;

// `satisfies` makes the build fail if es.json is missing a key that en.json has.
const dictionaries = { en, es: es satisfies Dictionary } as const;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
