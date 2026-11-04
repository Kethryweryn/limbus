---
id: ADR-0062
titre: Aide à la conception du questionnaire de casting (information, simulation, règles de relecture, consigne MCP)
statut: accepté
date: 2026-11-03
liens: [SPEC-016, SPEC-015, SPEC-014, ADR-0050, ADR-0051, ADR-0058, ADR-0061]
---

# ADR-0062 : Aide à la conception du questionnaire de casting

## Contexte

[SPEC-016](../specs/SPEC-016-conception-du-questionnaire.md) aide l'équipe d'un jeu à concevoir son questionnaire de casting avant toute réponse. Elle prévoit ses performances, relit la rédaction des questions et mélange l'ordre des options. Comme pour [ADR-0061](ADR-0061-indicateurs-du-questionnaire.md), les méthodes et les seuils viennent de la littérature quand elle en donne, et des choix de l'utilisatrice sinon. L'état de l'art est dans la [fiche d'origine](../archive/todo/aide-a-la-conception-du-questionnaire.md).

## Décision

### Essai par l'équipe (R1 à R3)

- L'essai calcule les notes dans le navigateur avec `castingScore` (`utils/castingAssistant.ts`), à partir du formulaire et des liens en cours dans l'éditeur, et des personnages PJ avec leurs factions et intrigues. Ceux-ci sont rendus par la route de l'encadré, `GET /api/games/:id/registration-form-quality` (SPEC-015, R1) ; l'encadré les passe à l'éditeur, et l'essai ne relit pas cette route, qui recalcule tous les repères.
- Aucune route d'écriture : l'essai n'enregistre rien.

### Information maximale (R5)

| Question reliée | Information maximale | Référence |
|---|---|---|
| Choix unique | log₂(g) bits, g étant le nombre de groupes d'options de mêmes liens (les options sans lien forment un groupe) : deux options qui donnent les mêmes points ne se distinguent pas pour le casting | Shannon (1948) ; Dahl et Østerås (2010) |
| Échelle reliée | log₂(5) bits | idem |
| Choix multiples | un bit par option reliée (chaque option est un oui ou un non) | idem |
| Questionnaire | somme des questions reliées, comparée à log₂(N) pour N personnages PJ | 2^bits profils de réponses distincts au plus |

L'information attendue avec les proportions de l'équipe est l'entropie de Shannon de ces proportions (de chaque option, pour une question à choix multiples). La somme suppose les questions indépendantes : c'est une borne haute, donc le repère ne signale que les cas sûrs.

### Simulation (R6 à R10)

- **Réponses par défaut** : sans proportions, chaque option a la même chance, et chaque option d'une question à choix multiples est cochée une fois sur deux. C'est la loi d'entropie maximale, celle qui ne suppose rien de plus que ce que l'on sait (Jaynes, 1957).
- **Proportions de l'équipe** : pour une question à choix unique ou une échelle, des poids ramenés à une somme de 1 ; pour une question à choix multiples, une probabilité par option, tirée indépendamment des autres. Dès qu'une option d'une question a une part, les autres valent 0 si elles sont vides. Le serveur refuse une question à choix unique ou une échelle dont toutes les parts sont nulles : le schéma zod ne connaît pas le type des questions, qui vient du formulaire en vigueur. Si un changement de formulaire ne laisse que des parts nulles, la question revient à une répartition égale.
- **Personnes simulées** : autant que de personnages PJ, choix de l'utilisatrice. Elles répondent à toutes les questions reliées. Les questions non reliées ne changent aucune note.
- **Calculs** : ceux de SPEC-015, partagés dans `utils/questionnaireQuality.ts` : présence parmi les 3 meilleurs et meilleur personnage (R12), affectation optimale par la méthode hongroise et part des meilleures notes ex æquo (R13). Les points de chaque réponse possible sont calculés une fois par `castingScore`, puis additionnés pour chaque personne fictive : une note est une somme de points par lien, et 1 000 tirages de 60 personnes et 60 personnages feraient sinon 3,6 millions d'appels.
- **Répétitions** : 1 000 simulations. L'erreur de Monte-Carlo d'une proportion estimée sur n simulations est √(p(1−p)/n), au plus 0,016 pour n = 1 000 (Morris, White et Crowther, 2019) : « 7 simulations sur 10 » est juste à 3 points près.
- **Fourchette** : du 2,5ᵉ au 97,5ᵉ centile des 1 000 valeurs. C'est la dispersion d'une inscription à l'autre selon les hypothèses de réponse, pas un intervalle de confiance.
- **Niveaux** : les seuils de SPEC-015 (R12, puis R13 une fois choisis) s'appliquent à la médiane, c'est-à-dire à une inscription typique. Aucun seuil nouveau.
- **Reproductibilité** : un générateur pseudo-aléatoire à graine, dont la graine est une empreinte du formulaire, des liens, des personnages et des proportions. Le même questionnaire donne la même prévision. L'empreinte et le calcul prennent ces éléments dans un ordre fixé, car la base ne garantit pas celui des liens ni des personnages de même nom. L'empreinte ne contient ni libellé de question ni nom : corriger une faute ne change pas la prévision.
- **Où** : la simulation tourne dans le navigateur, hors du fil principal (Web Worker). Pour 60 personnages, 1 000 affectations hongroises en O(n³) représentent quelques centaines de millions d'opérations : une à deux secondes. Sur le serveur, partagé et à un seul fil Node, elles bloqueraient les autres requêtes.

### Proportions attendues (R6)

- Modèle `RegistrationOptionExpectation` : `gameId`, `questionId`, `option` (texte de l'option, ou niveau `1` à `5` d'une échelle), `share` (nombre entre 0 et 1), `updatedAt`.
- Comme `RegistrationQuestionLink` (ADR-0050) :
  - elles vivent hors de la définition versionnée ;
  - l'éditeur les renvoie avec le texte en cours de l'option ;
  - `GET /api/games/:id/registration-option-expectations` les rend avec leur version, le plus récent `updatedAt` des lignes. `PUT` sur la même route les remplace toutes. L'éditeur envoie la version lue (`NO_VERSION` s'il n'y a aucune ligne), contrôlée par `assertRowsVersion`, car la version porte sur plusieurs lignes, et qu'une liste vidée n'a plus de date : une version lue non nulle veut alors dire qu'elle a été vidée depuis. Deux membres de l'équipe ne s'écrasent pas sans le savoir. Les liens, eux, n'ont pas ce contrôle ;
  - l'éditeur n'envoie le `PUT` que si les proportions ont changé. Sinon, enregistrer le formulaire ferait avancer la version, et l'autre membre de l'équipe recevrait un conflit sans que rien n'ait changé ;
  - une ligne vers une question ou une option disparue est ignorée à la lecture ;
  - elles sont copiées avec un jeu (`gameCopy.ts`) et supprimées avec lui.
- La route utilise `requireGameAccess`, un schéma zod (`readZodBody`), et entre dans `isolation.test.ts`.

### Règles de relecture (R11)

Des fonctions pures dans `utils/questionnaireDrafting.ts`, appliquées au formulaire enregistré par la route de l'encadré. Le repérage par mots et structures suit l'approche de QUAID (Graesser et al., 2006) : il est prévisible mais incomplet, d'où le niveau « à surveiller ».

| Règle | Repérage | Référence |
|---|---|---|
| Double sens | mot « et » ou « ou » dans le libellé d'une question à choix ou d'une échelle, ou dans une option | Bradburn, Sudman et Wansink (2004) |
| Double négation | au moins deux négations dans le libellé. Une négation, c'est un « ne » ou un « n' » (avec son « pas », « jamais », « plus », « rien » ou « aucun », qui ne compte pas en plus), un « sans » ou un « non », ou un « pas » sans « ne » dans la même phrase (registre familier) | Artino et al. (2014) |
| Format « d'accord » | « d'accord » dans le libellé ou une option | Saris, Revilla, Krosnick et Shaeffer (2010) |
| Quantifieur vague | liste fermée de mots (« souvent », « parfois », « rarement », « régulièrement », « fréquemment », « beaucoup », « peu »…) dans le libellé ou une option | Bradburn et Miles (1979) ; Schaeffer (1991). Leur intérêt est discuté pour des comparaisons entre personnes (Al Baghal, 2014) : le signalement invite à vérifier, sans interdire |
| Longueur | nombre de mots au-delà de Q3 + 1,5 × (Q3 − Q1) parmi les questions propres au jeu, quartiles par interpolation linéaire (type 7 de Hyndman et Fan, 1996). Si l'écart interquartile est nul, la règle ne s'applique pas : toute question plus longue d'un mot serait signalée | Tukey (1977) pour la règle ; Alwin et Beattie (2016) : fiabilité moindre des questions plus longues, sans seuil fixe |

Les mots sont comptés sur le texte découpé aux espaces et à l'apostrophe, sans tenir compte de la casse ni des accents. La liste des quantifieurs vagues et celle des négations sont des constantes du module.

### Consigne MCP (R12)

- Une consigne (« prompt » au sens du protocole MCP) `relire_questionnaire`, enregistrée par `server.registerPrompt` dans `server/mcp/`, avec l'argument `jeuId`.
- Elle vérifie l'accès au jeu (`requireGameAccess`, restreint par l'autorisation de l'assistant, ADR-0058).
- Elle rend un message qui contient :
  - les questions propres au jeu et leurs options ;
  - les signalements de R11 ;
  - les règles étayées avec leurs sources, dont celles qu'une règle de mots ne repère pas : question orientée, présupposé, options qui se chevauchent ou qui ne couvrent pas tous les cas, terme technique ;
  - la demande d'un avis question par question, avec le défaut, la règle et une réécriture.
- Lecture seule : rien n'est écrit et rien n'est noté au journal des écritures (`aiLog`). Aucune réponse ni donnée de participant n'y figure (SPEC-014, R8).

### Mélange des options (R13)

- Le champ `shuffleOptions` (booléen, absent = faux) appartient à une question à choix de la définition versionnée (`registrationFormDefinitionSchema`). Le changer crée une version, comme tout ce que voit la personne.
- L'ordre est tiré au hasard à chaque affichage, dans le formulaire public et dans l'essai, avec `Math.random` : il ne sert qu'à répartir l'effet d'ordre entre les options (Krosnick et Presser, 2010). Les réponses restent enregistrées par le texte de l'option.
- Le tirage se fait dans le navigateur, après le montage du composant (`onMounted`). Le rendu serveur garde l'ordre saisi : un tirage côté serveur, puis un autre à l'hydratation, donneraient deux ordres différents.

## Conséquences

- La prévision n'est aussi bonne que les hypothèses de réponse. Sans proportions, elle est optimiste, car de vraies réponses ne se répartissent jamais également. La phrase le rappelle.
- L'encadré de SPEC-015 grandit. La partie « Prévision » se replie une fois des réponses reçues, par choix de l'utilisatrice. Le repli des autres parties n'est pas décidé.
- La route de l'encadré rend aussi les personnages PJ avec leurs factions et intrigues (identifiants et noms), pour l'essai et la simulation.
- Les seuils de R13, choisis au lot 3 de SPEC-015 ([ADR-0064](ADR-0064-estimation-generale-du-questionnaire.md)), s'appliqueront aussi à la prévision, directement à la médiane (SPEC-016, R9).

## Options écartées

- **Simulation sur le serveur** : elle bloquerait le fil Node d'un serveur partagé pendant une à deux secondes à chaque ouverture.
- **Nombre de personnes simulées réglable** : écarté par l'utilisatrice, c'est toujours le nombre de personnages PJ.
- **Seuil fixe de longueur** : la littérature n'en donne pas. L'utilisatrice a choisi un repère relatif au questionnaire.
- **Indices de lisibilité (Kandel et Moles)** : ils ne valent que pour des textes d'au moins 200 mots.
- **Relecture par une IA appelée par Limbus** : Limbus n'appelle aucune IA. L'assistant de l'organisatrice relit par MCP.
- **Outil MCP plutôt que consigne** : l'utilisatrice a choisi une consigne prête à l'emploi. Les données du formulaire restent aussi lisibles par l'outil `lire_formulaire_inscription`.
- **Ordre mélangé fixe pour une personne** : il faudrait une graine par personne avant même son inscription. Un nouvel ordre à chaque affichage suffit à répartir l'effet d'ordre.
- **Proportions dans la définition versionnée** : chaque retouche créerait une version sans rien changer pour la personne, comme pour les liens (ADR-0050).

## Références

- Al Baghal, T. (2014). Is vague valid? The comparative predictive validity of vague quantifiers and numeric frequencies. *Journal of Survey Statistics and Methodology*, 2(4).
- Alwin, D. F. et Beattie, B. A. (2016). The KISS principle in survey design: question length and data quality. *Sociological Methodology*, 46(1).
- Artino, A. R. et al. (2014). Developing questionnaires for educational research: AMEE Guide No. 87. *Medical Teacher*, 36(6).
- Bradburn, N. M. et Miles, C. (1979). Vague quantifiers. *Public Opinion Quarterly*, 43(1), 92-101.
- Bradburn, N. M., Sudman, S. et Wansink, B. (2004). *Asking Questions*. Jossey-Bass.
- Dahl, F. A. et Østerås, N. (2010). Quantifying information content in survey data by entropy. *Entropy*, 12(2), 161-163.
- Graesser, A. C. et al. (2006). Question Understanding Aid (QUAID). *Public Opinion Quarterly*, 70(1).
- Jaynes, E. T. (1957). Information theory and statistical mechanics. *Physical Review*, 106(4).
- Krosnick, J. A. et Presser, S. (2010). Question and questionnaire design. *Handbook of Survey Research*, 2ᵉ éd.
- Morris, T. P., White, I. R. et Crowther, M. J. (2019). Using simulation studies to evaluate statistical methods. *Statistics in Medicine*, 38(11), 2074-2102.
- Saris, W. E., Revilla, M., Krosnick, J. A. et Shaeffer, E. M. (2010). Comparing questions with agree/disagree response options to questions with item-specific response options. *Survey Research Methods*, 4(1).
- Schaeffer, N. C. (1991). Hardly ever or constantly? Group comparisons using vague quantifiers. *Public Opinion Quarterly*, 55(3).
- Shannon, C. E. (1948). A mathematical theory of communication. *Bell System Technical Journal*, 27.
- Hyndman, R. J. et Fan, Y. (1996). Sample quantiles in statistical packages. *The American Statistician*, 50(4), 361-365.
- Tukey, J. W. (1977). *Exploratory Data Analysis*. Addison-Wesley.
