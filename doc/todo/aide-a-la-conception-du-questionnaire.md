---
titre: Aide à la conception du questionnaire de casting
statut: à trancher
date: 2026-11-03
---

# Aide à la conception du questionnaire de casting

## Besoin

[SPEC-015](../specs/SPEC-015-qualite-du-questionnaire.md) juge le questionnaire de casting à partir de ses liens, puis des réponses reçues. Mais l'équipe écrit ses questions avant toute réponse. Une question corrigée après l'ouverture des inscriptions crée une nouvelle version du formulaire (R9 de [SPEC-001](../specs/SPEC-001-inscriptions.md)) : les premières personnes gardent leur réponse à l'ancienne question, et les réponses ne se comparent plus entre elles. Mieux vaut corriger avant d'ouvrir.

La méthodologie des questionnaires dispose d'outils pour concevoir une question correctement, et pour prévoir ses performances avant de la poser. Limbus n'en propose aucun aujourd'hui.

## État de l'art

### Évaluer une question sans répondants

Presser et al. (2004) distinguent les méthodes qui interrogent des personnes de celles qui n'en interrogent pas : relecture par des experts, grilles d'appréciation formelles, évaluation automatique ([Presser et al., 2004](https://www.oir.pku.edu.cn/__local/A/56/E9/6AD4FB536A97C331A2C3627431B_50B73A4E_2167C.pdf)). Dans la comparaison de Presser et Blair (1994), la relecture par un panel d'experts est la méthode la moins coûteuse.

- **QAS-99** (Willis et Lessler, 1999) : une grille de 27 questions oui/non en 8 étapes (instructions, clarté, présupposés, connaissances, sujets sensibles, options de réponse…), à passer avant tout essai sur le terrain ([manuel](https://cybercemetery.unt.edu/archive/oilspill/20121017060645/http:/appliedresearch.cancer.gov/areas/cognitive/qas99.pdf)).
- **QUAID** (Graesser et al., 2000 ; 2006) : un outil automatique qui signale les termes techniques peu connus, les termes relatifs vagues, les groupes nominaux ambigus, la syntaxe complexe et la surcharge de la mémoire de travail. Il détecte bien les cinq premiers problèmes, moins bien les présupposés erronés ([Graesser et al.](https://link.springer.com/article/10.3758/BF03207792)).
- **SQP** (Saris et Gallhofer) : il prédit la fiabilité et la validité d'une question à partir de ses caractéristiques codées (forme, nombre d'options, libellés…). Ses prédictions s'appuient sur une méta-analyse d'expériences multitraits-multiméthodes portant sur plus de mille questions ([SQP 2.0](https://www.sociometricresearchfoundation.com/sqp--survey-quality-predictor.html), [Saris et Gallhofer](https://www.upf.edu/documents/3966940/3986764/RECSM_wp024.pdf)).

### Règles de rédaction étayées

- **Question à double sens** : elle porte sur deux choses à la fois ; le signe le plus courant est un « et ». La correction habituelle est de la scinder ([SAGE](https://sk.sagepub.com/ency/edvol/embed/survey/chpt/doublebarreled-question)).
- **Question orientée** : elle introduit un biais dans un sens ([CASRAI](https://casrai.org/guides/leading-questions-in-surveys)).
- **Doubles négations** : à éviter ([Artino et al., 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4059192/table/t2)).
- **« D'accord / pas d'accord »** : ce format pousse à acquiescer. Des options propres à la question (« très souvent… jamais ») donnent de meilleures mesures ([Saris et al., 2010](https://repositori.upf.edu/handle/10230/43541)).
- **Ordre des options** : la place d'une option change la probabilité qu'on la choisisse. Une personne qui répond vite se contente de la première réponse acceptable (« satisficing »). Quand les options sont lues à l'écran, cela favorise les premières (effet de primauté) ; quand elles sont entendues, les dernières (effet de récence) ([Krosnick et Presser, 2010](https://benjaminhirt.myblog.arts.ac.uk/files/2024/01/2009_handbook_krosnick-1.pdf)). Sur une échelle, on choisit plus souvent les niveaux proches de son point de départ ([Survey Research Methods, 2018](https://ojs.ub.uni-konstanz.de/srm/article/view/7263/6594)). Mélanger l'ordre des options d'une liste non ordonnée répartit ce biais entre les options.
- **Nombre de niveaux d'une échelle** : les échelles à 2, 3 ou 4 niveaux discriminent moins bien. La fiabilité, la validité et le pouvoir discriminant augmentent jusqu'à environ 7 niveaux ([Preston et Colman, 2000](https://www.rangevoting.org/optinumb.pdf)). D'autres travaux situent l'optimum entre 4 et 7 niveaux (Lozano, García-Cueto et Muñiz, 2008, « Effect of the number of response categories on the reliability and validity of rating scales », *Methodology*, 4(2), 73-79 ; vu par des résumés, à vérifier dans l'article). L'échelle de Limbus va de 1 à 5.

### Lisibilité en français

La formule de Flesch adaptée au français par Kandel et Moles (1958) donne un score de lisibilité ([TALN 2009](https://aclanthology.org/2009.jeptalnrecital-recital.7.pdf)). Les formules de ce type, comme celle de De Landsheere dérivée de Flesch, ne sont valides que pour des textes d'au moins 200 mots ([Université de Liège](https://orbi.uliege.be/bitstream/2268/23350/1/methodes%20n2.pdf)) : elles ne s'appliquent pas à une question isolée. Pour une question courte, il reste des repères locaux, comme la longueur de la phrase, les mots longs ou les subordonnées.

### Prévoir les performances avant les réponses

- **Information maximale d'une question** : une question à k options apporte au plus log₂(k) bits, quand les options sont choisies à parts égales (entropie, [Dahl et Østerås, 2010](https://mdpi.com/1099-4300/12/2/161/html)). Pour départager N personnages, il faut au moins log₂(N) bits. Avec seulement des questions à 2 options, cela fait au moins 4 questions pour 16 personnages, et bien plus en pratique, car les réponses ne se répartissent jamais également.
- **Simulation** : faire répondre au questionnaire des personnes simulées, au hasard ou selon des proportions que l'équipe suppose, et mesurer ce qui en sort : meilleures notes ex æquo, demande par personnage, note obtenue par l'affectation optimale. Simuler des répondants pour juger un questionnaire avant de le poser est une pratique décrite ([National Academies](https://www.nationalacademies.org/cdn/materials/a1f3d26c-3213-4c8e-93f8-056daf864fcd)). La valeur de la prévision dépend des hypothèses sur les réponses.
- **Répondants simulés par une IA** : utiles pour un premier tri, mais leurs réponses varient trop peu, reproduisent des biais et changent avec la formulation de la consigne (Bisbee et al., 2024, « Synthetic replacements for human survey data? The perils of large language models », *Political Analysis* ; vu par des résumés, à vérifier dans l'article ; [NORC, 2025](https://norc.org/content/dam/norc-org/pdf2025/AAPOR%20LLMs%20Don%27t%20Respond%20Like%20Humans%20-%20Lilian%20Huang.pdf)). Pour relire des questions, une IA repère des défauts, mais distingue mal une question défectueuse d'une bonne ([ISER, 2026](https://www.iser.essex.ac.uk/research/publications/publication-589116)).

### Essayer avec des personnes

Avant le terrain, les entretiens cognitifs (faire dire à voix haute comment on comprend la question) et le test pilote restent les méthodes de référence (Presser et al., 2004). Dans un GN, l'équipe peut faire remplir le formulaire par quelques joueurs de confiance avant d'ouvrir les inscriptions.

## Proposition

Une aide à la conception dans l'éditeur du formulaire, à côté des repères de SPEC-015. Pistes, à trier :

1. **Relecture de chaque question** selon les règles étayées : double sens, négations, format « d'accord / pas d'accord », phrase longue ou subordonnées, termes vagues (« souvent », « beaucoup »). Chaque signalement donne la règle et sa source.
2. **Prévision avant les réponses** :
   - information maximale de chaque question et du questionnaire, comparée à ce qu'il faut pour départager les personnages ;
   - simulation de répondants : répartition prévue de la demande par personnage, part prévue de meilleures notes ex æquo. L'équipe peut indiquer les proportions qu'elle attend pour chaque option. Les réponses simulées passent par les mêmes calculs que les vraies réponses dans SPEC-015 (R12, R13) : prévision et analyse se comparent directement.
3. **Essai du questionnaire par l'équipe** : répondre comme un joueur dans un aperçu et voir aussitôt quels personnages ressortent et pourquoi, sans rien enregistrer.
4. **Bonnes pratiques de forme** : mélanger l'ordre des options d'une liste non ordonnée pour chaque personne ; envisager une échelle à plus de 5 niveaux.
5. **Test pilote** : un lien d'essai à envoyer à quelques joueurs de confiance, dont les réponses servent aux repères de SPEC-015 sans compter comme des inscriptions.

## Découpage envisagé

À préciser une fois les pistes choisies. Par exemple : prévision et essai par l'équipe (pistes 2 et 3), puis relecture des questions (1), puis forme et test pilote (4 et 5).

## Points à trancher

- Quelles pistes retenir, et dans quel ordre.
- Relecture des questions : des règles écrites dans Limbus (repérage de mots et de structures, comme QUAID), ou une relecture par l'assistant d'IA de l'organisatrice (SPEC-014), ou les deux ? Les règles sont prévisibles mais limitées. L'IA voit plus de choses, mais se trompe plus souvent.
- Simulation : réponses au hasard seulement, ou proportions saisies par l'équipe ? Combien de personnes simulées ?
- Mélange de l'ordre des options : faut-il le faire pour toutes les questions à choix non ordonnées, ou en option par question ?
- Échelle : garder 1 à 5, ou passer à 7 niveaux, ce qui changerait les formulaires existants et la note de l'assistant (R27) ?
- Test pilote : ses réponses doivent-elles rester à part des inscriptions, et combien de temps les garder (données personnelles) ?
- Faut-il intégrer cette aide à SPEC-015, ou en faire une spec à part ?
