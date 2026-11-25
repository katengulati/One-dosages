import type { CheerioAPI } from 'cheerio/slim';

export function applyCalculatorPresentation($: CheerioAPI, spanish: boolean) {
  if (!$('.pdc-wrap').length) return;
  $('#pdmcalc-studio-css, #pdmcalc-navigation-js, .toc-container, .pdc-intro, .pdc-wrap i[aria-hidden="true"]').remove();
  $('head').append('<link rel="stylesheet" href="/one-aminos/calculator.css">');

  // Keep the heading fragments produced by the original table of contents.
  $('.page-content').find('h2, h3').each((_, element) => {
    const heading = $(element);
    if (heading.attr('id')) return;
    const id = heading.text().trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
    heading.attr('id', id);
  });
  $('.page-title').text(spanish ? 'Calculadora de péptidos' : 'Peptide Dosage Calculator');
  $('.pdc-card .pdc-hint').first().text(spanish ? 'Introduce las cantidades de la etiqueta del vial y del protocolo.' : 'Enter the amounts from the vial label and the protocol.');
  const sections = [
    [$('.pdc-grid'), 'calculator-inputs', spanish ? 'Datos' : 'Inputs'],
    [$('.pdc-results'), 'calculator-results', spanish ? 'Resultados' : 'Results'],
    [$('.pdc-article'), 'calculator-guide', spanish ? 'Guía' : 'Guide']
  ] as const;
  const links = $('<ul></ul>');
  for (const [section, id, label] of sections) {
    section.attr('id', id);
    links.append($('<li></li>').append($('<a></a>').attr('href', '#' + id).text(label)));
  }
  $('.page-hero-content').append($('<nav class="oa-guide-contents"></nav>')
    .attr('aria-label', spanish ? 'En esta página' : 'On this page').append(links));
}
