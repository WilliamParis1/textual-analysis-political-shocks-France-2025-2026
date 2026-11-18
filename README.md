# textual-analysis-political-shocks-France-2025-2026

**To what extent did political shocks in France (09/25 to 10/26) influence government bond yields and sovereign risk premiums, and what do these market reactions reveal about the relationship between political instability and fiscal credibility?**

Cet outil mesure la fréquence à laquelle les titres de la rubrique Politique de Public Sénat évoquent chacun des 21 événements proposés pour cette recherche. Le tableau de résultats se lit directement sur GitHub. [Consulter les fréquences par événement](results/README.md)

## Ouvrir l’outil

[Télécharger le projet au format ZIP](https://github.com/WilliamParis1/textual-analysis-political-shocks-France-2025-2026/archive/refs/heads/main.zip), décompresser le dossier et ouvrir **index.html** dans un navigateur. L’analyse fonctionne hors ligne. Les liens vers les articles s’ouvrent en ligne.

La vue initiale couvre le **1ᵉʳ septembre 2025 au 31 octobre 2026**. « Chronologie complète » étend la sélection au **1ᵉʳ juin 2024** pour inclure les antécédents. Sélectionner un événement pour examiner les titres associés ou importer un fichier CSV pour appliquer les mêmes règles à un autre corpus.

## Mesurer la couverture d’un choc

Le calendrier reprend les dates proposées par le chercheur. Pour chaque événement, le moteur applique des règles lexicales spécifiques aux titres publiés dans sa fenêtre, dates de début et de fin incluses. Un événement peut être évoqué plusieurs fois dans le même titre et ne compter qu’une fois. La mesure inclut les anticipations et les réactions qui satisfont les règles. Le statut documentaire et le lien source permettent de vérifier l’interprétation de l’événement. [Règles par événement](events.js)

| Mesure | Calcul | Question |
|---|---|---|
| Nombre de titres | Titres associés à l’événement dans sa fenêtre | Quel volume de couverture a-t-il reçu ? |
| Fréquence dans la fenêtre | 100 × titres associés / tous les titres publiés dans cette fenêtre | Quelle place occupait-il dans l’actualité de ces journées ? |
| Fréquence dans la période | 100 × titres associés / tous les titres de la période sélectionnée | Quelle part du corpus lui est attribuée ? |

Le classement par volume favorise les fenêtres longues. La part locale dépend aussi du nombre de titres publiés ce jour-là. Lire les deux mesures ensemble. Avec un corpus observé, zéro signifie qu’aucun titre ne satisfait la règle. En l’absence de titres dans la fenêtre, la fréquence est indéfinie. Les rétrospectives publiées hors de la fenêtre échappent au comptage par événement.

Une recherche complémentaire par famille détecte notamment les votes de confiance, les changements de gouvernement et les blocages budgétaires tout au long de la période. Elle utilise son propre dictionnaire français-anglais et peut retrouver une mention en dehors du calendrier. Une même une peut relever de plusieurs familles. [Règles générales](engine.js)

## Corpus et reproductibilité

Le corpus livré comprend **3 396 métadonnées d’articles** couvrant 29 mois, dont **1 827** sur les 14 mois du mémoire. La collecte parcourt les billets publiés dans l’intervalle via l’API WordPress de Public Sénat. Elle retient les URL de la rubrique Politique, indépendamment des mots employés dans le titre. Chaque ligne conserve la date de publication locale, le média, le titre et son lien. [Source](https://www.publicsenat.fr/actualites/politique) · [Corpus CSV](data/headlines.csv)

Pour un import personnel, fournir un fichier UTF-8 avec les colonnes `date` (AAAA-MM-JJ), `headline` et, de préférence, `source` et `url`. Inclure tous les titres qui satisfont la règle d’échantillonnage choisie, y compris ceux sans choc politique. L’analyse déduplique sur la date, le média et le titre normalisés. Deux médias distincts publiant le même titre comptent comme deux publications.

La couverture dépend du média, de la rubrique, de la longueur des fenêtres et des termes choisis. Les règles explicites peuvent manquer une allusion ou associer un titre ambigu. Le registre conserve les éléments permettant de relire chaque correspondance. Une autre collecte peut refléter des corrections ou des retraits effectués depuis par la rédaction.

Depuis la racine du dépôt, Python 3.9+ et Node.js 18+ suffisent pour régénérer les résultats. Seule la première commande utilise le réseau.

```sh
python3 scripts/collect_public_senat.py
python3 scripts/bundle_corpus.py
node scripts/report.js
node --test engine.test.js events.test.js
```

## Rapprochement avec les taux souverains

La série quotidienne du mémoire contient une ligne par jour calendaire, le nombre de titres disponibles, le nombre de titres associés au calendrier, leur part et un indicateur de volume par événement. Les jours observés avec zéro mention et les jours sans couverture sont distingués. Pour une étude de marché, aligner les dates et heures des annonces avec les clôtures de marché, puis comparer les variations de l’OAT française à celles du Bund allemand de même maturité. Le classement médiatique fournit des dates candidates. L’estimation de l’effet sur les rendements et sur l’écart OAT–Bund nécessite les séries de taux correspondantes.

[Série quotidienne](results/quotidien_etude.csv) · [Fréquences des 21 événements](results/evenements.csv) · [Titres associés et sources](results/titres_comptes.csv)
