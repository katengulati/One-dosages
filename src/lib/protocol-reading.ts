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

const introductions: Record<string, [string, string]> = {
  "5-amino-1mq": [
    "5-Amino-1MQ blocks an enzyme called NNMT. Researchers study how that changes the way cells use energy.",
    "5-Amino-1MQ bloquea una enzima llamada NNMT. Se estudia cómo este cambio afecta al uso de energía por las células."
  ],
  "adamax": [
    "Adamax is a modified form of Semax. When reading a study, check which of the two compounds the researchers actually tested.",
    "Adamax es una forma modificada de Semax. Comprueba cuál de los dos compuestos se estudió."
  ],
  "aicar": [
    "AICAR helps researchers study AMPK, a signal that cells use when their energy supply changes.",
    "AICAR permite estudiar la AMPK, una señal que responde a los cambios de energía en la célula."
  ],
  "aod": [
    "AOD-9604 is based on a short part of growth hormone. Researchers have studied that fragment to understand how the body handles fat.",
    "AOD-9604 se basa en un fragmento de la hormona del crecimiento. Se ha estudiado para entender cómo procesa la grasa el organismo."
  ],
  "ara-290": [
    "ARA-290 is also called cibinetide. Researchers have studied it in specific conditions involving nerve damage. The study population matters when interpreting a finding.",
    "ARA-290 también se llama cibinetida. Se ha estudiado en trastornos concretos que afectan a los nervios. Comprueba quién participó en cada estudio."
  ],
  "bpc157": [
    "BPC-157 is a short chain of amino acids studied in tissue repair. Much of that research examines cells or animals, so the type of study matters.",
    "BPC-157 es una pequeña cadena de aminoácidos estudiada en la reparación de tejidos. Gran parte de la investigación se ha realizado en células o animales."
  ],
  "cagrilintide": [
    "Cagrilintide mimics amylin, a hormone involved in the feeling of fullness after a meal.",
    "La cagrilintida imita la amilina, una hormona que interviene en la sensación de saciedad después de comer."
  ],
  "cartalax": [
    "Cartalax is made of three amino acids. Its sequence is often abbreviated AED, using one letter for each amino acid.",
    "Cartalax se compone de tres aminoácidos. La abreviatura AED representa la secuencia, con una letra por aminoácido."
  ],
  "cjc-ipa": [
    "This blend contains two compounds that act on different signals involved in growth hormone release. Look for which compound or combination each source studied.",
    "Esta mezcla contiene dos compuestos que actúan sobre distintas señales relacionadas con la liberación de hormona del crecimiento. Comprueba qué compuesto estudia cada fuente."
  ],
  "dsip": [
    "DSIP stands for delta sleep-inducing peptide. Its name comes from sleep research. To interpret a study, look at which aspects of sleep the researchers measured.",
    "DSIP son las siglas en inglés de péptido inductor del sueño delta. Para interpretar un estudio, comprueba qué aspecto del sueño midieron los investigadores."
  ],
  "eloralintide": [
    "Eloralintide is studied for its effects on amylin receptors, part of the system that signals fullness. The article distinguishes human trial results from vial calculations.",
    "La eloralintida se estudia por su acción sobre los receptores de amilina, que participan en las señales de saciedad. El artículo distingue los ensayos en personas de los cálculos del vial."
  ],
  "epithalon": [
    "Epitalon and Epithalon are two spellings of the same four-amino-acid compound. Studies have examined telomeres, the protective ends of chromosomes.",
    "Epitalon y Epithalon son dos nombres del mismo compuesto de cuatro aminoácidos. Se han estudiado sus efectos sobre los telómeros, los extremos protectores de los cromosomas."
  ],
  "ghkcu": [
    "GHK-Cu pairs a short peptide with copper. The form tested matters when comparing skin or tissue research with a particular product.",
    "GHK-Cu combina un péptido corto con cobre. Conviene comprobar la forma estudiada al comparar los resultados en piel o tejidos con un producto concreto."
  ],
  "glow": [
    "GLOW combines GHK-Cu, BPC-157 and TB-500. A study of one ingredient answers a different question from a study of the whole blend.",
    "GLOW combina GHK-Cu, BPC-157 y TB-500. Un estudio de un ingrediente responde a una pregunta distinta de un estudio de la mezcla completa."
  ],
  "glp2-tz": [
    "Tirzepatide acts on two hormone receptors, GIP and GLP-1. Both are involved in the body’s response to food.",
    "La tirzepatida actúa sobre dos receptores hormonales, GIP y GLP-1, que intervienen en la respuesta del organismo a los alimentos."
  ],
  "igf1lr3": [
    "IGF-1 LR3 is a modified version of insulin-like growth factor 1. The changes affect how it binds to proteins that usually carry IGF-1.",
    "IGF-1 LR3 es una versión modificada del factor de crecimiento similar a la insulina 1. Los cambios afectan a su unión con proteínas que transportan el IGF-1."
  ],
  "ipamorelin": [
    "Ipamorelin acts on the same receptor as ghrelin, a hormone that can signal the release of growth hormone.",
    "La ipamorelina actúa en el mismo receptor que la grelina, una hormona que puede estimular la liberación de hormona del crecimiento."
  ],
  "kisspeptin": [
    "Kisspeptin helps start a chain of hormonal signals involved in reproduction. Researchers can measure different links in that chain.",
    "La kisspeptina inicia una serie de señales hormonales relacionadas con la reproducción. Los estudios pueden medir distintas etapas de esa serie."
  ],
  "klow": [
    "KLOW contains four ingredients. The 80 mg on this vial refers to their combined mass. The chart lists each ingredient’s share separately.",
    "KLOW contiene cuatro ingredientes. Los 80 mg del vial son su masa total. La tabla desglosa la cantidad de cada componente."
  ],
  "kpv": [
    "KPV takes its name from the three amino acids in its chain. Researchers study how it affects signals involved in inflammation.",
    "KPV debe su nombre a sus tres aminoácidos. Se estudia cómo afecta a las señales que intervienen en la inflamación."
  ],
  "motsc": [
    "MOTS-c is a small peptide encoded by mitochondrial DNA. Researchers study the signals it sends when cells use or conserve energy.",
    "MOTS-c es un péptido codificado por el ADN mitocondrial. Se estudian sus señales cuando las células consumen o conservan energía."
  ],
  "mt1": [
    "Melanotan I is also called afamelanotide. Pay attention to the formulation in each study, especially whether it used an implant or a different preparation.",
    "Melanotan I también se llama afamelanotida. Comprueba la formulación de cada estudio, por ejemplo si se utilizó un implante u otra preparación."
  ],
  "mt2": [
    "Melanotan II acts on receptors involved in pigmentation and other body functions. The research distinguishes changes in pigmentation from other observed effects.",
    "Melanotan II actúa sobre receptores relacionados con la pigmentación y otras funciones. Los estudios distinguen los cambios de pigmentación de otros efectos observados."
  ],
  "nad-plus": [
    "NAD+ helps cells transfer electrons as they process energy. NAD+ and NADH are two forms of the same molecule.",
    "El NAD+ ayuda a las células a transferir electrones durante el procesamiento de energía. NAD+ y NADH son dos formas de la misma molécula."
  ],
  "pt141": [
    "PT-141 is another name for bremelanotide. Match the formulation and the population in a study before comparing its findings with a vial reference.",
    "PT-141 es otro nombre de la bremelanotida. Comprueba la formulación y la población estudiada antes de comparar un resultado con esta referencia."
  ],
  "retatrutide": [
    "Retatrutide acts on three hormone receptors involved in metabolism. They recognize GIP, GLP-1 and glucagon. The research tracks outcomes over time.",
    "La retatrutida actúa sobre tres receptores hormonales relacionados con el metabolismo. Reconocen GIP, GLP-1 y glucagón. Los estudios evalúan resultados a lo largo del tiempo."
  ],
  "selank": [
    "Selank is a synthetic chain of seven amino acids. Studies of anxiety symptoms and studies of brain activity measure different outcomes.",
    "Selank es una cadena sintética de siete aminoácidos. Los estudios sobre síntomas de ansiedad y actividad cerebral miden resultados diferentes."
  ],
  "semax": [
    "Semax is a seven-amino-acid peptide. Some human studies used a nasal formulation, so the route is an important detail when reading the findings.",
    "Semax es un péptido de siete aminoácidos. Algunos estudios en personas usaron una formulación nasal, por lo que importa la vía estudiada."
  ],
  "snap-8": [
    "SNAP-8 is also called acetyl octapeptide-3. When reading cosmetic research, check whether the researchers tested the isolated ingredient or a finished formulation.",
    "SNAP-8 también se llama acetil octapéptido-3. En los estudios cosméticos, comprueba si se evaluó el ingrediente aislado o una fórmula terminada."
  ],
  "ss31": [
    "SS-31 is also called elamipretide. It interacts with cardiolipin, a fat in the inner membrane of mitochondria, the parts of cells that produce much of their energy.",
    "SS-31 también se llama elamipretida. Interactúa con la cardiolipina, un lípido presente en la membrana interna de las mitocondrias, donde la célula produce gran parte de su energía."
  ],
  "tb500": [
    "TB-500 is discussed alongside thymosin beta-4. Check which sequence a paper actually tested before applying a finding to the product named here.",
    "TB-500 se menciona junto a la timosina beta-4. Comprueba qué secuencia se estudió antes de relacionar un resultado con este producto."
  ],
  "tesamorelin": [
    "Tesamorelin mimics a signal that tells the pituitary gland to release growth hormone. Some studies then measure a second signal called IGF-1.",
    "La tesamorelina imita una señal que indica a la hipófisis que libere hormona del crecimiento. Algunos estudios miden después otra señal llamada IGF-1."
  ],
  "vesugen": [
    "Vesugen is a chain of three amino acids studied in the context of cells that line blood vessels.",
    "Vesugen es una cadena de tres aminoácidos que se ha estudiado en células que recubren los vasos sanguíneos."
  ],
  "wolverine": [
    "Wolverine is the name used here for the BPC-157 and TB-500 blend. Check whether a study tested the mixture or only one of its ingredients.",
    "Wolverine es el nombre de la mezcla de BPC-157 y TB-500. Comprueba si un estudio evaluó la mezcla o uno solo de sus ingredientes."
  ]
};

export function improveProtocolReading($: CheerioAPI, key: string, handle: string | null | undefined, spanish: boolean) {
  const article = $('main .protocol-article, main article.page-content, main .single-post-content').first();
  if (!article.length) return;
  if (key.includes('__')) {
    const compound = handle ?? (key.includes('aicar') ? 'aicar' : key.includes('vesugen') ? 'vesugen' : '');
    const intro = introductions[compound];
    const candidate = article.find('#vial-research-context .section-body, #protocol-overview .section-body, .section-block').filter((_, el) => $(el).find('p').length > 0).first();
    if (intro && candidate.length) candidate.find('p').first().before($('<p class="oa-reading-intro"></p>').text(intro[spanish ? 1 : 0]));
  }
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
