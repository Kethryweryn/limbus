---
id: ADR-0051
titre: Assistant de casting calculé à la demande, cadenas et réservation sur l'attribution
statut: accepté
date: 2026-11-01
liens: [../specs/SPEC-001-inscriptions.md, ADR-0049-rattachement-des-affinites.md, ADR-0050-relations-et-questionnaire-relie.md, ADR-0047-selection-des-inscriptions.md]
---

# ADR-0051 : Assistant de casting calculé à la demande, cadenas et réservation sur l'attribution

## Contexte

[SPEC-001](../specs/SPEC-001-inscriptions.md), lot 6 (R27 à R29). Choix de l'utilisatrice :

- l'assistant vit dans l'onglet Cast d'une session ;
- il répartit les joueurs du cast et les personnes retenues non confirmées ;
- un cadenas par ligne fixe une attribution ;
- appliquer remplit le formulaire sans enregistrer ;
- un personnage donné à une personne retenue lui est réservé jusqu'à sa confirmation.

La note ne vient que du questionnaire, car « veut jouer avec » ne concerne que la session. « Ne veut pas jouer avec » interdit deux personnages en relation directe. « Ne veut pas croiser » reste une alerte.

## Décision

- **Cadenas** : `SessionAssignment.locked`, enregistré avec le cast.
- **Réservation** : `SessionAssignment.reservedRegistrationId`, FK vers `Registration` en `SET NULL`.
  - Le `participantId` de la ligne reste vide. Paiements, envois, trombinoscopes et allergies, qui lisent `participantId`, ignorent donc la réservation sans changement.
  - Une réservation n'est valable que si l'inscription est retenue (`retained`) pour cette session. Sinon elle est ignorée à la lecture et effacée au prochain enregistrement.
  - Le PUT de la session refuse une réservation pour une inscription d'un autre jeu. Il laisse tomber celle d'une inscription passée à une autre session, et convertit en attribution celle d'une inscription déjà confirmée.
  - La confirmation (`confirmRetainedPlace`) donne le personnage réservé. Le désistement et la libération de la place effacent la réservation.
  - Le réglage « un seul PJ par participant » compte la personne de la réservation.
- **Lignes qui n'envoient rien** : une ligne de cast qui n'envoie ni `locked` ni `reservedRegistrationId` garde leurs valeurs enregistrées. L'enregistrement des détails de la session et la file hors ligne ne les perdent donc pas. Le report d'une session copie le cadenas, pas la réservation : l'inscription reste attachée à l'ancienne session.
- **Calcul** : `POST /api/sessions/:id/casting-assistant` reçoit le cast en cours d'édition (lignes, cadenas, réservations). Un personnage ou un participant d'un autre jeu est refusé. Il renvoie les notes, les interdits, les alertes et une proposition, sans rien écrire. Le calcul pur est dans `utils/castingAssistant.ts`.
  - **Joueurs** : les `SessionParticipant` de rôle participant, plus les inscriptions retenues de la session. Les réponses d'un joueur sont celles de son inscription pour cette session (retenue ou confirmée). À défaut, ce sont celles de sa dernière inscription au jeu.
  - **Note** : pour chaque lien du questionnaire en vigueur (ADR-0050), la réponse du joueur vaut 1 si l'option est choisie, ou (n − 1) / 4 pour une échelle. Elle est multipliée par 1 si le lien vise le personnage, par ½ s'il vise une faction ou une intrigue du personnage. Les liens sont lus au moment du calcul.
  - **Interdits** :
    - un type de relation refusé (lignes `refusedRelationTypes`, sauf `none`) que le personnage porte, d'un côté ou de l'autre ;
    - pour une paire « ne veut pas jouer avec » rattachée (dans un sens ou dans l'autre), deux personnages en relation directe.
    - Le second interdit dépend des autres attributions : il s'applique aux notes face aux lignes verrouillées, et à la proposition entière.
  - **Proposition** : affectation de meilleure note totale par la méthode hongroise. Les paires interdites sont exclues, les lignes verrouillées et leurs joueurs sont retirés. Les conflits « ne veut pas jouer avec » qui restent sont ensuite défaits un à un : on déplace l'un des deux vers un personnage libre, ou on l'échange avec un autre joueur, au moindre coût. Sinon il reste sans personnage. Joueurs et personnages entrent triés par nom : à données égales, le résultat est le même.

## Conséquences

- Avec 0 point partout, la proposition répartit quand même tout le monde, dans l'ordre des noms.
- Le calcul se fait à chaque demande, sans cache : une session compte quelques dizaines de joueurs, et la méthode hongroise est en O(n³).
- Les relations refusées en texte libre ne sont qu'affichées.

## Options écartées

- **Enregistrer la proposition** : une proposition est jetable, et l'organisatrice l'ajuste dans le formulaire avant d'enregistrer.
- **Faire entrer la personne retenue dans le cast** : elle aurait été comptée dans les paiements avant de confirmer (R22).
- **Glouton seul** : plus simple, mais il donne souvent une moins bonne répartition qu'une affectation optimale de même coût de calcul.
