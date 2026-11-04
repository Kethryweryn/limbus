---
id: SPEC-016
titre: Aide à la conception du questionnaire de casting
statut: validée
date: 2026-11-03
origine: ../archive/todo/aide-a-la-conception-du-questionnaire.md
epics: [EPIC-038]
adr: [ADR-0050, ADR-0051, ADR-0058, ADR-0061, ADR-0062, ADR-0064]
---

# SPEC-016 : Aide à la conception du questionnaire de casting

## Objectif

[SPEC-015](SPEC-015-qualite-du-questionnaire.md) juge le questionnaire de casting à partir de ses liens, puis des réponses reçues. Mais une question corrigée après l'ouverture des inscriptions crée une nouvelle version du formulaire (SPEC-001, R9), et les réponses ne se comparent plus entre elles : mieux vaut corriger avant d'ouvrir. Cette spec aide l'équipe à concevoir son questionnaire avant toute réponse, avec les méthodes reconnues en méthodologie des questionnaires ([ADR-0062](../adr/ADR-0062-aide-a-la-conception-du-questionnaire.md)) :

- essayer le questionnaire comme un joueur et voir quels personnages ressortent ;
- prévoir ses performances, par l'information qu'il peut apporter et par une simulation de répondants ;
- relire la rédaction des questions, par des règles écrites dans Limbus et par l'assistant d'IA de l'organisatrice ;
- mélanger l'ordre des options là où il n'a pas de sens.

Fiche d'origine : [Aide à la conception du questionnaire de casting](../archive/todo/aide-a-la-conception-du-questionnaire.md), avec son état de l'art.

## Vocabulaire

- **Repère**, **note**, **personnage PJ** : comme dans SPEC-015.
- **Question reliée** : une question à choix ou une échelle dont au moins une option (ou l'échelle elle-même) est reliée à un personnage, une faction ou une intrigue.
- **Proportions attendues** : pour chaque option d'une question, la part des personnes qui la choisiront selon l'équipe.
- **Simulation** : un tirage de réponses fictives pour autant de personnes que de personnages PJ, répété de nombreuses fois.

## Acteurs et parcours

Organisatrice ou co-organisatrice du jeu, dans l'éditeur du formulaire d'inscription :

1. Elle écrit ses questions et les relie aux rôles.
2. Elle clique sur « Essayer le questionnaire », répond comme un joueur et voit aussitôt quels personnages ressortent, avec le détail de chaque note. Rien n'est enregistré.
3. Elle indique, si elle le souhaite, les proportions qu'elle attend pour les options. Dans l'encadré « Qualité du questionnaire » (SPEC-015), la partie « Prévision » lui dit si le questionnaire peut départager les personnages et ce que donnerait une inscription typique : personnages peu ou trop demandés, meilleures notes ex æquo.
4. La partie « Rédaction » de l'encadré signale les questions à relire. Elle peut aussi demander à son assistant d'IA une relecture plus large, par la consigne « Relire le questionnaire ».
5. Elle coche « Mélanger les options » sur les questions dont l'ordre n'a pas de sens.
6. Elle corrige, enregistre, et les repères sont recalculés. Une fois les inscriptions ouvertes, la prévision reste visible à côté des repères sur les réponses reçues.

Les personnes inscrites ne voient que l'ordre mélangé des options.

## Règles métier

### Essai par l'équipe

- **R1** Un bouton « Essayer le questionnaire » de l'éditeur du formulaire ouvre une fenêtre avec les questions propres au jeu (hors texte libre), telles qu'un joueur les voit, mélange compris (R13). L'essai porte sur le formulaire et les liens en cours dans l'éditeur, même pas encore enregistrés.
- **R2** À côté des questions, les personnages PJ sont classés par note, recalculée à chaque réponse, comme dans l'assistant de casting (SPEC-001, R27). Chaque personnage montre le détail de sa note (les réponses qui y contribuent et leurs points). Les ex æquo sont signalés, ainsi que les personnages qu'aucune réponse donnée ne rejoint.
- **R3** Rien n'est enregistré : l'essai n'est ni une inscription ni une réponse, et ne compte dans aucun repère.

### Prévision avant les réponses

- **R4** La prévision est une partie « Prévision » de l'encadré « Qualité du questionnaire » (SPEC-015, R1). Elle porte sur le formulaire, les liens et les proportions attendues enregistrés, et suit la présentation des repères (SPEC-015, R2). Elle reste visible une fois des réponses reçues, pour comparer prévision et réalité.
- **R5** Information maximale : chaque question reliée apporte au plus une quantité d'information utile au casting, en bits. Seules comptent les réponses qui changent les notes : pour une question à choix unique, les options qui ont les mêmes liens (ou aucun lien) ne comptent que pour une, et la question apporte log₂ du nombre de groupes ainsi formés ; une échelle reliée apporte log₂(5) ; une question à choix multiples, un bit par option reliée. Départager N personnages PJ demande au moins log₂(N) bits. Si le total des questions reliées est inférieur, le questionnaire est « à revoir » : « vos questions distinguent au plus 12 profils de réponses, pour 16 personnages ». Le détail donne l'information de chaque question et, si l'équipe a indiqué des proportions, l'information attendue avec ces proportions (entropie de Shannon). Ce repère est une condition nécessaire, pas suffisante : la simulation (R7) juge le reste.
- **R6** Proportions attendues : pour chaque question reliée, l'équipe peut indiquer la part attendue de chaque option (chaque niveau d'une échelle ; pour une question à choix multiples, la part des personnes qui cochent chaque option). Sans proportions, chaque option a la même chance, et une option d'une question à choix multiples est cochée une fois sur deux. Les proportions d'une question se donnent pour toutes ses options ou pour aucune : une option laissée vide compte pour 0. Pour une question à choix unique ou une échelle, au moins une part doit être positive. Les proportions sont enregistrées avec le jeu, hors des versions du formulaire, comme les liens : les modifier ne crée pas de version.
- **R7** Simulation : des personnes fictives, autant que de personnages PJ, répondent à toutes les questions reliées selon les proportions de R6. Leurs réponses passent par les mêmes calculs que les vraies réponses dans SPEC-015. La simulation est répétée 1 000 fois, et donne pour chaque résultat sa valeur médiane et une fourchette qui contient 95 % des simulations.
- **R8** Personnages peu ou trop demandés, prévus : la règle de SPEC-015 (R12) s'applique à la médiane des simulations. Un personnage est « à surveiller » quand, pour une inscription typique, moins de 2 personnes l'ont parmi leurs 3 meilleurs, ou plus de 3 l'ont pour meilleur. La phrase dit dans quelle part des simulations c'est le cas : « Aldric serait peu demandé dans 7 simulations sur 10 ».
- **R9** Estimation générale prévue : les deux mesures de SPEC-015 (R13), note obtenue rapportée à la meilleure possible et part des meilleures notes ex æquo, sont données avec leur médiane et leur fourchette. Les seuils de R13 ([ADR-0064](../adr/ADR-0064-estimation-generale-du-questionnaire.md)) s'appliquent directement à la médiane, sans intervalle de Wilson : la note est « bon » à partir de 0,75, « à surveiller » de 0,60 à 0,75, « à revoir » sous 0,60 ; les ex æquo sont « bon » jusqu'à une personne sur deux, « à revoir » au-delà. Il n'y a pas de niveau « à confirmer », car aucune réponse n'est attendue pour lever le doute ; la fourchette reste affichée à côté.
- **R10** La simulation donne le même résultat à chaque ouverture tant que le formulaire, les liens, les personnages et les proportions ne changent pas.

### Relecture des questions

- **R11** La partie « Rédaction » de l'encadré signale, question par question, les défauts que des règles écrites repèrent. Elle porte sur le formulaire enregistré. Chaque signalement est « à surveiller », car une règle de mots se trompe parfois. Il donne la règle, ce qu'il faut vérifier, et en détail la référence :
  - **question à double sens** : un « et » ou un « ou » dans le libellé d'une question à choix ou d'une échelle, ou dans une option, peut faire porter la question sur deux choses à la fois. Vérifier, et sinon scinder ;
  - **double négation** : au moins deux négations dans le libellé ;
  - **format « d'accord / pas d'accord »** : il pousse à acquiescer. Mieux vaut des options propres à la question (« très souvent… jamais ») ;
  - **quantifieur vague** (« souvent », « parfois », « beaucoup », « régulièrement »…) dans le libellé ou une option : chacun le comprend à sa façon. Préférer une fréquence ou une quantité précise quand elle compte ;
  - **question nettement plus longue que les autres** : son nombre de mots est une valeur aberrante parmi les questions du formulaire (au-delà du troisième quartile plus une fois et demie l'écart interquartile, règle de Tukey). Quand presque toutes les questions ont la même longueur, l'écart interquartile est nul et la règle ne s'applique pas. Une question plus longue est en général moins fiable. Le détail donne le nombre de mots de chaque question.
  Une question à texte libre n'a que le repère de longueur.
- **R12** Relecture par l'assistant d'IA : le serveur MCP de Limbus (SPEC-014) propose une consigne « Relire le questionnaire » pour un jeu autorisé. Elle donne à l'assistant les questions et leurs options, les signalements de R11, et les règles étayées de l'état de l'art avec leurs sources, dont celles qu'une règle de mots ne repère pas : question orientée, présupposé, options qui se chevauchent ou qui ne couvrent pas tous les cas, terme technique. Elle lui demande, pour chaque question, le défaut, la règle et une réécriture proposée. L'assistant répond dans la conversation : il n'écrit rien dans Limbus.

### Mélange des options

- **R13** Une question à choix unique ou multiples a une case « Mélanger les options », décochée par défaut. Cochée, ses options s'affichent dans un ordre tiré au hasard à chaque affichage du formulaire. L'équipe la laisse décochée pour une liste qui a un ordre naturel. Le réglage fait partie de la définition du formulaire : le changer après l'ouverture des inscriptions crée une version (SPEC-001, R9). Les réponses, enregistrées par le texte des options, ne changent pas.

## Données

- **Proportions attendues** (R6) : une ligne par option (ou niveau d'échelle) d'une question, avec sa part, rattachée au jeu, hors des versions du formulaire. Comme les liens (ADR-0050), elles suivent l'option par son texte, sont remplacées toutes ensemble par l'éditeur, et sont copiées avec un jeu. Ce ne sont pas des données personnelles.
- **Mélange des options** (R13) : un réglage par question dans la définition versionnée du formulaire.
- L'essai, la prévision et la relecture ne stockent rien.
- Aucune donnée personnelle nouvelle : rien ne change pour l'export, l'effacement ni la politique de confidentialité.

## Sécurité et droits

- L'essai, la prévision et la relecture sont réservés à l'équipe du jeu (`requireGameAccess`), comme les repères de SPEC-015.
- La route des proportions attendues entre dans `tests/integration/isolation.test.ts`, avec un témoin positif.
- La consigne MCP vérifie l'accès au jeu demandé et se limite aux jeux de l'autorisation (SPEC-014). Elle ne contient que le formulaire et les signalements : aucune réponse ni donnée de participant. L'assistant n'écrit rien.

## Hors périmètre

- Test pilote avec des joueurs de confiance : écarté pour l'instant.
- Échelle à plus de 5 niveaux : l'échelle reste de 1 à 5.
- Relecture par une IA appelée par Limbus lui-même : seul l'assistant de l'organisatrice relit, par MCP.
- Correction automatique d'une question : la relecture signale et propose, l'équipe décide.
- Nombre de personnes simulées réglable : c'est toujours le nombre de personnages PJ.

## Découpage

1. **Essai par l'équipe** ([EPIC-038](../archive/epics/EPIC-038-essai-du-questionnaire/README.md)) : R1 à R3, hors mélange des options, qui vient avec R13. Fait.
2. **Prévision** : R4 à R10.
3. **Relecture et mélange** : R11 à R13, et le mélange des options dans l'essai (R1).

Le lot 1 de SPEC-015 ([EPIC-037](../archive/epics/EPIC-037-qualite-du-questionnaire-liens/README.md)) crée l'encadré et sa route, dont l'essai et la prévision lisent les personnages PJ : il passe avant.

## Historique

- 2026-11-03 : création, avec les choix de l'utilisatrice :
  - pistes retenues : essai par l'équipe, prévision, relecture, mélange des options ; test pilote écarté ;
  - spec à part ;
  - relecture par des règles dans Limbus et par l'assistant d'IA, au moyen d'une consigne MCP ;
  - simulation au hasard par défaut, avec des proportions saisies par l'équipe, enregistrées avec le jeu ;
  - autant de personnes simulées que de personnages PJ ;
  - prévision dans l'encadré de SPEC-015 ;
  - essai par un bouton dans l'éditeur ;
  - longueur jugée par rapport aux autres questions du formulaire ;
  - mélange par une case par question ;
  - échelle gardée de 1 à 5 ;
  - ordre des lots : essai, prévision, relecture.
- 2026-11-04 : lot 1 livré ([EPIC-038](../archive/epics/EPIC-038-essai-du-questionnaire/README.md), PR #133).
