import type { CheerioAPI } from 'cheerio/slim';

const pilotAssets = '/assets/theme/inc/permanent-design/modules/pd-molecular-pilot/assets/';

export function normalizeProtocolLayout($: CheerioAPI, spanish: boolean) {
  const old = $('main article.page-content');
  const quick = old.find('.dch-head').first();
  if (!quick.length || $('#pdms-pilot').length) return;

  const title = $('main h1').first();
  const article = $('<article class="protocol-article"></article>');
  const toc = $('<nav class="toc"><div class="toc-title"><p></p></div><div class="toc-scroll"><ol></ol></div></nav>');
  const contents = spanish ? 'En esta página' : 'On this page';
  toc.attr('aria-label', contents).find('.toc-title p').text(contents);
  const hero = $('<div class="hero-band oa-catalog-hero"><div class="page-head"><div class="molecular-title-row"></div><div class="pa-head-details"><nav class="jump-links"></nav></div></div></div>');
  const variants = old.find('.pdpb-variant-switcher').first();
  hero.find('.molecular-title-row').append(title);
  if (variants.length) hero.find('.pa-head-details').append(variants);
  const root = $('<div id="pdms-pilot" class="molecular-studio oa-migrated-protocol"></div>');
  const surround = $('<div class="page-surround"><div class="page-layout"></div></div>');
  surround.find('.page-layout').append(toc, article);
  root.append(hero, surround);

  function section(id: string, label: string, type = '') {
    const item = $('<section class="section"><header class="section-head"><h2></h2></header><div class="section-body"></div></section>');
    item.attr('id', id).addClass(type).find('h2').text(label);
    article.append(item);
    toc.find('ol').append($('<li></li>').append($('<a></a>').attr('href', '#' + id).text(label)));
    return item;
  }

  const quickId = quick.attr('id') || 'intro-card';
  const quickName = quick.children('h2').first().text().trim();
  const intro = section(quickId, quickName, 'quick');
  intro.find('.section-head').append(old.find('a.oa-product-link').first());
  const facts = $('<dl class="facts"></dl>');
  quick.find('.dch-text li').each((_, el) => {
    const row = $(el), label = row.find('strong,b').first();
    if (!label.length) return;
    const term = label.text().trim().replace(/:$/, '');
    label.remove();
    facts.append($('<div></div>').append($('<dt></dt>').text(term), $('<dd></dd>').append(row.contents())));
    row.remove();
  });
  const photo = quick.find('.dch-img img').first().addClass('quick-photo');
  const photoLink = photo.closest('a');
  const lead = old.find('.oa-reading-intro').first();
  const introBody = intro.children('.section-body');
  introBody.append($('<div class="quick-body"></div>').append(facts,
    photoLink.length ? photoLink.addClass('quick-vial quick-vial-link') : photo));
  introBody.append(lead, quick.find('.dch-text').contents(), quick.children('p'));

  const chart = old.find('#dosing-schedule').first();
  const chartTitle = chart.find('header h2').first();
  const chartSection = section('dosing-schedule', chartTitle.text().trim() || (spanish ? 'Tabla de dosificación' : 'Dosage chart'), 'chart');
  chartTitle.remove();
  chartSection.children('.section-body').append(chart.find('.dr-container').contents());
  chartSection.find('[style]').removeAttr('style');
  chartSection.find('table').addClass('schedule');
  chartSection.find('.table-responsive').addClass('table-wrap');

  // Some protocol families keep research tables beside the chart inside its wrapper.
  quick.remove();
  chart.remove();
  old.find('.dosage-chart-hero').each((_, el) => { $(el).replaceWith($(el).contents()); });
  old.find('.pdpb-variant-shell,style,script').remove();
  const wrapper = old.children('.pdpb-legacy-variant-content');
  if (wrapper.length) wrapper.replaceWith(wrapper.contents());
  old.find('.dosing-recon-wrapper > .dr-container').each((_, el) => { $(el).parent().replaceWith($(el).contents()); });
  old.children().each((index, el) => {
    const block = $(el);
    if (block.is('br') || !block.text().trim() && !block.find('img,table').length) return;
    if (block.is('h2') && /one aminos/i.test(block.text())) return;
    const heading = block.children('h2,h3').first();
    if (!heading.length) { article.append(block); return; }
    const id = block.attr('id') || heading.attr('id') || 'protocol-section-' + index;
    const item = section(id, heading.text().trim());
    heading.remove();
    item.find('.section-body').append(block.contents());
  });
  article.find('.image-gallery').addClass('products').children('.product-card').addClass('product');
  for (const id of [quickId, 'dosing-schedule', 'supplies-needed']) {
    const link = toc.find('a[href="#' + id + '"]').clone();
    if (id === quickId) link.text(spanish ? 'Referencia rápida' : 'Quick reference');
    if (id === 'dosing-schedule') link.text(spanish ? 'Tabla de dosificación' : 'Dosage chart');
    hero.find('.jump-links').append(link);
  }
  $('main').empty().append(root);
  $('head').prepend($('<link rel="stylesheet" id="pdms-pilot-css">').attr('href', pilotAssets + 'pilot.css?ver=0.13.10'));
  $('script#pd-page-js').remove();
  $('body').append($('<script defer></script>').attr('src', pilotAssets + 'navigation.js?ver=0.1.7'));
}
