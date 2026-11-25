import type { CheerioAPI } from 'cheerio/slim';

const legacySupplier = /pure[\s-]*labs?(?:\s*peptides)?/i;
const referenceHeading = /^(references|referencias|bibliograf[ií]a|works cited|sources and further reading|fuentes y lecturas adicionales)$/i;
const importantNote = /^(important (note|notice)|nota importante|aviso importante)$/i;

export function applyArticlePresentation($: CheerioAPI) {
  $('.blog-sidebar .sidebar-widget').filter((_, el) =>
    $(el).is('.newsletter-widget') || $(el).find('.recent-posts-list, form.search-form').length > 0).remove();
  $('.blog-sidebar').filter((_, el) => !$(el).children().length).remove();
  $('main li').filter((_, el) => {
    const item = $(el);
    return legacySupplier.test(item.text()) && (item.find('.ref-line').length > 0 ||
      item.closest('ol, .reference-list').length > 0 && !item.find('ol, ul').length);
  }).each((_, el) => {
    const id = $(el).attr('id');
    if (id) $('a[href="#' + id + '"]').each((_, a) => {
      const sup = $(a).closest('sup');
      if (sup.length && sup.find('a').length === 1) sup.remove();
      else $(a).remove();
    });
    $(el).remove();
  });
  // Avoid attributing another supplier’s product specifications to One Aminos.
  $('main p').filter((_, el) => legacySupplier.test($(el).text())).remove();

  $('main li').filter((_, el) => !$(el).find('ul,ol').length && legacySupplier.test($(el).text())).each((_, el) => {
    const li = $(el);
    li.contents().each((_, node) => {
      if (node.type === 'text') node.data = node.data.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(sentence => !legacySupplier.test(sentence)).join(' ');
    });
    if (!li.text().trim() || legacySupplier.test(li.text())) li.remove();
  });
  $('#backToTop, button.back-to-top, section#important-note').remove();
  $('a[href="#important-note"]').each((_, el) => {
    const link = $(el);
    if (link.parent().is('li')) link.parent().remove();
    else link.remove();
  });
  $('.toc-title > span').filter((_, el) => /find the detail|encuentra el detalle/i.test($(el).text())).remove();
  $('main h2, main h3, main h4, main p:has(> strong:only-child)').each((_, el) => {
    const heading = $(el);
    const title = heading.text().trim();
    if (importantNote.test(title)) {
      const section = heading.closest('section');
      if (section.length && section.find('h2,h3,h4').length === 1) {
        const id = section.attr('id');
        if (id) $('a[href="#' + id + '"]').closest('li').remove();
        section.remove();
      }
      return;
    }
    if (!referenceHeading.test(title) || heading.closest('details').length) return;
    const header = heading.parent().is('.section-head') ? heading.parent() : heading;
    const contents = header.next();
    if (!contents.is('ol, ul, .section-body, .pdmg-section-content, .references-list')) return;
    const details = $('<details class="oa-citations"></details>');
    const summary = $('<summary></summary>');
    header.before(details);
    details.append(summary.append(heading), contents);
    if (!header.is(heading)) header.remove();
  });

  $('main strong, main .product p, main figcaption, main h3, main h4').each((_, el) => {
    const field = $(el);
    const label = field.text().trim();
    if (/^(?:shared )?(?:U[-‑–]100\s+)?(?:insulin\s+)?syringes(?:\s*\([^)]*\))?:?$/i.test(label)) {
      field.text('U-100 Syringes' + (label.endsWith(':') ? ':' : ''));
    }
  });
  $('main p, main li, main div, main span, main em, main strong, main td, main figcaption, main h2, main h3').contents().each((_, node) => {
    if (node.type !== 'text' || !/insulin syringe/i.test(node.data)) return;
    const context = $(node).parent().text();
    if (/U[-‑–]40|other (?:syringe )?scales|differen(?:ce|t) (?:syringe|scale)|tuberculin|luer.lock/i.test(context)) return;
    node.data = node.data.replace(/(?:U[-‑–]100\s+)?insulin syringe(s?)\b/gi, 'U-100 syringe$1');
  });
}
