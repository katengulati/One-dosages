import type { CheerioAPI } from 'cheerio/slim';
import locales from '../../site/manifest.json';

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

const featuredTopics = {
  metabolism: { en: 'Weight Loss and Metabolism Guide', es: 'Guía de pérdida de peso y metabolismo' },
  recovery: { en: 'Healing and Recovery Peptide Guide', es: 'Guía de péptidos para reparación y recuperación' },
  skinRecovery: { en: 'Skin and Recovery Research Guide', es: 'Guía de investigación sobre piel y recuperación' },
  cellularEnergy: { en: 'Cellular Energy Research Guide', es: 'Guía de investigación sobre energía celular' },
  growthHormone: { en: 'Growth Hormone Research Guide', es: 'Guía de investigación sobre la hormona del crecimiento' },
  skin: { en: 'Skin Research Guide', es: 'Guía de investigación sobre la piel' }
} as const;

const existingFeaturedTopics = [
  ['glow-peptide-', 'skinRecovery'],
  ['klow-', 'recovery'],
  ['mots-c-', 'cellularEnergy'],
  ['tesamorelin-', 'growthHormone'],
  ['nad-', 'cellularEnergy'],
  ['ghk-cu-', 'skin']
] as const;

const featuredProtocols = [
  {
    name: 'Retatrutide',
    alias: 'GLP3-RT',
    topic: 'metabolism',
    strengths: [
      [10, 'single-peptide-dosages__retatrutide-10-mg-vial-dosage-protocol'],
      [20, 'single-peptide-dosages__retatrutide-20-mg-vial-dosage-protocol'],
      [30, 'single-peptide-dosages__retatrutide-30-mg-vial-dosage-protocol']
    ]
  },
  {
    name: 'Tirzepatide',
    alias: 'GLP2-TZ',
    topic: 'metabolism',
    strengths: [
      [10, 'single-peptide-dosages__tirzepatide-10-mg-vial-dosage-protocol'],
      [30, 'single-peptide-dosages__tirzepatide-30-mg-vial-dosage-protocol'],
      [60, 'single-peptide-dosages__tirzepatide-60-mg-vial-dosage-protocol']
    ]
  },
  {
    name: 'BPC-157 + TB-500',
    alias: 'Wolverine',
    topic: 'recovery',
    strengths: [[20, 'peptide-blend-dosages__bpc-157-tb-500-20mg-blend-dosage-protocol']]
  }
] as const;

export function applyHomePresentation($: CheerioAPI, pathname: string) {
  const home = $('body.pdhome-studio #main-content');
  if (!home.length) return;
  home.find(':is(.section-block, .extra-cta-section, .calc-intro-section, .oa-reconstitution) > h2 + p, #peptide-calculator > h3 + p').remove();
  home.find('.extra-cta-buttons a').removeAttr('style');

  const grid = $('#featured-protocols .home-card-grid');
  if (!grid.length) return;
  const lang = pathname.startsWith('/es/') ? 'es' : 'en';
  const prefixed = pathname !== '/';
  grid.children('.home-card').each((_, element) => {
    const card = $(element);
    const links = card.find('.dose-links a');
    const href = links.first().attr('href') ?? '';
    if (/bpc-157-tb-500|retatrutide|tirzepatide|cjc-1295-no-dac-ipamorelin/.test(href)) {
      card.remove();
      return;
    }
    const topic = existingFeaturedTopics.find(([slug]) => href.includes(slug))?.[1];
    if (topic) card.children('p').text(featuredTopics[topic][lang]);
    links.each((_, link) => {
      const anchor = $(link);
      const strength = anchor.text().match(/\d+\s*mg/i)?.[0];
      if (strength) anchor.text(strength);
    });
  });
  const cards = featuredProtocols.map((protocol) => {
    const title = `${protocol.name} (${protocol.alias})`;
    const links = protocol.strengths.map(([mg, key]) => {
      const localized = locales[key][lang];
      return $('<a></a>').attr({
        href: prefixed ? localized : localized.replace(/^\/en/, ''),
        'aria-label': `${title}, ${mg} mg`
      }).text(`${mg} mg`);
    });
    return $('<article class="home-card"></article>').append(
      $('<h3></h3>').text(title),
      $('<p></p>').text(featuredTopics[protocol.topic][lang]),
      $('<div class="dose-links"></div>').append(...links)
    );
  });
  grid.prepend(...cards);
  grid.children('.home-card').each((_, card) => {
    $(card).children('h3, p').wrapAll('<div class="oa-featured-card-heading"></div>');
  });
}

function demoTitle(spanish: boolean) {
  return spanish ? 'Demostración de reconstitución' : 'Peptide Reconstitution Demo';
}

function demoBlock(spanish: boolean, standalone = false) {
  const lang = spanish ? 'es' : 'en';
  const tag = standalone ? 'h1' : 'h2';
  const title = demoTitle(spanish);
  return `<section class="oa-reconstitution" aria-labelledby="oa-reconstitution-title">
    <${tag} id="oa-reconstitution-title">${title}</${tag}>
    <iframe class="oa-reconstitution-demo" src="/one-aminos/reconstitution/demo.html?lang=${lang}" title="${title}"${standalone ? '' : ' loading="lazy"'}></iframe>
  </section>`;
}

function chartGuide(spanish: boolean, local: string) {
  const copy = spanish ? {
    title: 'Cómo leer una tabla de dosificación',
    steps: [
      ['Encuentra tu vial', 'Busca en la tabla el mismo péptido y la cantidad en mg de la etiqueta.', '/es/tabla-dosificacion-peptidos/', 'Abrir la tabla'],
      ['Revisa la concentración', 'Los mg/mL indican cuánto péptido hay en cada mL de líquido.', '/es/guia-reconstitucion-peptidos/', 'Guía de reconstitución'],
      ['Lee las unidades', 'Los mg y mcg indican la cantidad de péptido. Los mL indican el volumen de líquido.', '/es/guia-medicion-jeringa/', 'Guía de unidades de jeringa'],
      ['Verifica el COA', 'Busca el lote de tu vial en el certificado de análisis. Revisa la identidad, la pureza y la cantidad.', '/es/como-leer-un-coa/', 'Cómo leer un COA']
    ]
  } : {
    title: 'How to Read a Dosage Chart',
    steps: [
      ['Find your vial', 'Match the peptide name and the mg on the label to the chart.', `${local}peptide-dosage-chart/`, 'Open the chart'],
      ['Check the concentration', 'The mg/mL number tells you how much peptide is in each mL of liquid.', `${local}reconstitution-guide-peptides/`, 'Reconstitution guide'],
      ['Read the units', 'mg and mcg measure peptide amount. mL measures liquid volume.', `${local}syringe-measurement-guide/`, 'Syringe unit guide'],
      ['Verify the COA', 'Match the lot on your vial to its certificate of analysis. Check the identity, purity and amount reported.', `${local}how-to-read-a-coa/`, 'How to read a COA']
    ]
  };

  return `<section class="section-block pdhome-chart-guide" id="how-to-read-peptide-dosage-charts">
    <h2>${copy.title}</h2>
    <div class="pdhome-guide-grid">
      ${copy.steps.map(([title, description, href, label]) => `<article class="pdhome-guide-step">
        <h3>${title}</h3><p>${description}</p>
        ${href ? `<a class="oa-solid-link" href="${href}">${label}</a>` : ''}
      </article>`).join('')}
    </div>
  </section>`;
}

export function applyLearningFeatures(html: string, spanish: boolean) {
  const local = html.includes('href="/en/dosages/"') ? '/en/' : '/';
  const demoHref = spanish ? '/es/preparacion-peptidos/' : `${local}peptide-prep/`;
  const watch = spanish ? 'Ver la demostración' : 'Watch the reconstitution demo';

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
    .replace(/<p class="pdmg-prep-section__intro">[\s\S]*?<\/p>/gi, '')
    .replace(/<div\b[^>]*\bclass="pd-prep-embed"[^>]*>\s*<iframe\b[\s\S]*?<\/iframe>[\s\S]*?<\/div>/gi, () =>
      `<a class="oa-solid-link" href="${demoHref}">${watch}</a>`)
    .replace(/<script\b[^>]*\bid="(?:pd-peptide-prep-integration-js|pd-protocol-explorer-embed-js)"[^>]*>\s*<\/script>\s*/gi, '')
    .replace(/Peptide Reconstitution Simulator|Simulador de reconstitución de péptidos/gi, () => demoTitle(spanish));
}
