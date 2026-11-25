import paths from '../../site/manifest.json';
import policy from '../../site/catalog-policy.json';
import { introductions } from './protocol-reading';

export const categoryPage = 'peptide-categories';
const routes: Record<string,{en:string;es:string}> = paths;
const names: Record<string,string> = {
  '5-amino-1mq':'5-Amino-1MQ', adamax:'Adamax', aicar:'AICAR', aod:'AOD-9604', 'ara-290':'ARA-290',
  bpc157:'BPC-157', wolverine:'BPC-157 + TB-500 (Wolverine)', cagrilintide:'Cagrilintide',cartalax:'Cartalax',
  'cjc-ipa':'CJC-1295 NO DAC + Ipamorelin',dsip:'DSIP',eloralintide:'Eloralintide',epithalon:'Epitalon',
  ghkcu:'GHK-Cu',glow:'GLOW',glutathione:'Glutathione','glp2-tz':'Tirzepatide','igf1lr3':'IGF-1 LR3',
  ipamorelin:'Ipamorelin',kisspeptin:'Kisspeptin',klow:'KLOW',kpv:'KPV',motsc:'MOTS-c',mt1:'Melanotan I',
  mt2:'Melanotan II','nad-plus':'NAD+',pt141:'PT-141',retatrutide:'Retatrutide',selank:'Selank',semax:'Semax',
  'snap-8':'SNAP-8',ss31:'SS-31',tb500:'TB-500',tesamorelin:'Tesamorelin',vesugen:'Vesugen',
  'lipo-c-b12':'Lipo C + B12','lipo-c-fat-blaster':'Lipo C Fat Blaster'
};
const topics = [
  ['metabolism','Weight and metabolism','Peso y metabolismo',['5-amino-1mq','aicar','aod','cagrilintide','eloralintide','retatrutide','glp2-tz']],
  ['recovery','Recovery and tissue repair','Recuperación y reparación de tejidos',['ara-290','bpc157','cartalax','kpv','tb500','wolverine']],
  ['focus','Focus and nervous system','Atención y sistema nervioso',['adamax','selank','semax']],
  ['skin','Skin and pigmentation','Piel y pigmentación',['ghkcu','glow','klow','mt1','mt2','snap-8']],
  ['sleep','Sleep','Sueño',['dsip']],
  ['aging','Aging and cellular energy','Envejecimiento y energía celular',['epithalon','glutathione','motsc','nad-plus','ss31','vesugen']],
  ['hormones','Hormone signaling','Señalización hormonal',['cjc-ipa','igf1lr3','ipamorelin','kisspeptin','pt141','tesamorelin']],
  ['formulations','Lipo C formulations','Fórmulas de Lipo C',['lipo-c-b12','lipo-c-fat-blaster']]
] as const;
const descriptions: Record<string,string[]> = {
  ...introductions,
  glutathione:['Cells use glutathione to manage oxidation and recycle other antioxidants.','Las células usan glutatión para controlar la oxidación y regenerar otros antioxidantes.'],
  'lipo-c-b12':['A combination formula that includes vitamin B12. See the product reference for its listed ingredients.','Fórmula combinada con vitamina B12. Consulta la referencia para ver sus ingredientes.'],
  'lipo-c-fat-blaster':['A Lipo C blend with its own ingredient list. The reference identifies this formulation separately from Lipo C + B12.','Una mezcla de Lipo C con su propia lista de ingredientes. La referencia distingue esta fórmula de Lipo C + B12.']
};
const pages = new Map<string,string>();
for (const [key, handle] of Object.entries(policy.products)) {
  const id = handle ?? (key.includes('aicar') ? 'aicar' : key.includes('vesugen') ? 'vesugen' : '');
  if (!pages.has(id) || !key.includes('__')) pages.set(id,key);
}

export function renderCategories(shell: string, lang:'en'|'es', prefixed = true) {
  const es = lang === 'es', title = es ? 'Categorías de péptidos' : 'Peptide Categories';
  const nav = topics.map(([id,en,sp]) => `<a href="#${id}">${es ? sp : en}</a>`).join('');
  const groups = topics.map(([id,en,sp,compounds]) => {
    const cards = compounds.map(compound => {
      const key = pages.get(compound)!;
      const url = routes[key][lang];
      return `<a class="oa-topic-card" href="${prefixed ? url : url.slice(3)}"><strong>${names[compound]}</strong><span>${descriptions[compound][es ? 1 : 0]}</span></a>`;
    }).join('');
    return `<section id="${id}"><h2>${es ? sp : en}</h2><div class="oa-topic-grid">${cards}</div></section>`;
  }).join('');
  return shell.replace(/<title>[\s\S]*?<\/title>/i,`<title>${title}</title>`)
    .replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<main\b[^>]*>[\s\S]*?<\/main>/i,`<main id="main-content" class="oa-topics"><div class="post-hero"><div class="post-hero-content"><h1>${title}</h1></div></div>
    <nav class="oa-coa-jumps" aria-label="${title}">${nav}</nav>${groups}</main>`);
}
