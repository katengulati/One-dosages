import type { Locale } from '@/i18n/config';

export const coaShell = 'bpc-157-tb-500-blend';
export const coaKey = 'how-to-read-a-coa';
const example = 'https://oneaminos.com/lab-reports/ILS-COA-2026-99YUVC.pdf';

export function renderCoaArticle(shell: string, locale: Locale) {
  const spanish = locale === 'es';
  const title = spanish ? 'Cómo leer un certificado de análisis (COA)' : 'How to Read a Certificate of Analysis (COA)';
  const sections = spanish ? [
    ['Empieza por el lote', 'Un COA recoge las mediciones de un laboratorio para una muestra. Busca el nombre del compuesto, la cantidad indicada en la etiqueta y el número de lote. Dos viales del mismo tamaño pueden pertenecer a lotes distintos.'],
    ['Comprueba quién emitió el informe', 'Localiza el laboratorio, el número de informe y la fecha. La fecha de recepción indica cuándo llegó la muestra. La fecha de análisis indica cuándo se hizo la prueba. Abre el documento completo y usa el código de verificación en la página del laboratorio, si está disponible. Si el lote o el número de informe difieren, solicita el documento correspondiente.'],
    ['Lee cada fila de izquierda a derecha', 'El analito indica qué se midió. El método explica cómo. La especificación fija el criterio de aceptación. Compara el resultado con ese criterio usando las mismas unidades. «Pass» significa que esa fila cumple su criterio. «Report only» indica que se registró un valor sin asignarle un aprobado.'],
    ['Distingue identidad, pureza y contenido', 'La identidad indica qué compuesto detectó el método. La pureza por HPLC describe la proporción de la señal atribuida al compuesto entre los picos que cuenta el método. El contenido neto expresa la cantidad medida en mg. En el informe del ejemplo, un vial etiquetado como 10 mg dio 10,29 mg de contenido neto y 99,56 % de pureza. Cada cifra contesta una pregunta diferente.'],
    ['Interpreta el gráfico', 'En un cromatograma, el eje horizontal muestra el tiempo y el vertical la respuesta del detector. Un pico aparece cuando un componente pasa por el detector. Lee la leyenda y las notas del método para saber qué pico se asignó al compuesto y qué señales se incluyeron en el porcentaje.'],
    ['Revisa el alcance de las pruebas', 'Busca filas específicas para metales, endotoxinas o análisis microbiológicos. «No detectado» se interpreta según el método y su límite de detección. Una fila ausente deja esa pregunta sin respuesta. Los resultados corresponden a la muestra analizada y por sí solos no establecen la seguridad para uso humano.']
  ] : [
    ['Match the lot on your vial', 'A COA records what a laboratory measured in a submitted sample. Start with three details on your vial label and find each one on the report. The compound name, labeled amount and lot number should all match. Two vials with the same name and strength can come from different batches.'],
    ['Check who issued the report', 'Find the laboratory name, report number and dates. The received date tells you when the sample arrived. The analysis date tells you when it was tested. Open the full report and use the issuing lab’s verification page and code when provided. If the lot or report number differs, ask for the matching document.'],
    ['Read one result across the row', 'The analyte is what the lab measured. The method explains how it measured it. The specification gives the acceptance criterion. Compare the result and its units with that criterion. “Pass” applies to that test. “Report only” means the lab recorded a measurement without giving it a pass or fail.'],
    ['Separate identity, purity and amount', 'Identity tells you which compound the test identified. HPLC purity describes the share of the measured peak area attributed to that compound among the peaks the method counts. Net content is the measured amount in milligrams. In the linked report, the label says 10 mg, the lab reports 10.29 mg of net peptide, and the purity result is 99.56%. Each number answers a different question.'],
    ['Read the chromatogram', 'Time runs across the bottom of the graph. Detector response runs up the side. A peak forms as a component passes the detector. Use the legend to find the peak assigned to the peptide, then read the method notes to see which signals the lab included in the purity calculation.'],
    ['Check which other tests were run', 'Look for individual rows for metals, endotoxins or microbial testing. Read “not detected” alongside the method and its detection limit. A missing test leaves that question open. The findings apply to the sample tested. A COA alone cannot establish safety for human use.']
  ];
  const links = sections.map(([heading], i) => `<a href="#coa-${i + 1}">${heading}</a>`).join('');
  const contents = spanish ? 'Contenido' : 'Contents';
  const body = sections.map(([heading, text], i) => `<h2 id="coa-${i + 1}">${heading}</h2><p>${text}</p>`).join('');
  return shell.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta\b[^>]*name="description"[^>]*>|<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<main\b[^>]*>[\s\S]*?<\/main>/i, `<main id="main-content">
      <div class="post-hero"><div class="post-hero-content"><div class="molecular-title-row"><h1 class="post-title">${title}</h1></div>
      <nav class="oa-coa-jumps" aria-label="${contents}">${links}</nav></div></div>
      <div class="single-post-layout">
      <nav class="toc-container" aria-labelledby="post-toc-title"><div class="toc-title"><span id="post-toc-title">${contents}</span>
      <button class="toc-toggle" type="button" aria-label="${contents}" aria-expanded="false" aria-controls="post-toc-panel">⌄</button></div>
      <div class="nav-list-wrapper" id="post-toc-panel"><ul class="nav-list" id="toc"></ul></div></nav>
      <article class="single-post-content"><div class="post-content">${body}
      <p><a href="${example}">${spanish ? 'Consultar el informe del ejemplo (PDF)' : 'Read the example laboratory report (PDF)'}</a></p>
      <a class="oa-solid-link oa-coa-library" href="https://oneaminos.com/coa">${spanish ? 'Abrir la biblioteca de COA de One Aminos' : 'Open the One Aminos COA Library'}</a>
      </div></article></div></main>`);
}
