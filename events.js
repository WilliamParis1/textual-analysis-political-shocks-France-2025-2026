// Calendar windows are inclusive. A match measures coverage, including previews and reactions.
(function (root) {
  'use strict';
  const protest = /manifest|mobilis|mobiliz|protest|greve|strike|blocus|blocage|blockade|rallies|unrest/;
  const budget = /\bbudget|loi de finances|finance bill/;
  const passage = /adopt|approuv|vote definitif|final|secur(?:es|ed)|pass(?:es|ed)|through parliament/;
  const lePen = /\ble pen\b/;
  const verdict = /ineligib|eligib|condamn|convict|sentenc|verdict|jugement|cour d appel|appeal|barred|running ban|bracelet|cassation/;
  const pension = /retraites?|pension/;
  const pause = /suspen|suspend|paus|delay|concession|freeze|gel de la reforme/;
  const election = /legislatives?|snap (?:parliamentary )?elections?|french (?:parliamentary|legislative) elections?/;
  const confidence = /vote of confidence|vote de confiance|confidence vote|chute|renvers|defaite|voted (?:down|out)|loses(?: the)? vote|falls?|toppl|oust/;
  const fiscalTarget = /deficit|fiscal target/;
  const ballot = /premier tour|second tour|premiers? resultats?|resultats?|majorite|hung parliament|majority|first round|second round|sort en tete|arrive en tete|bloc.*en tete|rn en tete/;
  // Conditions separated by "and" must occur together in a title, in either order.
  const all = (...patterns) => text => patterns.every(pattern => pattern.test(text));
  const either = (...tests) => text => tests.some(test => test(text));
  const study = [
    ['dissolution-2024','Dissolution de l’Assemblée nationale','2024-06-09',null,
      all(/dissol|snap election/,/assemblee|macron|france|french|parliament/)],
    ['legislatives-2024','Législatives anticipées et absence de majorité','2024-06-30','2024-07-07',
      either(all(election,ballot),all(/france|french|assemblee/,/hung parliament|sans majorite|absence de majorite/))],
    ['barnier-nomination','Nomination de Michel Barnier à Matignon','2024-09-05',null,
      all(/barnier/,/premier ministre|prime minister|matignon|nomination|nomme|appoin|passation/)],
    ['barnier-censure','Chute du gouvernement Barnier','2024-12-04',null,
      all(/barnier/,/censure|no confidence|toppl|falls?|fall of|chute|oust|demiss|resign|renvers|apres barnier/)],
    ['bayrou-budget','Adoption du budget 2025 sous François Bayrou','2025-02-05','2025-02-06',
      all(budget,/bayrou|2025|france|french/,passage)],
    ['lepen-ineligibilite','Inéligibilité de Marine Le Pen en première instance','2025-03-31',null,
      all(lePen,verdict)],
    ['bayrou-economies','Présentation du plan d’économies de Bayrou','2025-07-15',null,
      all(/bayrou/,/budget|economies|savings|spending cuts|austerit|jours feries/) ],
    ['bayrou-annonce','Annonce par Bayrou du vote de confiance','2025-08-25',null,
      all(/bayrou/,/vote de confiance|confidence vote|vote of confidence/)],
    ['bayrou-chute','Défaite de Bayrou au vote de confiance','2025-09-08',null,
      all(/bayrou/,confidence)],
    ['mobilisation-sept-2025','Mobilisations contre les mesures d’austérité','2025-09-10','2025-09-18',
      either(all(/bloquons tout|block everything/),all(protest,/10 septembre|18 septembre|september (?:10|18)|anti austerit|budget cuts|orientations budgetaires|contre l austerite|lecornu|macron|austerity/))],
    ['lecornu-demission-retour','Démission puis reconduction de Lecornu','2025-10-06','2025-10-10',
      all(/lecornu/,/demission|recondu|renomm|reappoint|appoint.*again|returns?|resign|quits?|steps down|back as|retour a matignon/)],
    ['retraites-concession','Concession sur les retraites et survie du gouvernement','2025-10-14','2025-10-16',
      either(all(pension,pause),all(/lecornu|gouvernement|lfi/,/non censure|rejet de la motion de censure|survi.*(?:censure|confidence)/))],
    ['retraites-vote','Vote des députés sur la suspension de la réforme des retraites','2025-11-12',null,
      all(pension,pause,/deput|assemblee|mps|lawmakers|parliament|vote|valid|adopt/)],
    ['budget-2026','Adoption définitive du budget 2026','2026-02-02',null,
      all(budget,/2026|france|french|lecornu/,passage)],
    ['lepen-appel','Arrêt en appel et candidature de Marine Le Pen','2026-07-07',null,
      all(lePen,verdict)],
    ['deficit-cible','Report de l’objectif de déficit public','2026-09-17','2026-09-18',
      all(fiscalTarget,/report|recul|repouss|retard|delay|postpon|defer|misses|manqu|renonc|revis|decal|later|5 %.*2027|5 pour cent.*2027/)],
    ['mobilisation-sept-2026','Mobilisation des étudiants et des salariés contre les coupes','2026-09-29',null,
      all(protest,/etudiant|lycee|lyceen|student|travailleur|salarie|worker|fonctionnaire|public sector/,/coupes|cuts|austerit|economies|lack of funds|moyens insuffisants|spending/)],
    ['budget-2027','Dépôt du budget 2027 par le gouvernement Lecornu','2026-10-01',null,
      all(budget,/2027/,/present|projet|depo|leve le voile|unveil|table[sd]?|introduc|submit|announc/)],
    ['manifestations-17-oct','Intensification des manifestations nationales','2026-10-17',null,
      all(/manifest|mobilis|mobiliz|protest|violenc|emeute|unrest|riot/,/17 octobre|october 17|nationwide|national|france|french|dans (?:tout le|le) pays|vie chere|gilets jaunes/)],
    ['rejet-plfss','Rejet du budget de la Sécurité sociale par les députés','2026-10-23',null,
      all(/plfss|financement de la securite sociale|budget (?:de la (?:secu|securite sociale)|de la protection sociale)|social security (?:bill|budget)/,/rejet|rejett|reject|voted? (?:down|against)|defeat/) ],
    ['manifestations-fin-oct','Poursuite des manifestations malgré les concessions','2026-10-24','2026-10-31',
      either(all(protest,/24 octobre|31 octobre|october (?:24|31)|concession|malgre les promesses|gilets jaunes|vie chere|acte (?:ii|2|iii|3)\b/),all(/mobilisations sociales/,/samedi prochain|troisieme samedi|second samedi/,/macron|lecornu/))],
  ];

  // Independent references document each calendar entry; only imported corpus titles count.
  const references = [
    ["Macron dissolves the Assembly", "Dissolution de l’Assemblée nationale : quelles conséquences parlementaires ?", "https://www.publicsenat.fr/actualites/politique/dissolution-de-lassemblee-nationale-quelles-consequences", null],
    ["Snap election leaves no majority", "CARTE. Législatives 2024 : retrouvez l’intégralité des résultats du second tour", "https://www.publicsenat.fr/actualites/politique/elections-legislatives-retrouvez-les-resultats-du-second-tour-en-temps-reel", null],
    ["Barnier becomes prime minister", "Matignon : Michel Barnier (LR) nommé Premier ministre", "https://www.publicsenat.fr/actualites/politique/matignon-michel-barnier-lr-nomme-premier-ministre", null],
    ["Barnier’s government falls", "Censure du gouvernement Barnier : retrouvez notre émission spéciale en replay", "https://www.publicsenat.fr/actualites/politique/censure-du-gouvernement-barnier-suivez-notre-emission-speciale-sur-public-senat-et-lcp", null],
    ["Bayrou secures a late budget", "Budget 2025 : le texte définitivement adopté par le Parlement, après un dernier vote du Sénat", "https://www.publicsenat.fr/actualites/parlementaire/budget-2025-le-texte-definitivement-adopte-par-le-parlement-apres-un-dernier-vote-du-senat", null],
    ["Le Pen barred from running", "Procès des assistants RN : Marine Le Pen écope de 5 ans d’inéligibilité immédiate", "https://www.publicsenat.fr/actualites/politique/proces-rn-marine-le-pen-et-8-eurodeputes-reconnus-coupables-de-detournement-de-fonds-publics", null],
    ["Bayrou unveils his savings plan", "Budget 2026 : suppression de 2 jours fériés, année blanche, contribution des hauts revenus… Ce qu’il faut retenir des annonces de François Bayrou sur le budget", "https://www.publicsenat.fr/actualites/politique/budget-2026-suivez-en-direct-les-annonces-de-francois-bayrou", null],
    ["Bayrou calls a confidence vote", "Bayrou demande un vote de confiance le 8 septembre à l’Assemblée nationale pour acter l’urgence financière du pays", "https://www.publicsenat.fr/actualites/politique/bayrou-demande-un-vote-de-confiance-le-8-septembre-a-lassemblee-nationale-pour-acter-lurgence-financiere-du-pays", null],
    ["Bayrou loses the vote", "Vote de confiance : l’Assemblée nationale se prononce contre, entraînant la chute du gouvernement Bayrou", "https://www.publicsenat.fr/actualites/politique/vote-de-confiance-lassemblee-nationale-se-prononce-contre-entrainant-la-chute-du-gouvernement-bayrou", null],
    ["Anti-austerity protests spread", "18 septembre : nombre de manifestants, slogans, déclarations…Revivez la journée de mobilisation en France", "https://www.publicsenat.fr/actualites/politique/direct-greve-du-18-septembre-suivez-la-journee-de-mobilisation-en-france", null],
    ["Lecornu quits, then returns", "Crise politique : Sébastien Lecornu renommé Premier ministre par Emmanuel Macron", "https://www.publicsenat.fr/actualites/politique/crise-politique-sebastien-lecornu-renomme-premier-ministre-par-emmanuel-macron", null],
    ["Pension concession saves Lecornu", "Suspension de la réforme des retraites, pas de 49.3, budget : ce qu’il faut retenir du discours de politique générale de Sébastien Lecornu", "https://www.publicsenat.fr/actualites/politique/en-direct-discours-de-politique-generale-censure-la-journee-a-haut-risque-de-sebastien-lecornu", "L’annonce et le vote de censure sont documentés. Leur lien causal reste à examiner."],
    ["MPs back the pension suspension", "L’Assemblée nationale valide la suspension de la réforme des retraites", "https://www.publicsenat.fr/actualites/politique/lassemblee-nationale-valide-la-suspension-de-la-reforme-des-retraites", null],
    ["2026 budget finally passes", "Impôts, dépenses, économies : tout savoir sur le budget 2026 définitivement adopté", "https://www.publicsenat.fr/actualites/politique/impots-depenses-economies-tout-savoir-sur-le-budget-2026-en-passe-detre-definitivement-adopte", null],
    ["Le Pen’s appeal reopens her bid", "Marine Le Pen condamnée à 1 an ferme sous bracelet, mais éligible en 2027, elle pourrait être candidate à la présidentielle", "https://www.publicsenat.fr/actualites/politique/marine-le-pen-condamnee-a-1-an-ferme-sous-bracelet-mais-eligible-en-2027-pourrait-etre-candidate-a-la-presidentielle", null],
    ["France postpones its deficit target", "Budget 2027 : qui sera touché par les économies proposées par le gouvernement ?", "https://www.publicsenat.fr/actualites/politique/budget-2027-qui-sera-touche-par-les-economies-proposees-par-le-gouvernement", "Le média décrit le glissement de la cible de déficit de 5 % de 2026 à 2027."],
    ["Students and workers protest cuts", "Blocus des lycées : « Une fois sorti du tube, le dentifrice ne rentre plus »", "https://www.publicsenat.fr/actualites/politique/blocus-des-lycees-une-fois-sorti-du-tube-le-dentifrice-ne-rentre-plus", "Le média documente le blocus lycéen et les manifestations d’agents publics."],
    ["Lecornu tables the 2027 budget", "Assemblée nationale · Projet de loi de finances pour 2027, n° 3210", "https://www.assemblee-nationale.fr/dyn/17/dossiers/PLF_2027", "Le dossier législatif date le dépôt du 1er octobre 2026."],
    ["Nationwide protests escalate", "Violences du 17 octobre : Macron exprime sa « colère » et sa « honte » et promet « toute la transparence »", "https://www.publicsenat.fr/actualites/politique/violences-du-17-octobre-macron-exprime-sa-colere-et-sa-honte-et-promet-toute-la-transparence", "Récit publié le 18 octobre sur les violences du 17."],
    ["MPs reject the social-security budget", "Assemblée nationale · Projet de loi de financement de la Sécurité sociale pour 2027, n° 3211", "https://www.assemblee-nationale.fr/dyn/17/dossiers/PLFSS_2027", "Le dossier législatif date le rejet en première lecture du 23 octobre 2026."],
    ["Protests outlast concessions", "Mobilisation du 31 octobre : à quoi faut-il s’attendre ?", "https://www.publicsenat.fr/actualites/politique/mobilisation-du-31-octobre-a-quoi-faut-il-sattendre", "Le média décrit les mobilisations des 17 et 24 octobre et les appels du 31 malgré les annonces."],
  ];

  function normalize(text) {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/œ/g, 'oe').replace(/[^a-z0-9%]+/g, ' ').trim();
  }

  // Generic cues such as "budget" or "manifestations" are ambiguous in international imports.
  const foreign = /\b(allemagne|allemand\w*|germany|german|berlin|italie|italian|italy|rome|espagne|spanish|spain|madrid|portugal|belgique|belgium|belge|belgian|britannique|britain|british|london|royaume uni|ukraine|canada|etats unis|united states|congres americain|union europeenne|european union|european parliament)\b/;
  const france = /\b(france|francais\w*|french|macron|bayrou|barnier|lecornu|le pen|matignon|elysee)\b/;
  function rank(evidence, options = {}) {
    const startFilter = options.start || '2024-06-01';
    const endFilter = options.end || '2026-10-31';
    const eligible = evidence.filter(row => row.date >= startFilter && row.date <= endFilter);
    return study.map(([id, label, start, lastDate, isMatch], index) => {
      const end = lastDate || start;
      const [labelEn, sourceTitle, sourceUrl, note] = references[index];
      const outside = start > endFilter || end < startFilter;
      const sample = eligible.filter(row => row.date >= start && row.date <= end);
      const windowTotal = sample.length;
      const titles = sample.filter(row => {
        const text = normalize(row.headline);
        return (!foreign.test(text) || france.test(text)) && isMatch(text);
      });
      let coverage = 'covered';
      if (outside) coverage = 'outside';
      else if (!windowTotal) coverage = 'unobserved';
      else if (start < startFilter || end > endFilter) coverage = 'partial';
      const count = windowTotal ? titles.length : null;
      return {id, label, labelEn, date:start, start, end, sourceTitle, sourceUrl,
        statusLabel:note || 'Événement documenté par Public Sénat.', coverage, windowTotal, count,
        frequency:windowTotal ? 100 * count / eligible.length : null,
        windowFrequency:windowTotal ? 100 * count / windowTotal : null, titles};
    }).sort((a,b) => (b.count ?? -1) - (a.count ?? -1) || a.start.localeCompare(b.start));
  }

  const api = {rank};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ShockEvents = api;
})(globalThis);
