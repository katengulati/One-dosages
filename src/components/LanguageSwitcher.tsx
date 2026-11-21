"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALE_COOKIE, localeNames, locales, type Locale } from "@/i18n/config";

type Props = {
  locale: Locale;
  label: string;
  /** URL → the same page's URL in every language. */
  alternates: Record<string, Record<Locale, string>>;
};

export function LanguageSwitcher({ locale, label, alternates }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  function change(next: Locale) {
    // Remember the choice for a year so the root URL sends people back to it.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
    router.push(alternates[normalized]?.[next] ?? `/${next}/`);
  }

  return (
    <label className="lang-switch">
      <span className="visually-hidden">{label}</span>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
      </svg>
      <select value={locale} onChange={(e) => change(e.target.value as Locale)} aria-label={label}>
        {locales.map((l) => (
          <option key={l} value={l}>
            {localeNames[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
