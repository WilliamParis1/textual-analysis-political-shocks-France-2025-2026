const test = require('node:test');
const assert = require('node:assert/strict');
const {analyze, parseCSV, detect} = require('./engine.js');

test('CSV imports accents, BOM, semicolons, escaped quotes and quoted line breaks', () => {
  const csv = '\ufeffdate;titre;média;lien\r\n2025-09-01;"Bayrou : ""démission"";\nà Matignon";Presse;https://example.org\r\n';
  assert.deepEqual(parseCSV(csv), [{date:'2025-09-01', headline:'Bayrou : "démission";\nà Matignon', source:'Presse', url:'https://example.org'}]);
  assert.throws(() => parseCSV('date,headline\n2025-09-01,"open'), /fermé/);
  assert.throws(() => parseCSV('date,titre,headline'), /double/);
  assert.throws(() => parseCSV('headline,source'), /date/);
  assert.throws(() => parseCSV('date,headline\n2025-09-01,a,b'), /champs/);
});

test('count headlines once overall, once per category, and once per publisher on a given day', () => {
  const headline = 'Après le vote de confiance, François Bayrou démissionne';
  const records = [
    {date:'2025-09-01', headline, source:'A'},
    {date:'2025-09-01', headline:headline.toUpperCase(), source:'A'},
    {date:'2025-09-01', headline, source:'B'},
    {date:'2025-09-01', headline:'Une nouvelle motion de censure contre le gouvernement français'},
    {date:'2025-09-02', headline:'La météo en France'},
    {date:'2025-08-31', headline},
    {date:'2025-09-31', headline},
    {date:'2025-09-01', headline:'  '},
  ];
  const report = analyze(records, {start:'2025-09-01', end:'2025-09-03'});
  assert.deepEqual([report.total, report.matched, report.frequency, report.duplicates, report.outside, report.invalid], [4, 3, 75, 1, 1, 2]);
  assert.deepEqual(report.categories.slice(0, 2).map(c => [c.id, c.count]), [['confidence', 3], ['government', 2]]);
  assert.deepEqual(report.daily.map(d => d.frequency), [100, 0, null]);
  assert.equal(report.evidence.length, 4);
});

test('detection requires French anchors and exposes prospective mentions', () => {
  assert.equal(detect('French PM resigns')[0].id, 'government');
  assert.equal(detect('Macron pourrait-il dissoudre l’Assemblée nationale ?')[0].status, 'prospectif');
  assert.equal(detect('France : le premier ministre britannique démissionne').length, 0);
  assert.equal(detect('Le gouvernement belge tombe').length, 0);
  assert.equal(detect('French bond yields rise after inflation data').length, 0);
  assert.equal(detect('La France publie son budget').length, 0);
  assert.deepEqual(detect('France faces fiscal deadlock as spending bill fails').map(m => m.id), ['budget']);
});

test('fixed research window, optional historical view and null percentages with empty corpus', () => {
  const report = analyze([{date:'2025-09-01', headline:'La météo'}, {date:'2026-10-31', headline:'La France en images'}]);
  assert.equal(report.total, 2);
  assert.equal(report.daily.length, 426);
  assert.equal(analyze([]).frequency, null);
  assert.throws(() => analyze([], {start:'2024-05-01'}));
  assert.equal(analyze([{date:'2024-06-09', headline:'Macron annonce la dissolution de l’Assemblée nationale'}], {start:'2024-06-01'}).matched, 1);
});

test('episodes end at an unobserved or zero-mention day and report the earliest peak', () => {
  const records = ['01','02','04'].map(d => ({date:'2025-09-' + d, headline:'French government collapses'}));
  const report = analyze(records, {start:'2025-09-01', end:'2025-09-04'});
  assert.deepEqual(report.episodes.map(e => [e.start, e.end, e.count, e.peakDate]), [
    ['2025-09-01','2025-09-02',2,'2025-09-01'], ['2025-09-04','2025-09-04',1,'2025-09-04'],
  ]);
});
