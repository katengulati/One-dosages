import type { Locale } from '@/i18n/config';

export const lipoReferenceTitles = {
  'lipo-c': 'Lipo C',
  'lipo-c-b12': 'Lipo C + B12',
  'lipo-c-fat-blaster': 'Lipo C Fat Blaster'
} as const;

type Reference = keyof typeof lipoReferenceTitles;

export function isLipoReference(key: string): key is Reference {
  return Object.hasOwn(lipoReferenceTitles, key);
}

export function renderLipoReference(shell: string, key: Reference, locale: Locale, prefix = `/${locale}/`) {
  const spanish = locale === 'es';
  const hub = key === 'lipo-c';
  const title = lipoReferenceTitles[key];
  const description = hub
    ? (spanish ? 'Consulta las dos fórmulas de Lipo C que figuran en el catálogo de One Aminos.'
      : 'Explore the two Lipo C formulations listed in the One Aminos catalog.')
    : (spanish ? 'La biblioteca no dispone de un protocolo de preparación o dosificación para esta fórmula.'
      : 'The research library has no preparation or dosing protocol for this formulation.');
  const links = hub
    ? Object.entries(lipoReferenceTitles).filter(([slug]) => slug !== key).map(([slug, label]) =>
      `<a class="oa-solid-link" href="${prefix}${slug}/">${label}</a>`).join('')
    : `<a href="${prefix}lipo-c/">${spanish ? 'Todas las referencias de Lipo C' : 'All Lipo C references'}</a>`;
  return shell
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<main\b[^>]*>[\s\S]*?<\/main>/i, `<main id="main-content">
      <article class="oa-lipo-reference">
        <header><h1>${title}</h1><p>${description}</p></header>
        <div class="oa-lipo-links">${links}</div>
      </article>
    </main>`);
}
