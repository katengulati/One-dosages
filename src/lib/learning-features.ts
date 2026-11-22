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

function demoTitle(spanish: boolean) {
  return spanish ? 'Demostración de reconstitución' : 'Peptide Reconstitution Demo';
}

function demoBlock(spanish: boolean, standalone = false) {
  const lang = spanish ? 'es' : 'en';
  const tag = standalone ? 'h1' : 'h2';
  const title = demoTitle(spanish);
  const description = spanish
    ? 'Mira los pasos con viales de One Aminos.'
    : 'Watch each step with One Aminos vials.';
  return `<section class="oa-reconstitution" aria-labelledby="oa-reconstitution-title">
    <${tag} id="oa-reconstitution-title">${title}</${tag}>
    <p>${description}</p>
    <iframe class="oa-reconstitution-demo" src="/one-aminos/reconstitution/demo.html?lang=${lang}" title="${title}"${standalone ? '' : ' loading="lazy"'}></iframe>
  </section>`;
}

function chartGuide(spanish: boolean, local: string) {
  const copy = spanish ? {
    title: 'Cómo leer una tabla de dosificación',
    steps: [
      ['Revisa el vial', 'Usa la tabla del mismo péptido y la misma cantidad en mg que figuran en la etiqueta.'],
      ['Revisa la concentración', 'Divide los mg del vial entre los mL finales de líquido para obtener los mg/mL.', 'Ver la guía de reconstitución'],
      ['Entiende las unidades', 'Los mg y mcg indican la cantidad de péptido. Los mL indican el volumen de líquido. En una jeringa U-100, 100 unidades equivalen a 1 mL.'],
      ['Revisa la fuente y la frecuencia', 'Identifica si la tabla cita un estudio, un ejemplo o un informe de la comunidad. Revisa la frecuencia que indica la tabla.']
    ],
    reconstitutionHref: '/es/guia-reconstitucion-peptidos/',
    links: [['/es/tabla-dosificacion-peptidos/', 'Ver la tabla completa'], ['/es/guia-medicion-jeringa/', 'Entender las unidades de jeringa']]
  } : {
    title: 'How to Read a Dosage Chart',
    steps: [
      ['Match your vial', 'Use the chart for the peptide and the amount in mg printed on the label.'],
      ['Check the concentration', 'Divide the mg in the vial by the final mL of liquid to get mg/mL.', 'Read the reconstitution guide'],
      ['Know what the units mean', 'Peptide amount is measured in mg or mcg. Liquid volume is measured in mL. On a U-100 syringe, 100 units = 1 mL.'],
      ['Check the source and schedule', 'Look for a study, a worked example, or a community report. Check how often the schedule repeats.']
    ],
    reconstitutionHref: `${local}reconstitution-guide-peptides/`,
    links: [[`${local}peptide-dosage-chart/`, 'View the full chart'], [`${local}syringe-measurement-guide/`, 'Understand syringe units']]
  };

  return `<section class="section-block pdhome-chart-guide" id="how-to-read-peptide-dosage-charts">
    <h2>${copy.title}</h2>
    <div class="pdhome-guide-grid">
      ${copy.steps.map(([title, description, link]) => `<article class="pdhome-guide-step"><div>
        <h3>${title}</h3><p>${description}${link ? ` <a href="${copy.reconstitutionHref}">${link}</a>.` : ''}</p>
      </div></article>`).join('')}
    </div>
    <div class="pdhome-inline-actions">
      ${copy.links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
    </div>
  </section>`;
}

export function applyLearningFeatures(html: string, spanish: boolean) {
  const local = html.includes('href="/en/dosages/"') ? '/en/' : '/';
  const demoHref = spanish ? '/es/preparacion-peptidos/' : `${local}peptide-prep/`;
  const watch = spanish ? 'Ver la demostración' : 'Watch the reconstitution demo';
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
      `<main id="main-content" tabindex="-1">${demoBlock(spanish, true)}</main>`)
    .replace(/<section\b[^>]*\bid="peptide-prep-simulator"[^>]*>[\s\S]*?<\/section>/gi, () =>
      `<div id="peptide-prep-simulator">${demoBlock(spanish)}</div>`)
    .replace(/<section\b[^>]*\bid="how-to-read-peptide-dosage-charts"[^>]*>[\s\S]*?<\/section>/gi, () =>
      chartGuide(spanish, local))
    .replace(/<section\b[^>]*\bid="peptide-prep"[^>]*>[\s\S]*?<\/section>/gi, () =>
      `<section class="section oa-protocol-demo" id="peptide-prep">
        <header class="section-head"><h2>${demoTitle(spanish)}</h2></header>
        <div class="section-body"><a class="oa-solid-link" href="${demoHref}">${watch}</a></div>
      </section>`)
    .replace(/<p class="pdmg-prep-section__intro">[\s\S]*?<\/p>/gi, () =>
      spanish ? '<p>Mira los pasos con viales de One Aminos.</p>'
        : '<p>Watch each step with One Aminos vials.</p>')
    .replace(/<div\b[^>]*\bclass="pd-prep-embed"[^>]*>\s*<iframe\b[\s\S]*?<\/iframe>[\s\S]*?<\/div>/gi, () =>
      `<a class="oa-solid-link" href="${demoHref}">${watch}</a>`)
    .replace(/(<section\b[^>]*\bid="featured-protocols"[^>]*>\s*<h2>[\s\S]*?<\/h2>\s*)<p>[\s\S]*?<\/p>/gi,
      (_, heading: string) => `${heading}<p>${description}</p>`)
    .replace(/<script\b[^>]*\bid="(?:pd-peptide-prep-integration-js|pd-protocol-explorer-embed-js)"[^>]*>\s*<\/script>\s*/gi, '')
    .replace(/Peptide Reconstitution Simulator|Simulador de reconstitución de péptidos/gi, () => demoTitle(spanish));
}
