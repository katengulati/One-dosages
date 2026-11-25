import type { CheerioAPI } from 'cheerio/slim';

const wording: [RegExp, string][] = [
  [/When vial-(?:size|strength) variants exist, they remain separate because vial strength, concentration, and syringe-unit calculations can differ\./g, 'Choose the chart for the strength on your vial. A different strength can change the concentration and syringe reading.'],
  [/The approved storage wording and product-specific instructions take precedence over generalized peptide handling advice\./g, 'Use the storage instructions for your exact product.'],
  [/Follow the exact product documentation for sterility, storage, handling loss, and discard timing\./g, 'Check the product instructions for sterile handling, storage and when to discard the sample.'],
  [/Related compounds and blends are comparisons only, not interchangeable\./g, 'Each compound or blend has its own chart.'],
  [/The approved (?:chart|table) preserves/g, 'The chart lists'],
  [/in the context of/g, 'in'],
  [/should not be interpreted as evidence of/g, 'does not establish'],
  [/is not sufficient to establish/g, 'does not establish'],
  [/cannot be extrapolated (?:directly )?to/g, 'may not apply to'],
  [/prior to use/g, 'before use'],
  [/in the absence of/g, 'without'],
  [/is dependent (?:up)?on/g, 'depends on'],
  [/subsequent to/g, 'after']
];

const terms: [RegExp, string, string][] = [
  [/\bpharmacokinetics?\b/i, 'Pharmacokinetics', 'How a substance moves through the body over time, including how it is cleared.'],
  [/\bpreclinical\b/i, 'Preclinical research', 'Experiments in cells or animals that help researchers decide what to study next. Outcomes can differ in people.'],
  [/\bagonist\b/i, 'Receptor agonist', 'A substance that activates a receptor, the part of a cell that receives a particular signal.'],
  [/\bin vitro\b/i, 'In vitro', 'An experiment carried out outside a living organism, often using cells in a dish.'],
  [/\bhalf.life\b/i, 'Half-life', 'The time it takes for a measured amount or concentration to fall by half under the conditions studied.'],
  [/\bdouble.blind\b/i, 'Double-blind study', 'A study in which participants and the researchers assessing them do not know which treatment each participant received.'],
  [/\bendogenous\b/i, 'Endogenous', 'Produced naturally by the body.'],
  [/\bsecretagogue\b/i, 'Secretagogue', 'A substance that signals cells to release something, such as a hormone.'],
  [/\bbioavailability\b/i, 'Bioavailability', 'The fraction of a substance that reaches the circulation after it is given.']
];

export function improveProtocolReading($: CheerioAPI, key: string) {
  const article = $('main .protocol-article, main .pdpb-variant-shell, main .single-post-content').first();
  if (!article.length) return;
  const paragraphs = article.find('.section-body p, .post-content p, section p').filter((_, el) => !$(el).closest('details, figure, table, .references-list').length);
  const explained = new Set<string>();
  paragraphs.each((_, el) => {
    const paragraph = $(el);
    const plain = paragraph.text().trim();
    if (/^(?:Concise summary of the .+ regimen\.|Practical considerations for consistency and safety\.|Educational guide for reconstitution and daily dosing|Explore the available research context, protocol variants or comparisons, and practical guides\.)$/.test(plain)) {
      paragraph.remove();
      return;
    }
    paragraph.contents().each((_, node) => {
      if (node.type !== 'text') return;
      for (const [pattern, replacement] of wording) node.data = node.data.replace(pattern, replacement);
    });
    const text = paragraph.text().trim();
    if (!paragraph.children().length && text.length > 390) {
      const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z¿])/);
      let current: ReturnType<CheerioAPI> = paragraph.empty();
      let block = '';
      for (const sentence of sentences) {
        if (block.length >= 170) {
          current.text(block);
          const next = $('<p></p>');
          current.after(next);
          current = next;
          block = '';
        }
        block += (block ? ' ' : '') + sentence;
      }
      current.text(block);
    }
    if (explained.size >= 3 || !paragraph.closest('section, .post-content').length || text.length < 90 || paragraph.closest('#intro-card, #dosing-schedule, #supplies-needed').length) return;
    for (const [pattern, term, meaning] of terms) {
      if (explained.has(term) || !pattern.test(text)) continue;
      // Existing captured articles in both route families can contain English paragraphs.
      if (!/\b(the|that|from|studies|which|with)\b/i.test(text)) break;
      explained.add(term);
      const definition = $('<p class="oa-term-definition"></p>').append($('<strong></strong>').text(term + '. '), meaning);
      paragraph.before(definition);
      break;
    }
  });
  if (key.includes('klow-80-mg')) {
    const body = article.find('#storage-handling .section-body');
    if (body.find('p').first().text().startsWith('The four reconstitution checks')) {
      body.find('p').remove();
      for (const text of [
        'The KLOW chart uses 3.0 mL of bacteriostatic water. Its four preparation steps are in the dosage chart above. Clean each stopper with a separate swab. Add the liquid slowly along the vial wall and swirl gently.',
        'The chart lists refrigerated storage at 2–8 °C (35.6–46.4 °F), protected from light. Label the prepared vial and check the batch instructions for its discard date. Avoid repeated freezing and thawing.',
        'A leak or loss of liquid changes the volume behind the calculation. If you see cloudiness or particles, or cannot confirm the vial’s identity or storage history, set the sample aside and check the batch instructions.'
      ]) body.append($('<p></p>').text(text));
    }
  }
}
