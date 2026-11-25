import catalog from '../../public/data/replica/presets/catalog.json';
import policy from '../../site/catalog-policy.json';
import photos from '../../site/product-photos.json';
import paths from '../../site/manifest.json';

const supported = new Set(Object.keys(policy.products));
const photoFiles: Record<string, string> = photos;
const routes: Record<string, { en: string; es: string }> = paths;
const records = catalog.records.filter(record => record.diluent === 'Bacteriostatic water').map(record => ({
  slug: record.url.split('/').filter(Boolean).at(-1)!, url: record.url, name: record.name,
  mg: Number(record.mg), ml: Number(record.ml), conc: record.conc,
  vial_ml: record.vial_ml, syringe_ml: record.syringe_ml
}));
// This newer strength is documented in the chart and absent from the original preset export.
records.push({slug:'tirzepatide-60-mg-vial-dosage-protocol',url:'/single-peptide-dosages/tirzepatide-60-mg-vial-dosage-protocol/',
  name:'Tirzepatide',mg:60,ml:3,conc:'20 mg/mL',vial_ml:3,syringe_ml:3});
export const demoProducts = records.flatMap(record => {
  const key = record.url.split('/').filter(Boolean).join('__');
  if (!supported.has(key)) return [];
  return [{ ...record, key, photo: photoFiles[key] || '', es: routes[key].es }];
}).sort((a,b) => a.name.localeCompare(b.name) || a.mg - b.mg);
