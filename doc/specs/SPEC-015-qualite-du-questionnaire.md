---
id: SPEC-015
titre: Qualité du questionnaire de casting
statut: validée
date: 2026-11-03
origine: ../archive/todo/indicateurs-du-questionnaire-de-casting.md
epics: [EPIC-037]
adr: [ADR-0050, ADR-0051, ADR-0061]
---

# SPEC-015 : Qualité du questionnaire de casting

## Objectif

L'équipe d'un jeu écrit les questions du formulaire d'inscription qui servent au casting, et les relie aux personnages, factions et intrigues ([SPEC-001](SPEC-001-inscriptions.md), R8, R27). Limbus lui dit si ce questionnaire permet de choisir, avant les inscriptions puis avec les réponses reçues, et ce qu'il faut corriger. Les repères reposent sur des indicateurs reconnus en statistique et en méthodologie des questionnaires ([ADR-0061](../adr/ADR-0061-indicateurs-du-questionnaire.md)), traduits en phrases pour une équipe qui n'est pas formée aux statistiques.

Fiche d'origine : [Indicateurs du questionnaire de casting](../archive/todo/indicateurs-du-questionnaire-de-casting.md).

## Vocabulaire

- **Repère** : un constat sur le questionnaire, avec un niveau (« bon », « à surveiller », « à revoir », « à confirmer »), une phrase, ce qu'il faut faire, et un détail replié qui donne la valeur statistique, le seuil et la référence.
- **Note** : la note d'une personne pour un personnage, calculée comme dans l'assistant de casting (SPEC-001, R27) : 1 point pour une réponse reliée au personnage, ½ pour sa faction ou son intrigue, une échelle à proportion.
- **Personnage PJ** : un personnage que l'assistant de casting répartit (type `pj`).

## Acteurs et parcours

Organisatrice ou co-organisatrice du jeu :

1. Dans l'éditeur du formulaire d'inscription, sous les liens entre réponses et rôles, elle ouvre l'encadré « Qualité du questionnaire ».
2. Avant toute inscription, elle y voit les repères sur les liens : personnages qu'aucune réponse ne rejoint, questions et options sans lien, personnages que les liens ne distinguent pas.
3. Une fois des réponses reçues, elle y voit aussi les repères sur les réponses : questions qui ne départagent pas, questions qui font doublon, personnages indistincts chez les inscrits, personnages peu ou trop demandés, puis une estimation générale.
4. Elle corrige le formulaire ou ses liens, enregistre, et les repères sont recalculés.

Les personnes inscrites ne voient rien de tout cela.

## Règles métier

### Présentation

- **R1** Les repères sont dans l'éditeur du formulaire d'inscription du jeu, dans un encadré « Qualité du questionnaire » placé sous les liens. Ils portent sur le formulaire et les liens enregistrés, et se recalculent après chaque enregistrement.
- **R2** Chaque repère donne :
  - un niveau : « bon », « à surveiller », « à revoir », ou « à confirmer » quand les réponses ne suffisent pas encore à conclure (R7) ;
  - une phrase avec des comptes concrets (« 8 personnes sur 10 ont choisi Intrigue ») ;
  - ce qu'il faut faire pour corriger ;
  - un détail replié : la valeur de l'indicateur, son seuil et sa référence.
- **R3** Les repères ne jugent que le questionnaire. Les contraintes bloquantes et les affinités (SPEC-001, R25, R28) restent dans l'assistant de casting.

### Repères sur les liens, avant les inscriptions

- **R4** Personnage sans lien : un personnage PJ dont la note maximale possible est nulle (aucune réponse reliée à lui, à sa faction ou à son intrigue) est « à revoir » : l'assistant ne pourra lui proposer personne.
- **R5** Question et option sans lien :
  - une question à choix ou une échelle dont aucune option n'est reliée à un rôle est « à surveiller » : elle n'aide pas le casting, ce qui peut être voulu ;
  - une option d'une question reliée par ailleurs, mais elle-même reliée à rien, est « à surveiller » : la choisir ne rapporte aucun point.
  Les questions à texte libre ne sont pas concernées.
- **R6** Personnages indistincts par les liens : pour deux personnages PJ, on compare les points que chaque réponse possible leur donne (similarité cosinus des deux profils de points). À partir de 0,80, soit « 8 points sur 10 en commun », ils sont « à revoir » : le questionnaire aura du mal à les départager. Un personnage sans lien (R4) n'est pas comparé.

### Repères sur les réponses reçues

- **R7** Les réponses prises en compte sont celles des inscriptions du jeu qui ont répondu à la question, quelle que soit leur période et leur statut. Une réponse donnée à une option qui n'existe plus dans le formulaire actuel (option retirée ou renommée depuis) n'est pas comptée ; le détail dit combien de réponses sont ainsi laissées de côté. Les repères ne se fondent sur aucun nombre minimal fixé à l'avance : un constat n'est affiché comme « à revoir » que si le test statistique le confirme (ADR-0061). Sinon il est « à confirmer », avec le nombre de réponses déjà reçues. Quand un repère compare de nombreuses paires (R10, R11), les tests sont corrigés pour leur nombre (méthode de Holm), pour qu'une paire ne soit pas signalée par le seul hasard.
- **R8** Question qui ne départage pas : quand une même réponse est choisie par 8 personnes sur 10 ou plus, avec un intervalle de Wilson à 95 % dont la borne basse atteint 0,8, la question est « à revoir ». Si la proportion observée atteint 0,8 sans que la borne basse l'atteigne, elle est « à confirmer ». Pour une question à choix multiples, la règle s'applique à chaque option : une option cochée par presque tout le monde ne départage pas. Pour une question à choix unique ou une échelle, le détail donne aussi l'entropie normalisée ; pour une question à choix multiples, la part de chaque option.
- **R9** Échelle tassée à une extrémité : quand plus de 15 % des réponses sont au minimum ou au maximum de l'échelle (critère de Terwee et al.), avec une borne basse de Wilson au-dessus de 15 %, l'échelle est « à revoir » ; « à confirmer » si seule la proportion observée dépasse 15 %. La règle R8 s'applique aussi aux échelles. Le détail donne aussi la dispersion ordinale de Leik.
- **R10** Questions qui font doublon, pour deux questions à choix unique ou échelles répondues par les mêmes personnes :
  - entre deux questions dont l'une au moins est à choix unique : V de Cramér corrigé (Bergsma). Il est « à revoir » quand il atteint le seuil « fort » de Cohen pour la taille du tableau (0,50 divisé par la racine du plus petit nombre d'options moins un). Il n'est calculé que si les effectifs remplissent les conditions de Cochran ; sinon, « à confirmer » ;
  - entre deux échelles : corrélation de Spearman. Elle est « à revoir » quand la borne basse de son intervalle à 95 % dépasse 0,50 (limite haute de Clark et Watson), « à confirmer » si seule la valeur observée la dépasse.
  La phrase donne la réponse la plus liée : « ceux qui répondent Intrigue à la question 3 répondent presque toujours 4 ou 5 à la question 5 ».
- **R11** Personnages indistincts chez les inscrits : pour deux personnages PJ, corrélation de leurs notes chez les personnes qui ont répondu. Ils sont « à revoir » quand la borne basse de son intervalle à 95 % atteint 0,85 (seuil prudent du critère HTMT), « à confirmer » si seule la valeur observée l'atteint. Ce repère complète R6. Un personnage dont la note est la même pour tout le monde (personne ne donne ses réponses) n'a pas de corrélation : il n'est pas comparé, et R12 le signale. De même, R10 ne compare pas une question à laquelle tout le monde a répondu pareil : R8 la signale déjà.
- **R12** Personnages peu ou trop demandés : pour chaque personne, ses 3 personnages les mieux notés (ex æquo compris, note non nulle).
  - Un personnage que moins de 2 personnes ont parmi leurs 3 meilleurs est « à surveiller » : peu de monde lui correspond. Ce repère n'est pas affiché tant que les personnes qui ont répondu sont moins nombreuses que la moitié des personnages PJ : avant, presque tous les personnages seraient peu demandés, et il n'aurait pas de sens.
  - Un personnage qui est le meilleur de plus de 3 personnes est « à surveiller » : il sera disputé.

### Estimation générale

- **R13** Une estimation générale résume le questionnaire, à partir de l'affectation optimale de l'assistant de casting (sans cadenas ni contraintes) :
  - la note moyenne obtenue par chaque personne, rapportée à la meilleure note qu'elle pouvait avoir ;
  - la part des personnes dont la meilleure note est partagée par plusieurs personnages, avec son intervalle de Wilson.
  Elle liste les repères « à revoir » par ordre d'importance. Ses seuils (« bon », « à revoir ») restent à choisir au lot 3.

## Données

Rien n'est enregistré : les repères se calculent à la lecture, à partir du formulaire, des liens, des personnages et des réponses. Ils ne contiennent aucune donnée personnelle, seulement des comptes. Aucun changement pour l'export et l'effacement des données d'un participant.

## Sécurité et droits

- Les repères sont réservés à l'équipe du jeu, comme les réponses (SPEC-001, R24) : la route vérifie l'accès au jeu (`requireGameAccess`).
- La nouvelle route liée à un jeu entre dans `tests/integration/isolation.test.ts` : Alice n'obtient pas les repères du jeu de Bob, avec un témoin positif.
- Les repères ne nomment aucune personne inscrite.

## Hors périmètre

- Questions à texte libre : aucune analyse.
- Doublons entre une question à choix multiples et une autre question : les options d'une question à choix multiples ne sont jugées que par R8.
- Repères pour l'assistant d'IA (SPEC-014) : pas d'outil pour l'instant.
- Repères par session : ils portent sur le jeu entier.

## Découpage

1. **Repères sur les liens** ([EPIC-037](../epics/EPIC-037-qualite-du-questionnaire-liens/README.md)) : encadré, route, R1 à R6.
2. **Repères sur les réponses** : R7 à R12.
3. **Estimation générale** : R13, avec le choix de ses seuils.

## Historique

- 2026-11-03 : création, avec les choix de l'utilisatrice : tous les repères proposés sur les liens et sur les réponses ; affichage dans l'éditeur du formulaire ; questionnaire seul, sans les contraintes ; indicateurs statistiques reconnus plutôt que des pourcentages fixés à la main (ADR-0061) ; fiabilité jugée par les tests seuls, sauf pour « peu demandé », un simple compte qu'aucun test ne juge : il n'est affiché qu'à partir de réponses aussi nombreuses que la moitié des personnages PJ ; seuil HTMT de 0,85 ; « 8 personnes sur 10 » pour une question qui ne départage pas ; demande jugée par les 3 meilleurs personnages ; phrase, couleur et détail replié.
