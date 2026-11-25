import type { CheerioAPI } from 'cheerio/slim';
import locales from '../../site/manifest.json';
import { readingSummaries } from './reading-summaries';

const guideKeys = [
  'beginners-guide-peptides',
  'reconstitution-guide-peptides',
  'syringe-measurement-guide',
  'peptide-storage-guide'
] as const;

const guidePaths = new Map(guideKeys.flatMap((key) => [
  [`/${key}/`, key], [locales[key].en, key], [locales[key].es, key]
] as const));
const featuredArticlePaths = new Map((['ghk-cu-peptide', 'retatrutide-peptide'] as const).flatMap((key) => [
  [`/${key}/`, key], [locales[key].en, key], [locales[key].es, key]
] as const));

const beginnerCopy = {
  en: {
    title: 'Beginner’s Guide to Peptides',
    contents: 'On this page',
    sections: [
      ['What are peptides?', 'Peptides are short chains of amino acids, the same building blocks that make up proteins. Some peptides act as signals that tell cells how to respond.'],
      ['From powder to solution', 'Some research vials contain dry powder. Reconstitution means dissolving that powder in a suitable liquid. The final liquid volume determines how concentrated the sample is.'],
      ['What the units mean', 'Vial labels and charts use different units for amount, volume, and concentration. Check the unit beside every number.'],
      ['Handling and storage', 'Follow the instructions for the specific vial and record when it was prepared. Check the product label for storage conditions and how long a prepared sample can be kept.'],
      ['Read a research chart', 'Match the compound and vial strength first. Then check the concentration and source. A chart can report a study, a worked example, or a community report.']
    ],
    diagram: ['Separate amino acids', 'Linked amino acids', 'Joining amino acids makes a peptide chain.'],
    states: ['Dry powder', 'Dissolved in liquid'],
    photoAlt: ['Two One Aminos sample vials showing dry powder and a clear solution.', 'One Aminos vials beside sealed laboratory supplies on a clean bench.'],
    units: [['mg or mcg', 'Amount of peptide'], ['mL', 'Liquid volume'], ['mg/mL', 'Amount per milliliter']],
    links: ['Reconstitution guide', 'Syringe and measurement guide', 'Storage guide', 'Dosage chart', 'Calculator']
  },
  es: {
    title: 'Guía de péptidos para principiantes',
    contents: 'En esta página',
    sections: [
      ['¿Qué son los péptidos?', 'Los péptidos son cadenas cortas de aminoácidos, los mismos componentes que forman las proteínas. Algunos péptidos actúan como señales que indican a las células cómo responder.'],
      ['Del polvo a la solución', 'Algunos viales de investigación contienen polvo seco. Reconstituir significa disolver ese polvo en un líquido adecuado. El volumen final de líquido determina la concentración.'],
      ['Qué significan las unidades', 'Las etiquetas y tablas usan unidades distintas para la cantidad, el volumen y la concentración. Fíjate en la unidad de cada número.'],
      ['Manipulación y almacenamiento', 'Sigue las instrucciones del vial y registra la fecha de preparación. Consulta la etiqueta para conocer las condiciones de almacenamiento y el plazo de uso.'],
      ['Cómo leer una tabla de investigación', 'Comprueba primero el compuesto y la cantidad que contiene el vial. Luego revisa la concentración y la fuente. La tabla puede citar un estudio, un ejemplo o un informe de la comunidad.']
    ],
    diagram: ['Aminoácidos separados', 'Aminoácidos unidos', 'Al unir aminoácidos se forma una cadena peptídica.'],
    states: ['Polvo seco', 'Disuelto en líquido'],
    photoAlt: ['Dos viales One Aminos con polvo seco y una solución transparente.', 'Viales One Aminos junto a material de laboratorio sellado sobre una mesa limpia.'],
    units: [['mg o mcg', 'Cantidad de péptido'], ['mL', 'Volumen de líquido'], ['mg/mL', 'Cantidad por mililitro']],
    links: ['Guía de reconstitución', 'Guía de jeringas y medición', 'Guía de almacenamiento', 'Tabla de dosificación', 'Calculadora']
  }
};

const sectionIds = [
  ['what-are-peptides', 'how-do-peptides-work', 'major-peptide-categories'],
  ['reconstitution-turning-powder-into-solution', 'how-peptides-are-supplied'],
  ['understanding-units-measurements', 'syringes-types-how-to-read-them'],
  ['storage-before-after-reconstitution', 'safety-considerations', 'essential-supplies-checklist'],
  ['recommended-learning-path', 'routes-of-administration', 'how-to-use-peptidedosages-com']
];

type GuideCopy = typeof beginnerCopy.en;

function powderFigure(copy: GuideCopy) {
  return `<figure class="oa-guide-figure">
    <img src="/one-aminos/guide-art/powder-and-solution.webp" alt="${copy.photoAlt[0]}" width="1040" height="693" loading="lazy" decoding="async">
    <figcaption class="oa-vial-states"><span>${copy.states[0]}</span><span>${copy.states[1]}</span></figcaption>
  </figure>`;
}

function workspaceFigure(copy: GuideCopy) {
  return `<figure class="oa-guide-figure">
    <img src="/one-aminos/guide-art/lab-supplies.webp" alt="${copy.photoAlt[1]}" width="1040" height="693" loading="lazy" decoding="async">
  </figure>`;
}

function aminoAcidDiagram(copy: GuideCopy) {
  const circles = '<i></i><i></i><i></i>';
  return `<figure class="oa-chain-diagram">
    <div class="oa-chain-groups" aria-hidden="true">
      <div><span class="oa-chain-nodes">${circles}</span><span>${copy.diagram[0]}</span></div>
      <span class="oa-chain-arrow">→</span>
      <div><span class="oa-chain-nodes oa-chain-linked">${circles}</span><span>${copy.diagram[1]}</span></div>
    </div>
    <figcaption>${copy.diagram[2]}</figcaption>
  </figure>`;
}

function renderBeginner(copy: GuideCopy, language: 'en' | 'es', prefixed: boolean) {
  const guideLinks = [
    'reconstitution-guide-peptides', 'syringe-measurement-guide',
    'peptide-storage-guide', 'peptide-dosage-chart', 'calculator'
  ] as const;
  const links = guideLinks.map((key, index) => {
    const href = prefixed ? locales[key][language] : `/${key}/`;
    return `<a href="${href}">${copy.links[index]}</a>`;
  });
  const units = `<dl class="oa-guide-units">${copy.units.map(([unit, meaning]) =>
    `<div><dt>${unit}</dt><dd>${meaning}</dd></div>`).join('')}</dl>`;
  const sections = [
    aminoAcidDiagram(copy),
    `<p class="oa-guide-links">${links[0]}</p>${powderFigure(copy)}`,
    `${units}<p class="oa-guide-links">${links[1]}</p>`,
    `<p class="oa-guide-links">${links[2]}</p>${workspaceFigure(copy)}`,
    `<p class="oa-guide-links">${links[3]}${links[4]}</p>`
  ];
  const chapters = copy.sections.map(([heading, paragraph], index) => {
    const [id, ...aliases] = sectionIds[index];
    return `<section class="oa-guide-panel" aria-labelledby="${id}">
      ${aliases.map((alias) => `<span class="oa-guide-anchor" id="${alias}"></span>`).join('')}
      <h2 id="${id}">${heading}</h2>
      <p>${paragraph}</p>
      ${sections[index]}
    </section>`;
  });
  const nav = copy.sections.map(([heading], index) =>
    `<li><a href="#${sectionIds[index][0]}">${heading}</a></li>`).join('');

  return `<div class="page-layout">
    <nav class="oa-guide-contents" aria-label="${copy.contents}"><ul>${nav}</ul></nav>
    <article class="page-content">
      ${chapters.join('')}
    </article></div>`;
}

function preserveGuideAnchors($: CheerioAPI) {
  const headings = $('.page-content').first().find('h2, h3');
  const used = new Set<string>();
  $('[id]').not(headings).each((_, element) => {
    const id = $(element).attr('id');
    if (id) used.add(id);
  });
  headings.each((index, element) => {
    const heading = $(element);
    const label = heading.text().trim();
    const slug = label.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
    const base = heading.attr('id') || slug || `section-${index + 1}`;
    let id = base;
    for (let suffix = 2; used.has(id); suffix++) id = `${base}-${suffix}`;
    heading.attr('id', id);
    used.add(id);
  });
}

function addReadingSummary($: CheerioAPI, key: keyof typeof readingSummaries, language: 'en' | 'es', article: boolean) {
  $('body').addClass('oa-reading-summary');
  const copy = readingSummaries[key][language];
  const label = language === 'es' ? 'Referencia completa' : 'Full reference';
  const list = $('<ul></ul>');
  const summary = $('<div class="oa-reading-summary-content"></div>');
  copy.forEach(([heading, text], index) => {
    const id = `summary-${index + 1}`;
    list.append($('<li></li>').append($('<a></a>').attr('href', `#${id}`).text(heading)));
    summary.append($('<section class="oa-guide-panel"></section>').attr('aria-labelledby', id).append(
      $('<h2></h2>').attr('id', id).text(heading), $('<p></p>').text(text)
    ));
  });
  list.append($('<li></li>').append($('<a href="#full-reference"></a>').text(label)));
  const navigation = $('<nav class="oa-guide-contents"></nav>').attr('aria-label', beginnerCopy[language].contents).append(list);
  const reference = $('<section class="oa-full-reference" id="full-reference" aria-labelledby="full-reference-title"></section>')
    .append($('<h2 id="full-reference-title"></h2>').text(label));

  if (article) {
    $('.single-post-layout > .toc-container').remove();
    $('.post-hero-content').append(navigation);
    const content = $('.single-post-content > .post-content');
    content.before(summary, reference);
    reference.append(content);
  } else {
    $('.page-layout > .toc-container').replaceWith(navigation);
    const content = $('.page-content').first();
    if (key === 'syringe-measurement-guide') {
      content.children('.pdmg-intro').remove();
      // Preserve links to the chart check now included in the fourth card.
      summary.children().last().prepend('<span id="summary-5" class="oa-guide-anchor"></span>');
    }
    reference.append(content.contents());
    content.append(summary, reference);
  }
}

export function applyGuidePresentation($: CheerioAPI, pathname: string) {
  const guide = guidePaths.get(pathname);
  const language = pathname.startsWith('/es/') ? 'es' : 'en';
  const article = featuredArticlePaths.get(pathname);
  if (article) addReadingSummary($, article, language, true);
  if (!guide) return;
  const copy = beginnerCopy[language];
  $('body').addClass('oa-reading-guide');
  $('#pdmg-navigation-js').remove();

  if (guide === 'beginners-guide-peptides') {
    $('.page-hero h1').text(copy.title);
    $('.page-layout').first().replaceWith(renderBeginner(copy, language, /^\/(?:en|es)\//.test(pathname)));
    return;
  }

  preserveGuideAnchors($);
  if (guide === 'peptide-storage-guide') {
    const chapters = $('.page-content > h2');
    const intro = chapters.first().prevAll().get().reverse();
    if (intro.length) chapters.first().before($('<div class="oa-guide-intro"></div>').append(intro));
    chapters.each((_, element) => {
      const heading = $(element);
      const body = heading.nextUntil('h2');
      const panel = $('<section class="oa-guide-panel"></section>');
      heading.before(panel);
      panel.append(heading, body);
    });
  }

  $('.page-content figure').each((_, element) => {
    const figure = $(element);
    const source = figure.find('img').first().attr('src') ?? '';
    if (source.includes('/powder-solution-v1-')) figure.replaceWith(powderFigure(copy));
    if (source.includes('/organized-workspace-v1-') || source.includes('/supplies-v1-')) {
      figure.replaceWith(workspaceFigure(copy));
    }
  });
  addReadingSummary($, guide, language, false);
}

export function applyGuideArticleLayout($: CheerioAPI, pathname: string) {
  const spanish = pathname.startsWith('/es/');
  const tabs = $('nav.oa-guide-contents').first();
  if (!tabs.length) return;
  const layout = $('main .page-layout, main .single-post-layout').first();
  const article = layout.children('article').first();
  if (!article.length) return;
  const covers = { 'beginners-guide-peptides':'new-to-peptides', 'reconstitution-guide-peptides':'reconstitution',
    'syringe-measurement-guide':'measurements', 'peptide-storage-guide':'storage' } as const;
  const guide = guidePaths.get(pathname);
  const featured = featuredArticlePaths.get(pathname);
  const cover = guide ? covers[guide] : featured?.replace(/-peptide$/, '');
  const nav = $('<nav class="toc oa-guide-sidebar"><div class="toc-title"><p></p></div><div class="toc-scroll"><ol></ol></div></nav>');
  const contents = spanish ? 'Contenido' : 'Contents';
  nav.attr('aria-label', contents).find('p').text(contents);
  nav.find('ol').append(tabs.find('li'));
  tabs.remove();
  layout.prepend(nav).addClass('oa-guide-spread single-post-layout');
  article.addClass('single-post-content');
  if (cover && !article.children('.featured-image').length) {
    article.prepend($('<div class="featured-image"></div>').append($('<img alt="" decoding="async">')
      .attr('src', '/one-aminos/article-covers/' + cover + '.webp')));
  }
}
