import * as CC from './cycles.js';
import { writeFileSync } from 'fs';

const out = { generated: new Date().toISOString().slice(0, 10), families: {} };
for (const k of [2, 3, 4]) {
  const cat = CC.buildCatalogue(k);
  out.families[k] = {
    ordinals: cat.length / 2,
    entries: cat.length,
    genuine: cat.filter(e => !e.degenerate).length,
    berlinerClasses: CC.berlinerClasses(k).length,
    cycles: cat.map(e => ({
      id: e.id, name: e.name, intervals: e.intervals, partner: e.partner,
      retrogradeOf: e.retrogradeOf, degenerate: e.degenerate,
      reducesTo: e.reducesTo, berliner: e.berliner,
      rowForms: CC.rowFormCount(e.intervals),
      palindromic: CC.rotate(e.intervals, 0)
        .map((_, n) => CC.rotate(e.intervals, n).join(','))
        .includes(CC.retrogradeInversion(e.intervals).join(',')),
      literalSpan: CC.registerSpan(CC.placeRegister(e.intervals, { mode: 'literal' })),
      boundedSpan: CC.registerSpan(CC.placeRegister(e.intervals, { mode: 'bounded' })),
    })),
  };
}
writeFileSync('../data/catalogue.json', JSON.stringify(out, null, 1));

// CSV for the article's tables
const rows = ['id,name,intervals,partner,retrograde_of,degenerate,reduces_to,'
  + 'berliner,row_forms,palindromic,literal_span_semitones,bounded_span_semitones'];
for (const k of [2, 3, 4]) for (const c of out.families[k].cycles) {
  rows.push([c.id, c.name, `"${c.intervals.join(' ')}"`, c.partner, c.retrogradeOf || '',
    c.degenerate, c.reducesTo || '', c.berliner || '', c.rowForms, c.palindromic,
    c.literalSpan, c.boundedSpan].join(','));
}
writeFileSync('../data/catalogue.csv', rows.join('\n') + '\n');

for (const k of [2, 3, 4]) {
  const f = out.families[k];
  console.log(`k=${k}: ${f.ordinals} ordinals, ${f.entries} entries `
    + `(${f.genuine} genuine), ${f.berlinerClasses} Berliner classes`);
}
console.log('\nThree-interval catalogue:');
for (const c of out.families[3].cycles) {
  console.log(`  ${c.id.padEnd(6)} ${c.name.padEnd(12)} ${(c.berliner || '—').padEnd(6)}`
    + `${c.degenerate ? `reducible to ${c.reducesTo}` : ''}`);
}
