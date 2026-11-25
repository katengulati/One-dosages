// The supplied sim.js owns the scene, controls, playback and mixing calculations.
// This adapter connects the standalone simulator to the bilingual dosage library.
const root = document.querySelector('[data-sim]');
const dataNode = document.querySelector('#sim-data');
const catalog = JSON.parse(dataNode.textContent);
const params = new URLSearchParams(location.search);
const spanish = params.get('lang') === 'es';
const rail = root.querySelector('.sim-vials');
const water = root.querySelector('#sim-water');
const calc = root.querySelector('#sim-calc');
const guide = root.querySelector('#sim-protocol');
const guideStatus = root.querySelector('#sim-protocol-status');
const protocols = new Map();
let directoryAvailable = false;

for (const handle of ['selank', 'semax']) {
  const variant = catalog.find(group => group.h === handle)?.s.find(v => v[2] === 10);
  if (variant) protocols.set(variant, {
    url: '/single-peptide-dosages/' + handle + '-10-mg-vial-dosage-protocol/',
    es: '/es/dosis-peptidos-individuales/protocolo-dosificacion-' + handle + '-10-mg-vial/',
    nasal: true
  });
}
const modelLabel = document.createElement('span');
modelLabel.className = 'sim-model-label';
modelLabel.hidden = true;
modelLabel.textContent = spanish ? 'Vial ilustrativo' : 'Illustrative vial';
root.querySelector('.sim-pep').append(modelLabel);

const strengths = new Map();
for (const group of catalog) {
  for (const [index, variant] of group.s.entries()) {
    strengths.set(variant[1].split('/').pop().replace(/\.png$/, '.webp'), { group, index });
  }
}

function addReferenceVial(record) {
  // The original catalog has no matching cap-off photo for these protocols.
  // Mask the donor photo's entire label and identify it as an illustration.
  const group = { h: record.slug, n: record.name, illustrative: true,
    s: [[record.mg + 'MG', '/product-images-labeled/ghkcu-50mg.png', record.mg]] };
  catalog.push(group);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sim-vial-pick';
  button.dataset.h = group.h;
  button.setAttribute('aria-pressed', 'false');
  button.textContent = group.n;
  rail.append(button);
  return { group, index: 0 };
}

function currentSelection() {
  const handle = rail.querySelector('[aria-pressed="true"]')?.dataset.h;
  const group = catalog.find(item => item.h === handle);
  const index = Number(root.querySelector('#sim-sizes [aria-pressed="true"]')?.dataset.i || 0);
  return { group, index };
}

function syncLinks() {
  const { group, index } = currentSelection();
  if (!group) return;
  modelLabel.hidden = !group.illustrative;
  if (group.illustrative) root.querySelector('#sim-pep-img').alt = modelLabel.textContent;
  const variant = group.s[index];
  const protocol = protocols.get(variant);
  guide.hidden = !protocol;
  guideStatus.hidden = !!protocol;
  if (protocol) {
    guide.href = spanish ? protocol.es : (params.get('locale') === 'en' ? '/en' : '') + protocol.url;
    const type = protocol.nasal ? (spanish ? 'Protocolo nasal' : 'Nasal dosing guide') : (spanish ? 'Guía de dosificación' : 'Dosing guide');
    guide.textContent = type + ' · ' + group.n + ' ' + variant[2] + ' mg';
  } else {
    guide.removeAttribute('href');
    guideStatus.textContent = directoryAvailable
      ? (spanish ? 'No hay guía de dosificación para este vial.' : 'No dosing guide is published for this vial.')
      : (spanish ? 'No se pudo cargar la guía de dosificación.' : 'The dosing guide could not be loaded.');
  }
  const calculator = spanish ? '/es/calculadora/' : params.get('locale') === 'en' ? '/en/calculator/' : '/calculator/';
  const href = calculator + '?' + new URLSearchParams({ mg: group.s[index][2], water: water.value });
  if (calc.getAttribute('href') !== href) calc.setAttribute('href', href);
}

async function start() {
  root.inert = true;
  let records = [];
  try {
    const res = await fetch('/api/demo-products/');
    if (res.ok) {
      records = await res.json();
      directoryAvailable = true;
    }
  } catch { /* The supplied catalog also works when protocol data is unavailable. */ }

  const requested = params.get('product');
  let initial;
  for (const record of records) {
    const selection = strengths.get(record.photo) || addReferenceVial(record);
    protocols.set(selection.group.s[selection.index], record);
    if (record.slug === requested) initial = { ...selection, ml: record.ml };
  }
  dataNode.textContent = JSON.stringify(catalog);

  // Select only after the original module has measured the scene.
  const handle = params.get('h');
  const url = new URL(location.href);
  if (handle) {
    url.searchParams.delete('h');
    history.replaceState(null, '', url);
  }
  try {
    await import('./sim.js');
  } finally {
    if (handle) {
      url.searchParams.set('h', handle);
      history.replaceState(null, '', url);
    }
    root.inert = false;
  }
  const selected = initial?.group.h || handle;
  const button = selected && rail.querySelector('[data-h="' + CSS.escape(selected) + '"]');
  if (button) {
    button.click();
    if (initial) {
      root.querySelector('#sim-sizes [data-i="' + initial.index + '"]').click();
      water.value = initial.ml;
      water.dispatchEvent(new Event('input', { bubbles: true }));
    }
    rail.scrollLeft += button.getBoundingClientRect().left - rail.getBoundingClientRect().left - (rail.clientWidth - button.offsetWidth) / 2;
  }
  root.addEventListener('click', syncLinks);
  water.addEventListener('input', syncLinks);
  new MutationObserver(syncLinks).observe(calc, { attributes: true, attributeFilter: ['href'] });
  syncLinks();
  if (spanish) (await import('./es.js')).localize(root);
  const shell = document.querySelector('#simulator-embed');
  if (parent !== window) new ResizeObserver(() => {
    parent.postMessage({ type: 'oa-demo-height', height: shell.offsetHeight }, location.origin);
  }).observe(shell);
}
start();
