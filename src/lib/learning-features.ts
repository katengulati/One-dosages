const retiredSlugs = new Set([
  'peptide-explorer', 'explorador-peptidos', 'break-room', 'sala-de-descanso',
  'peptide-drop', 'peptide-sort', 'peptide-slice'
]);

export function isRetiredLearningPage(path: string) {
  try {
    const slug = new URL(path, 'https://peptidedosages.com').pathname.split('/').filter(Boolean).at(-1);
    return slug !== undefined && retiredSlugs.has(slug);
  } catch {
    return false;
  }
}

function videoTitle(spanish: boolean) {
  return spanish ? 'Reconstitución de péptidos' : 'Peptide Reconstitution';
}

function videoBlock(spanish: boolean, standalone = false) {
  const lang = spanish ? 'es' : 'en';
  const tag = standalone ? 'h1' : 'h2';
  const title = videoTitle(spanish);
  const description = spanish
    ? 'Aprende los conceptos básicos con viales de One Aminos.'
    : 'Learn the basics with One Aminos vials.';
  const media = '/one-aminos/reconstitution';
  return `<section class="oa-reconstitution" aria-labelledby="oa-reconstitution-title">
    <${tag} id="oa-reconstitution-title">${title}</${tag}>
    <p>${description}</p>
    <video controls playsinline preload="metadata" width="1280" height="720" poster="${media}/poster-${lang}.webp" aria-label="${title}">
      <source src="${media}/reconstitution-${lang}.mp4" type="video/mp4">
      <track src="${media}/captions-${lang}.vtt" kind="captions" srclang="${lang}" label="${spanish ? 'Español' : 'English'}">
      <a href="${media}/reconstitution-${lang}.mp4">${spanish ? 'Abrir el video' : 'Open the video'}</a>
    </video>
  </section>`;
}

export function applyLearningFeatures(html: string, spanish: boolean) {
  const local = html.includes('href="/en/dosages/"') ? '/en/' : '/';
  const videoHref = spanish ? '/es/preparacion-peptidos/' : `${local}peptide-prep/`;
  const watch = spanish ? 'Ver el video de reconstitución' : 'Watch the reconstitution video';
  const description = spanish
    ? 'Descubre la dosis, la frecuencia y la reconstitución de cada vial.'
    : 'Find out the dose, frequency, and reconstitution details for each vial.';

  return html
    .replace(/<section\b[^>]*\bid="(?:peptide-explorer-home|play-peptide-drop)"[^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<section\b[^>]*>((?:(?!<section\b|<\/section>)[\s\S])*?class="why-section"[\s\S]*?)<\/section>/gi, '')
    .replace(/<li\b[^>]*>(?:(?!<li\b|<\/li>)[\s\S])*<\/li>/gi, (item) => {
      const href = item.match(/<a\b[^>]*\bhref="([^"]+)"/i)?.[1];
      return href && isRetiredLearningPage(href) ? '' : item;
    })
    .replace(/<a\b[^>]*\bhref="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi, (link, href: string) =>
      isRetiredLearningPage(href) ? '' : link)
    .replace(/<main\b[^>]*\bclass="pd-prep-page"[^>]*>[\s\S]*?<\/main>/gi, () =>
      `<main id="main-content" tabindex="-1">${videoBlock(spanish, true)}</main>`)
    .replace(/<section\b[^>]*\bid="peptide-prep-simulator"[^>]*>[\s\S]*?<\/section>/gi, () =>
      `<div id="peptide-prep-simulator">${videoBlock(spanish)}</div>`)
    .replace(/<section\b[^>]*\bid="peptide-prep"[^>]*>[\s\S]*?<\/section>/gi, () =>
      `<section class="section oa-protocol-video" id="peptide-prep">
        <header class="section-head"><h2>${videoTitle(spanish)}</h2></header>
        <div class="section-body"><a class="oa-solid-link" href="${videoHref}">${watch}</a></div>
      </section>`)
    .replace(/<p class="pdmg-prep-section__intro">[\s\S]*?<\/p>/gi, () =>
      spanish ? '<p>Aprende los conceptos básicos con viales de One Aminos.</p>'
        : '<p>Learn the basics with One Aminos vials.</p>')
    .replace(/<div\b[^>]*\bclass="pd-prep-embed"[^>]*>\s*<iframe\b[\s\S]*?<\/iframe>[\s\S]*?<\/div>/gi, () =>
      `<a class="oa-solid-link" href="${videoHref}">${watch}</a>`)
    .replace(/(<section\b[^>]*\bid="featured-protocols"[^>]*>\s*<h2>[\s\S]*?<\/h2>\s*)<p>[\s\S]*?<\/p>/gi,
      (_, heading: string) => `${heading}<p>${description}</p>`)
    .replace(/<script\b[^>]*\bid="(?:pd-peptide-prep-integration-js|pd-protocol-explorer-embed-js)"[^>]*>\s*<\/script>\s*/gi, '')
    .replace(/Peptide Reconstitution Simulator|Simulador de reconstitución de péptidos/gi, () => `${videoTitle(spanish)}${spanish ? ' en video' : ' Video'}`);
}
