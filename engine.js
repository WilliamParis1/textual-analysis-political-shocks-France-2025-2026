/* Frequency of French political-shock mentions in dated news headlines. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShockEngine = api;
})(globalThis, function () {
  'use strict';

  const MIN_DATE = '2024-06-01';
  const START = '2025-09-01';
  const END = '2026-10-31';
  const DAY = 86400000;

  function normalize(value) {
    return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  function validDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const stamp = Date.parse(date + 'T00:00:00Z');
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === date;
  }

  // Each rule needs a trigger and, where specified, context from the same title fragment.
  const rules = [
    { id: 'confidence', label: 'Censure et votes de confiance', triggers: [
      /\b(?:motions? de (?:censure|defiance)|votes? (?:de|sur la) (?:non |me)?(?:confiance|defiance)|(?:no |non )?confidence (?:votes?|motions?)|votes? of (?:no )?confidence|questions? de confiance)\b/,
      /\b(?:renvers\w*|censur\w*|toppl\w*)\b/,
    ], contexts: [null, /\b(?:gouvernement|government|cabinet|premier ministre|prime minister|bayrou|lecornu|barnier|attal)\b/] },
    { id: 'government', label: 'Démissions et changements de gouvernement', triggers: [
      /\b(?:demission\w*|resign\w*|quits?|stand(?:s|ing)? down|steps? down|limoge\w*|remplac\w*|replac\w*|nomm\w*|nomination|appoint\w*|reappoint\w*|renomm\w*|recondui\w*|destitu\w*|sack(?:s|ed)?)\b/,
      /\b(?:nouve(?:au|lle) (?:premie(?:r|re) ministre|gouvernement)|new (?:french )?(?:government|prime minister|cabinet)|(?:nouvel|nouvelle) (?:occupant|occupante|locataire) de matignon)\b/,
      /\b(?:remaniement (?:ministeriel|gouvernemental)|cabinet reshuffle|government collaps\w*|chute (?:du|de son) gouvernement|gouvernement (?:bayrou |lecornu )?(?:tombe|renverse)|formation (?:du|d un) (?:nouveau )?gouvernement)\b/,
    ], contexts: [/\b(?:premie(?:r|re) ministre|prime minister|french premier|french pm|gouvernement|government|cabinet|matignon|chef du gouvernement|president francais|french president|bayrou|lecornu|(?:emmanuel )?macron (?:doit |va |pourrait )?demission\w*)\b/, null, null] },
    { id: 'election', label: 'Dissolution et législatives anticipées', triggers: [
      /\b(?:dissolution|dissou[td]\w*|dissolv\w*)\b/,
      /\b(?:(?:elections? )?legislatives? anticipees?|elections? anticipees?|(?:snap|early) (?:(?:parliamentary|legislative|general) )?elections?)\b/,
    ], contexts: [/\b(?:assemblee|parlement|parliament|cohabitation|premier ministre|legislati\w*)\b/, null] },
    { id: 'procedure', label: 'Article 49.3', triggers: [
      /\b(?:49 3|49 alinea 3|49 paragraphe 3|49 paragraph 3)\b/,
    ] },
    { id: 'budget', label: 'Blocages et ruptures budgétaires', triggers: [
      /\b(?:reje(?:t\w*|cte?\w*)|refus\w*|retorqu\w*|retoqu\w*|censur\w*|bloqu\w*|blocages?|impasse|echec|echou\w*|deadlock\w*|defeat\w*|fail\w*|stalemate|shutdown|crise|crisis|rupture|bras de fer|standoff|blocks?|blocked|quash\w*|loi speciale)\b/,
    ], contexts: [/\b(?:budget\w*|fiscal|finances publiques|projet de loi de finances|plf|plfss|austerit\w*|loi de finances|finance bill|spending (?:bill|plan))\b/] },
    { id: 'mobilisation', label: 'Grèves et mobilisations nationales', triggers: [
      /\b(?:greves? generales?|greves? nationales?|general strike|nationwide (?:strikes?|protests?)|national (?:strikes?|protests?)|journee (?:nationale |interprofessionnelle )de (?:greve|mobilisation)|bloquons tout|block everything)\b/,
      /\b(?:greves?|manifestations?|protests?|strikes?)\b/,
    ], contexts: [null, /\b(?:budget\w*|austerit\w*|politique (?:fiscale|budgetaire)|fiscal (?:policy|plan)|reforme des retraites|pension reform)\b/] },
  ];

  const france = /\b(?:france|francais\w*|french|macron|elysee|matignon|palais bourbon|bercy|bayrou|lecornu|barnier|elisabeth borne|gabriel attal|marine le pen|jean luc melenchon|francois patriat|patrick kanner|gerard larcher|bruno retailleau|gerald darmanin|raphael glucksmann|politique generale|lfi|assemblee nationale|rassemblement national|la france insoumise|49 (?:3|alinea 3)|bloquons tout|plfss)\b/;
  // A foreign government explicitly identified in a mixed-country headline can supply
  // the trigger itself (e.g. a French reaction to a British resignation).
  const foreign = /\b(?:allemag\w*|german\w*|royaume uni|grande bretagne|briti\w*|britanni\w*|italie\w*|italy|italian\w*|espag\w*|spain|spanish|portug\w*|belg\w*|belgi\w*|canad\w*|queb\w*|jap[oa]n\w*|united states|etats unis|american\w*|americain\w*|ukrain\w*|russi\w*|russe\w*|israel\w*|polon\w*|poland|polish|dutch|netherland\w*|nepal\w*|madagascar|senegal\w*|rouman\w*|romanian|korean|coree|hongr\w*|hungar\w*)\b/;
  const nationalActor = /\b(?:macron|elysee|matignon|bayrou|lecornu|barnier|assemblee nationale francaise|palais bourbon|french (?:prime minister|government|parliament)|(?:gouvernement|parlement|premier ministre) francais|49 (?:3|alinea 3))\b/;
  const europeanCensure = /\b(?:mercosur|commission europeenne|parlement europeen|european (?:parliament|commission)|von der leyen)\b/;
  const foreignSubject = /\b(?:(?:british|german|italian|spanish|canadian|japanese|belgian|portuguese|nepali|ukrainian|israeli) (?:prime minister|government|parliament|pm)|(?:premie(?:r|re) ministre|gouvernement|parlement|assemblee nationale) (?:britannique|allemand\w*|italien\w*|espagnol\w*|canadien\w*|japonais\w*|belge|portugais\w*|ukrainien\w*|senegalais\w*))\b/;
  const hypothetical = /\b(?:pourrait|pourraient|peut (?:il|elle)|si|hypothese|scenario|risque\w*|menac\w*|envisag\w*|exclu\w*|appelle a|reclame\w*|demande\w*|eventuel\w*|rumeur\w*|souhaite\w*|pour une|vers (?:une?|la)|evit\w*|en cas de|va (?:demissionner|nommer|remettre)|a venir|pourron[st]|devrait|pas de|non recours|abandon\w*|renonc\w*|could|may|might|risk\w*|threat\w*|fear\w*|rumou?r\w*|calls? (?:on|for)|rule[sd]? out|seeks?|expected|avoids?|averts?|possible|imminent\w*)\b/;

  function detect(headline) {
    const whole = normalize(headline);
    if (!france.test(whole)) return [];
    const fragments = headline.split(/[;|]|\s[–—]\s/).map(normalize).filter(Boolean);
    const matches = new Map();
    for (const fragment of fragments) {
      if (foreignSubject.test(fragment) || (foreign.test(fragment) && !nationalActor.test(fragment))) continue;
      if (!france.test(fragment) && (fragments.length > 1 && foreign.test(whole))) continue;
      for (const rule of rules) {
        if (rule.id === 'confidence' && europeanCensure.test(fragment) && !nationalActor.test(fragment)) continue;
        for (let i = 0; i < rule.triggers.length; i++) {
          const hit = fragment.match(rule.triggers[i]);
          const context = rule.contexts?.[i];
          if (!hit || (context && !context.test(fragment))) continue;
          const status = hypothetical.test(fragment) || headline.includes('?') ? 'prospectif' : 'mention';
          matches.set(rule.id, {id: rule.id, label: rule.label, term: hit[0], status});
          break;
        }
      }
    }
    return [...matches.values()];
  }

  function parseCSV(text) {
    const input = String(text ?? '').replace(/^\uFEFF/, '');
    const headerLine = input.split(/\r?\n/, 1)[0];
    const delimiters = [',', ';', '\t'];
    const delimiter = delimiters.sort((a, b) => headerLine.split(b).length - headerLine.split(a).length)[0];
    const rows = [];
    let row = [], field = '', quoted = false, closed = false;
    function finishRow() {
      row.push(field);
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
      field = '';
      closed = false;
    }
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (quoted) {
        if (char !== '"') field += char;
        else if (input[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else if (char === delimiter) {
        row.push(field); field = ''; closed = false;
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && input[i + 1] === '\n') i++;
        finishRow();
      } else if (char === '"' && !field && !closed) {
        quoted = true;
      } else if ((closed && char.trim()) || char === '"') {
        throw new Error('CSV invalide : guillemet inattendu près de l’enregistrement ' + (rows.length + 1) + '.');
      } else if (!closed) field += char;
    }
    if (quoted) throw new Error('CSV invalide : guillemet non fermé.');
    finishRow();
    const aliases = {titre:'headline',title:'headline',publication_date:'date',date_de_publication:'date',media:'source',outlet:'source',lien:'url',link:'url'};
    const headers = (rows.shift() || []).map(cell => {
      const key = normalize(cell).replace(/ /g, '_');
      return aliases[key] || key;
    });
    if (!headers.includes('headline') || !headers.includes('date')) throw new Error('Le CSV doit contenir les colonnes date et headline (ou titre).');
    if (new Set(headers).size !== headers.length) throw new Error('Le CSV contient un nom de colonne en double.');
    return rows.map((cells, i) => {
      if (cells.length !== headers.length) throw new Error('CSV invalide : nombre de champs incorrect à l’enregistrement ' + (i + 2) + '.');
      const record = {};
      for (const key of ['date','source','headline','url']) record[key] = (cells[headers.indexOf(key)] || '').trim();
      return record;
    });
  }

  const percentage = (count, total) => total ? 100 * count / total : null;

  function analyze(records, {start = START, end = END} = {}) {
    if (!validDate(start) || !validDate(end) || start > end || start < MIN_DATE || end > END)
      throw new Error('Choisis une période comprise entre le 01/06/2024 et le 31/10/2026.');
    const daily = [];
    const days = new Map();
    for (let t = Date.parse(start); t <= Date.parse(end); t += DAY) {
      const date = new Date(t).toISOString().slice(0, 10);
      const day = {date, total: 0, matched: 0, frequency: null, counts: Object.fromEntries(rules.map(r => [r.id, 0]))};
      days.set(date, day);
      daily.push(day);
    }
    const seen = new Set();
    const evidence = [];
    let matched = 0, duplicates = 0, outside = 0, invalid = 0;
    for (const row of records) {
      const date = String(row?.date ?? '').trim();
      const headline = String(row?.headline ?? '').trim();
      const source = String(row?.source ?? '').trim();
      if (!validDate(date) || !normalize(headline)) { invalid++; continue; }
      if (date < start || date > end) { outside++; continue; }
      const key = JSON.stringify([date, normalize(source), normalize(headline)]);
      if (seen.has(key)) { duplicates++; continue; }
      seen.add(key);
      const matches = detect(headline);
      const day = days.get(date);
      day.total++;
      if (matches.length) {
        day.matched++;
        matched++;
      }
      for (const hit of matches) day.counts[hit.id]++;
      const status = !matches.length ? 'aucun' : matches.every(hit => hit.status === 'prospectif') ? 'prospectif' : 'mention';
      evidence.push({date, headline, source, url: String(row?.url ?? '').trim(), matches, status});
    }
    evidence.sort((a, b) => a.date.localeCompare(b.date) || a.headline.localeCompare(b.headline, 'fr'));
    const total = evidence.length;
    for (const day of daily) day.frequency = percentage(day.matched, day.total);
    const categories = rules.map(({id, label}) => {
      const count = daily.reduce((sum, day) => sum + day.counts[id], 0);
      return {id, label, count, frequency: percentage(count, total)};
    }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'));

    // A cluster requires contiguous calendar days with a mention of the same category.
    const episodes = [];
    for (const {id, label} of categories) {
      let episode = null;
      for (const day of daily) {
        const count = day.counts[id];
        if (!count) { episode = null; continue; }
        if (!episode) {
          episode = {category: id, label, start: day.date, end: day.date, count: 0, frequency: 0, peakDate: day.date, peakCount: count};
          episodes.push(episode);
        }
        episode.end = day.date;
        episode.count += count;
        episode.frequency = percentage(episode.count, total);
        if (count > episode.peakCount) { episode.peakCount = count; episode.peakDate = day.date; }
      }
    }
    episodes.sort((a, b) => b.count - a.count || a.start.localeCompare(b.start) || a.label.localeCompare(b.label, 'fr'));
    return {total, matched, frequency: percentage(matched, total), duplicates, outside, invalid, categories, episodes, daily, evidence};
  }

  return {MIN_DATE, START, END, analyze, parseCSV, detect};
});
