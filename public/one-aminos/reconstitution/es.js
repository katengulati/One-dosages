// Localize the supplied player's interface without changing its animation module.
const labels = new Map(Object.entries({
  '1. Pick your vial': '1. Elige el vial', '2. Vial size': '2. Cantidad por vial',
  '3. Water to add:': '3. Agua que se añadirá:', 'Use suggested:': 'Usar volumen sugerido:',
  'Peptide': 'Péptido', 'Vial size': 'Cantidad por vial', 'Water to add in mL': 'Agua que se añadirá en mL',
  'Animation of the selected vial being mixed': 'Simulación de la mezcla en el vial seleccionado',
  'Bacteriostatic water vial': 'Vial de agua bacteriostática', 'Syringe': 'Jeringa', 'Vial': 'Vial',
  'Open': 'Abrir', 'Draw': 'Medir', 'Add': 'Añadir', 'Swirl': 'Mezclar', 'Check': 'Revisar', 'Label': 'Etiquetar',
  'Ready when you are': 'Todo listo', 'Play': 'Reproducir', 'Playing…': 'Reproduciendo…',
  'Play again': 'Repetir', 'Start over': 'Volver al inicio', 'Press Play': 'Pulsa Reproducir',
  'Your vial:': 'Tu vial:', 'Strength': 'Concentración', 'Whole vial': 'Vial completo',
  'In each syringe unit (0.01 mL)': 'Por unidad de jeringa U-100 (0,01 mL)',
  'Open the calculator': 'Abrir la calculadora', 'Read the full guide': 'Leer la guía completa',
  'Open and clean': 'Abrir y limpiar', 'Draw the water': 'Medir el agua', 'Add it slowly': 'Añadir el agua despacio',
  'Swirl, don’t shake': 'Mezclar suavemente', 'Check it': 'Revisar el vial', 'Label and chill': 'Etiquetar y refrigerar',
  'Flip the plastic caps off both vials. Wipe each rubber stopper with an alcohol swab and let it dry.': 'Retira las tapas de ambos viales. Limpia cada tapón con una toallita con alcohol y deja que se seque.',
  'Pull the plunger back slowly to fill the syringe with the water you planned.': 'Retira el émbolo despacio para medir el volumen de agua elegido.',
  'Aim at the glass wall so the water runs down the side, not onto the powder.': 'Dirige el agua hacia la pared del vial para que resbale por el vidrio.',
  'Gently swirl the vial until all of the powder has dissolved.': 'Gira el vial con suavidad hasta que se disuelva el polvo.',
  'It should look clear, with nothing floating in it.': 'Comprueba que la solución se vea transparente y sin partículas.',
  'Write the name, strength and date on it, then keep it in the fridge.': 'Anota el nombre, la concentración y la fecha. Sigue las indicaciones de conservación del producto.'
}));

function translation(text) {
  const value = text.trim();
  if (labels.has(value)) return text.replace(value, labels.get(value));
  const step = value.match(/^Step (\d+) of (\d+): (.+)$/);
  if (step) return 'Paso ' + step[1] + ' de ' + step[2] + ' · ' + (labels.get(step[3]) || step[3]);
  const load = value.match(/^(.+?) This is syringe (\d+) of (\d+)\.$/);
  if (load) return translation(load[1]) + ' Carga ' + load[2] + ' de ' + load[3] + '.';
  if (value.startsWith('Mixed ')) return 'Mezclado el ' + new Date().toLocaleDateString('es', { month: 'short', day: 'numeric' });
  return text.replace(' mg per mL', ' mg/mL').replace(' mL water', ' mL de agua').replace(' mg in ', ' mg en ');
}

function translateNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const next = translation(node.data);
    if (next !== node.data) node.data = next;
    return;
  }
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) translateNode(walker.currentNode);
}

export function localize(root) {
  document.documentElement.lang = 'es';
  document.title = 'Simulador de reconstitución | One Aminos';
  translateNode(root);
  for (const el of root.querySelectorAll('[aria-label],img[alt]')) {
    for (const attr of ['aria-label', 'alt']) {
      if (el.hasAttribute(attr)) el.setAttribute(attr, translation(el.getAttribute(attr)));
    }
  }
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) translateNode(node);
  });
  for (const el of root.querySelectorAll('.sim-caption, #sim-play, .sim-results, .sim-sticker')) {
    observer.observe(el, { childList: true, subtree: true });
  }
}
