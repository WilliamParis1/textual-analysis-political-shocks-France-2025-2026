(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const studyStart = '2025-09-01';
  const historyStart = '2024-06-01';
  const studyEnd = '2026-10-31';
  const pageSize = 12;
  const pctFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
  const fullMonthFormat = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long', timeZone: 'UTC' });
  const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const info = window.CORPUS_INFO || {};
  const bundled = window.DEFAULT_CORPUS || [];
  let records = bundled;
  let corpusLabel = info.label || 'Corpus fourni';
  let custom = false;
  let result, events = [], displayed = [], page = 0, episodeExpanded = false;
  let eventsByTitle = new Map(), namedDaily = new Map();
  let scope = null;
  let importSequence = 0;

  function node(tag, value, className) {
    const el = document.createElement(tag);
    if (value != null) el.textContent = value;
    if (className) el.className = className;
    return el;
  }
  function button(value, click, className) {
    const el = node('button', value, className);
    el.type = 'button';
    el.addEventListener('click', click);
    return el;
  }
  function percent(value) {
    return value == null || !Number.isFinite(value) ? '—' : pctFormat.format(value) + ' %';
  }
  function date(value) { return dayFormat.format(new Date(value + 'T12:00:00Z')); }
  function span(start, end) { return start === end ? date(start) : date(start) + ' – ' + date(end); }
  function noun(n, singular, plural) { return n.toLocaleString('fr-FR') + ' ' + (n === 1 ? singular : plural); }
  function note(text) { byId('feedback').textContent = text; }
  function link(label, url) {
    let parsed;
    try { parsed = new URL(url); } catch { return node('span', label); }
    if (!['http:', 'https:'].includes(parsed.protocol)) return node('span', label);
    const anchor = node('a', label);
    anchor.href = parsed.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    return anchor;
  }
  function dateRange() { return { start: byId('start').value, end: byId('end').value }; }
  function setDates(start, end) {
    byId('start').value = start;
    byId('end').value = end;
    refresh();
  }
  function renderMonths() {
    const months = new Map();
    for (const day of result.daily) {
      const key = day.date.slice(0, 7);
      const group = months.get(key) || { total: 0, matched: 0, first: day.date };
      group.last = day.date;
      group.total += day.total;
      group.matched += namedDaily.get(day.date)?.size || 0;
      months.set(key, group);
    }
    const container = byId('months');
    container.replaceChildren();
    const peak = Math.max(1, ...Array.from(months.values(), v => v.total ? v.matched / v.total * 100 : 0));
    for (const group of months.values()) {
      const monthDate = new Date(group.first + 'T12:00:00Z');
      const rate = group.total ? 100 * group.matched / group.total : null;
      const title = fullMonthFormat.format(monthDate) + ' · ' + (rate == null ? 'sans données' : percent(rate) + ' (' + group.matched + ' / ' + group.total + ')');
      const el = button(null, () => setDates(group.first, group.last), 'month');
      el.title = title;
      el.setAttribute('aria-label', 'Filtrer sur ' + title);
      const track = node('span', null, 'month-track');
      const bar = node('i', null, 'month-bar' + (rate == null ? ' missing' : ''));
      if (rate != null) bar.style.height = 100 * rate / peak + '%';
      track.append(bar);
      const short = monthFormat.format(monthDate).replace('.', '');
      el.append(track, node('span', short), node('span', group.first.slice(2, 4)));
      container.append(el);
    }
  }
  function scopeEvidence(label, predicate, family = '') {
    scope = predicate ? { label, predicate } : null;
    byId('search').value = '';
    byId('status').value = 'all';
    byId('family').value = family;
    renderEvidence(true);
    byId('registre').scrollIntoView({ block: 'start' });
  }
  function rankedRow(label, count, meta, action) {
    const row = node('div', null, 'rank-row');
    row.append(button(label, action, 'row-button'), node('strong', noun(count, 'titre', 'titres')), node('span', meta, 'row-meta'));
    return row;
  }
  function renderCategories() {
    const box = byId('categories');
    box.replaceChildren();
    const select = byId('family');
    select.replaceChildren(new Option('Toutes les familles', ''));
    for (const family of result.categories) {
      select.add(new Option(family.label, family.id));
      const row = rankedRow(family.label, family.count, percent(family.frequency) + ' du corpus', () => scopeEvidence('', null, family.id));
      const bar = node('span', null, 'bar');
      const fill = node('i');
      fill.style.width = (family.frequency || 0) + '%';
      bar.append(fill);
      bar.style.gridColumn = '1 / -1';
      row.append(bar);
      box.append(row);
    }
  }
  function renderEpisodes() {
    const box = byId('episodes');
    box.replaceChildren();
    const visible = episodeExpanded ? result.episodes : result.episodes.slice(0, 5);
    for (const ep of visible) {
      const displayDates = span(ep.start, ep.end);
      const label = ep.label + ' · ' + displayDates;
      const row = rankedRow(ep.label, ep.count, displayDates + ' · ' + percent(ep.frequency) + ' du corpus', () =>
        scopeEvidence(label, item => item.date >= ep.start && item.date <= ep.end && item.matches.some(m => m.id === ep.category)));
      box.append(row);
    }
    if (!visible.length) box.append(node('p', 'Aucun épisode détecté sur cette période.', 'empty'));
    const more = byId('more-episodes');
    more.hidden = result.episodes.length <= 5;
    more.textContent = episodeExpanded ? 'Réduire le classement' : 'Voir les ' + result.episodes.length + ' épisodes';
  }
  const coverageLabels = {
    outside: 'Hors période', unobserved: 'Fenêtre sans titre', partial: 'Fenêtre partiellement couverte', covered: 'Fenêtre couverte'
  };
  function eventRow(ev) {
    const row = node('tr', null, 'event-row');
    const event = node('td');
    if (ev.count > 0) {
      const selection = new Set(ev.titles);
      event.append(button(ev.label, () => scopeEvidence(ev.label + ' · ' + span(ev.start, ev.end), item => selection.has(item)), 'row-button'));
    } else {
      event.append(node('span', ev.label, 'event-name'));
    }
    const meta = node('small', [span(ev.start, ev.end), ev.statusLabel].filter(Boolean).join(' · '), 'row-meta');
    if (ev.sourceUrl) {
      const reference = link('Source ↗', ev.sourceUrl);
      reference.title = ev.sourceTitle || ev.label;
      meta.append(' · ', reference);
    }
    event.append(meta);
    const count = node('td', ev.count == null ? '—' : ev.count);
    const globalShare = node('td', percent(ev.frequency));
    const local = node('td', percent(ev.windowFrequency));
    if (ev.count != null) local.append(node('small', 'sur ' + noun(ev.windowTotal, 'titre', 'titres')));
    if (ev.coverage !== 'covered') local.append(node('small', coverageLabels[ev.coverage] || ''));
    for (const [cell, label] of [[count, 'Titres associés'], [globalShare, 'Part de la période'], [local, 'Part de la fenêtre']]) cell.dataset.label = label;
    row.append(event, count, globalShare, local);
    return row;
  }
  function eventTable(items) {
    const table = node('table', null, 'event-table');
    const head = table.createTHead().insertRow();
    for (const label of ['Événement et fenêtre', 'Titres associés', 'Part de la période', 'Part de la fenêtre']) {
      const th = node('th', label); th.scope = 'col'; head.append(th);
    }
    const body = table.createTBody();
    for (const ev of items) body.append(eventRow(ev));
    return table;
  }
  function renderEvents() {
    const parent = byId('events');
    parent.replaceChildren();
    const measured = events.filter(ev => ev.count != null);
    const missing = events.filter(ev => ev.count == null);
    if (!measured.length) parent.append(node('p', 'Aucune fenêtre du calendrier ne contient de titre analysé sur la période sélectionnée.', 'empty'));
    if (measured.length) parent.append(eventTable(measured));
    if (missing.length) {
      const details = node('details');
      details.append(node('summary', 'Afficher les fenêtres hors période ou sans observation (' + missing.length + ')'));
      details.append(eventTable(missing));
      parent.append(details);
    }
    parent.append(button('Exporter le classement des événements', exportEvents, 'export-events'));
  }
  function normalize(text) { return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function renderEvidence(refilter) {
    if (refilter) {
      const q = normalize(byId('search').value).trim();
      const status = byId('status').value;
      const family = byId('family').value;
      displayed = result.evidence.filter(item => {
        if (scope && !scope.predicate(item)) return false;
        if (family && !item.matches.some(m => m.id === family)) return false;
        if (status === 'event' && !eventsByTitle.has(item)) return false;
        if (status === 'matched' && !item.matches.length) return false;
        if (status === 'aucun' && item.matches.length) return false;
        if (status === 'prospectif' && !item.matches.some(m => m.status === 'prospectif')) return false;
        return !q || normalize(item.headline + ' ' + item.source).includes(q);
      });
      page = 0;
    }
    byId('scope').hidden = !scope;
    byId('scope-text').textContent = scope ? scope.label : '';
    byId('evidence-count').textContent = noun(displayed.length, 'titre dans le registre filtré', 'titres dans le registre filtré');
    byId('export-evidence').disabled = !displayed.length;
    const tbody = byId('evidence');
    tbody.replaceChildren();
    for (const item of displayed.slice(page * pageSize, (page + 1) * pageSize)) {
      const tr = node('tr');
      const article = node('td');
      article.append(node('div', item.headline));
      const origin = node('small');
      origin.append(link(item.source || (item.url ? 'Article original' : 'Source non renseignée'), item.url));
      article.append(origin);
      const detect = node('td');
      for (const ev of eventsByTitle.get(item) || []) detect.append(node('div', ev.label, 'event-tag'));
      if (item.matches.length) {
        for (const m of item.matches) {
          const group = node('div', m.label);
          group.append(node('small', '« ' + m.term + ' »' + (m.status === 'prospectif' ? ' · prospectif' : '')));
          detect.append(group);
        }
      } else if (!eventsByTitle.has(item)) detect.textContent = 'Aucune mention détectée';
      tr.append(node('td', date(item.date)), article, detect);
      tbody.append(tr);
    }
    const pages = Math.ceil(displayed.length / pageSize);
    byId('page').textContent = (page + 1) + ' / ' + pages;
    byId('paging').hidden = pages <= 1;
    byId('prev').disabled = page <= 0;
    byId('next').disabled = page + 1 >= pages;
  }
  function refresh() {
    const range = dateRange();
    if (!byId('start').checkValidity() || !byId('end').checkValidity() || range.start > range.end) {
      note('Choisis deux dates ordonnées entre juin 2024 et octobre 2026. Les résultats correspondent à la dernière période valide.');
      return;
    }
    note('');
    const next = window.ShockEngine.analyze(records, range);
    result = next;
    scope = null;
    episodeExpanded = false;
    byId('all-dates').disabled = range.start === studyStart && range.end === studyEnd;
    byId('full-dates').disabled = range.start === historyStart && range.end === studyEnd;
    byId('reset').hidden = !custom;
    byId('corpus-label').textContent = corpusLabel;
    events = window.ShockEvents.rank(result.evidence, range);
    eventsByTitle = new Map();
    namedDaily = new Map();
    for (const ev of events) for (const title of ev.titles || []) {
      if (!eventsByTitle.has(title)) eventsByTitle.set(title, []);
      eventsByTitle.get(title).push(ev);
      if (!namedDaily.has(title.date)) namedDaily.set(title.date, new Set());
      namedDaily.get(title.date).add(title);
    }
    const observed = result.daily.filter(day => day.total > 0);
    const coverageText = observed.length ? 'Titres disponibles du ' + date(observed[0].date) + ' au ' + date(observed.at(-1).date) + ' dans la sélection.' : 'Aucun titre disponible dans la sélection.';
    byId('coverage-note').textContent = [(custom ? 'Corpus importé dans cette session.' : info.note), coverageText].filter(Boolean).join(' ');
    byId('frequency').textContent = percent(result.total ? 100 * eventsByTitle.size / result.total : null);
    byId('ratio').textContent = noun(eventsByTitle.size, 'titre associé à un événement', 'titres associés à un événement') + ' sur ' + noun(result.total, 'titre analysé', 'titres analysés') + '.';
    byId('coverage').textContent = noun(observed.length, 'jour avec au moins un titre', 'jours avec au moins un titre') + ' sur ' + noun(result.daily.length, 'jour dans la période', 'jours dans la période') + '.';
    byId('quality').textContent = 'Lignes écartées · ' + noun(result.duplicates, 'doublon', 'doublons') + ', ' + noun(result.invalid, 'ligne invalide', 'lignes invalides') + ', ' + noun(result.outside, 'ligne hors période', 'lignes hors période') + '.';
    renderMonths(); renderEvents(); renderCategories(); renderEpisodes(); renderEvidence(true);
  }
  function csvValue(value) {
    let text = value == null ? '' : String(value);
    if (/^\s*[=+@-]/.test(text) && typeof value !== 'number') text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function download(name, rows) {
    const csv = '\uFEFF' + rows.map(row => row.map(csvValue).join(',')).join('\r\n') + '\r\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = node('a');
    anchor.href = url;
    anchor.download = name + '_' + result.daily[0].date + '_' + result.daily.at(-1).date + '.csv';
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportEvents() {
    const rows = [['evenement', 'debut', 'fin', 'statut', 'couverture', 'mentions', 'titres_periode', 'frequence_periode_pct', 'titres_fenetre', 'frequence_fenetre_pct', 'source']];
    for (const ev of events) rows.push([ev.label, ev.start, ev.end, ev.statusLabel, coverageLabels[ev.coverage], ev.count, result.total, ev.frequency, ev.windowTotal, ev.windowFrequency, ev.sourceUrl]);
    download('evenements', rows);
  }
  function exportDaily() {
    const ids = result.categories.map(c => c.id).sort();
    const orderedEvents = events.filter(e => e.coverage !== 'outside').sort((a, b) => a.start.localeCompare(b.start));
    const rows = [['date', 'titres', 'associes_calendrier', 'frequence_calendrier_pct', 'avec_famille', 'frequence_familles_pct', ...ids, ...orderedEvents.map(ev => ev.id)]];
    for (const d of result.daily) {
      const named = namedDaily.get(d.date) || new Set();
      const counts = new Map();
      for (const title of named) for (const event of eventsByTitle.get(title)) counts.set(event.id, (counts.get(event.id) || 0) + 1);
      rows.push([d.date, d.total, d.total ? named.size : null, d.total ? 100 * named.size / d.total : null, d.total ? d.matched : null, d.frequency, ...ids.map(id => d.total ? d.counts[id] || 0 : null),
        ...orderedEvents.map(ev => d.total ? counts.get(ev.id) || 0 : null)]);
    }
    download('serie_quotidienne', rows);
  }
  function exportEvidence() {
    const rows = [['date', 'source', 'headline', 'url', 'statut', 'familles', 'expressions', 'evenements']];
    for (const e of displayed) rows.push([e.date, e.source, e.headline, e.url, e.status, e.matches.map(m => m.label).join(' | '), e.matches.map(m => m.term).join(' | '), (eventsByTitle.get(e) || []).map(ev => ev.label).join(' | ')]);
    download('registre', rows);
  }
  byId('export-daily').addEventListener('click', exportDaily);
  byId('export-evidence').addEventListener('click', exportEvidence);
  byId('prev').addEventListener('click', () => { page--; renderEvidence(false); });
  byId('next').addEventListener('click', () => { page++; renderEvidence(false); });
  byId('clear-scope').addEventListener('click', () => { scope = null; renderEvidence(true); });
  byId('more-episodes').addEventListener('click', () => { episodeExpanded = !episodeExpanded; renderEpisodes(); });
  byId('search').addEventListener('input', () => renderEvidence(true));
  for (const id of ['family','status']) byId(id).addEventListener('change', () => renderEvidence(true));
  for (const id of ['start','end']) byId(id).addEventListener('change', refresh);
  byId('all-dates').addEventListener('click', () => setDates(studyStart, studyEnd));
  byId('full-dates').addEventListener('click', () => setDates(historyStart, studyEnd));
  byId('file').addEventListener('change', async ev => {
    const file = ev.target.files[0];
    if (!file) return;
    const sequence = ++importSequence;
    try {
      const parsed = window.ShockEngine.parseCSV(await file.text());
      if (sequence !== importSequence) return;
      if (!parsed.length) throw new Error('Le fichier ne contient aucune ligne de titres.');
      const check = window.ShockEngine.analyze(parsed, {start: historyStart, end: studyEnd});
      if (!check.total) throw new Error('Aucun titre valide entre juin 2024 et octobre 2026.');
      records = parsed; corpusLabel = file.name; custom = true;
      const range = dateRange();
      if (!byId('start').checkValidity() || !byId('end').checkValidity() || range.start > range.end) setDates(studyStart, studyEnd);
      else refresh();
      note('Corpus chargé · ' + file.name + '.');
    } catch (err) {
      if (sequence === importSequence) note('Import impossible. ' + err.message);
    } finally { if (sequence === importSequence) ev.target.value = ''; }
  });
  byId('reset').addEventListener('click', () => {
    importSequence++;
    records = bundled; corpusLabel = info.label || 'Corpus fourni'; custom = false;
    setDates(studyStart, studyEnd);
  });
  refresh();
})();
