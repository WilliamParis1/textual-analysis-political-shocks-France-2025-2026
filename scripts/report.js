/* Rebuild the event tables and daily panel with the same rules as the browser. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../engine.js');
const events = require('../events.js');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'results');
const input = fs.readFileSync(path.join(root, 'data/headlines.csv'), 'utf8');
const records = engine.parseCSV(input);
fs.mkdirSync(output, {recursive: true});

function csv(name, columns, rows) {
  function field(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
  }
  const lines = [columns, ...rows].map(row => row.map(field).join(','));
  fs.writeFileSync(path.join(output, name), lines.join('\n') + '\n');
}

function measure(start, end) {
  const analysis = engine.analyze(records, {start, end});
  const ranking = events.rank(analysis.evidence, {start, end});
  return {analysis, ranking};
}

const study = measure(engine.START, engine.END);
const full = measure(engine.MIN_DATE, engine.END);
const precise = value => value == null ? null : Number(value.toFixed(5));
const pct = value => value == null ? '—' : value.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' %';
const int = value => value.toLocaleString('fr-FR');
const dateFr = value => value.split('-').reverse().join('/');
const range = event => event.start === event.end ? dateFr(event.start) : dateFr(event.start) + ' – ' + dateFr(event.end);
const studyById = new Map(study.ranking.map(event => [event.id, event]));

csv('evenements.csv',
  ['id','evenement','intitule_original','debut','fin','titres_evenement','titres_fenetre','pct_fenetre','titres_etude','pct_etude','pct_chronologie','verification','source_verification'],
  full.ranking.map(e => {
    const inStudy = studyById.get(e.id);
    return [e.id,e.label,e.labelEn,e.start,e.end,e.count,e.windowTotal,precise(e.windowFrequency),inStudy.count,
      precise(inStudy.frequency),precise(e.frequency),e.statusLabel,e.sourceUrl];
  }));
csv('titres_comptes.csv', ['id','evenement','date','source','titre','url'],
  full.ranking.flatMap(e => e.titles.map(t => [e.id,e.label,t.date,t.source,t.headline,t.url])));

// Use the evidence object identities shared by both modules to count the union per day.
const eventDays = new Map();
for (const event of study.ranking) {
  for (const title of event.titles) {
    if (!eventDays.has(title.date)) eventDays.set(title.date, {titles:new Set(), counts:new Map()});
    const day = eventDays.get(title.date);
    day.titles.add(title);
    day.counts.set(event.id, (day.counts.get(event.id) || 0) + 1);
  }
}
const studyEvents = study.ranking.filter(e => e.coverage !== 'outside').sort((a,b) => a.start.localeCompare(b.start));
csv('quotidien_etude.csv',
  ['date','titres_corpus','titres_evenements','pct_evenements','titres_regles_generales','pct_regles_generales', ...studyEvents.map(e => e.id)],
  study.analysis.daily.map(d => {
    const hits = eventDays.get(d.date);
    const n = hits?.titles.size ?? 0;
    return [d.date,d.total,d.total ? n : null,d.total ? precise(100*n/d.total) : null,d.total ? d.matched : null,
      precise(d.frequency),...studyEvents.map(e => d.total ? hits?.counts.get(e.id) ?? 0 : null)];
  }));
const studyUnion = [...eventDays.values()].reduce((n, day) => n + day.titles.size, 0);
const report = [
  '# Fréquence des événements dans les titres de Public Sénat', '',
  '## Période du mémoire · septembre 2025 à octobre 2026', '',
  'Sur ' + int(study.analysis.total) + ' titres uniques de la rubrique Politique, ' + int(studyUnion) +
    ' correspondent à au moins un événement du calendrier dans sa fenêtre, soit **' +
    pct(100*studyUnion/study.analysis.total) + '**. Le classement porte sur la couverture de cette rubrique.', '',
  'Chaque ligne couvre les dates inclusives proposées dans la chronologie. La colonne « Dans la fenêtre » permet de comparer la concentration médiatique pendant des épisodes de durées différentes. La part de la période rapporte le même nombre de mentions aux ' + int(study.analysis.total) + ' titres de la période du mémoire.', '',
  '| Événement suivi | Dates | Titres associés / titres dans la fenêtre | Dans la fenêtre | Dans la période |',
  '|---|---|---:|---:|---:|',
];
for (const e of study.ranking.filter(e => e.coverage !== 'outside')) {
  report.push('| ' + [e.label, range(e), (e.count ?? '—') + ' / ' + e.windowTotal, pct(e.windowFrequency), pct(e.frequency)].join(' | ') + ' |');
}
report.push('', '## Antécédents · juin 2024 à août 2025', '',
  'Ces événements sont mesurés dans leurs fenêtres historiques. La dernière colonne utilise les ' + int(full.analysis.total) +
  ' titres de la chronologie complète comme dénominateur.', '',
  '| Événement suivi | Dates | Titres associés / titres dans la fenêtre | Dans la fenêtre | Dans la chronologie |',
  '|---|---|---:|---:|---:|');
for (const e of full.ranking.filter(e => studyById.get(e.id).coverage === 'outside')) {
  report.push('| ' + [e.label, range(e), (e.count ?? '—') + ' / ' + e.windowTotal, pct(e.windowFrequency), pct(e.frequency)].join(' | ') + ' |');
}
report.push('', 'Un zéro indique que la règle ne relève aucun titre dans une fenêtre observée. Un tiret indique un dénominateur indisponible. Le calendrier suit les hypothèses de recherche fournies. La mention d’un sujet peut précéder son issue. Les reprises rétrospectives hors fenêtre échappent à cette mesure.', '',
  'Par exemple, un bilan parlementaire paru le 3 novembre 2026 revient sur le rejet du budget de la Sécurité sociale le 23 octobre. Cette source documente le vote. Sa date de publication la place hors de la fenêtre de comptage. [Bilan de Public Sénat](https://www.publicsenat.fr/actualites/politique/budget-2027-calendrier-49-3-ordonnancesquelles-sont-les-echeances-a-venir-et-les-scenarios-possibles)', '',
  '[Table complète et statut de vérification](evenements.csv) · [Titres comptés et liens sources](titres_comptes.csv) · [Série quotidienne du mémoire](quotidien_etude.csv)', '');
fs.writeFileSync(path.join(output, 'README.md'), report.join('\n'));
console.log(studyUnion + ' titres associés sur ' + study.analysis.total + ' dans la période du mémoire.');
