---
id: US-128
titre: L'assistant prépare le casting et le déroulé d'une session
statut: terminée
epic: EPIC-035
regles: [R4, R5, R8, R10, R11, R12, R13, R15]
adr: [ADR-0058, ADR-0051, ADR-0028]
---

# US-128 : L'assistant prépare le casting et le déroulé d'une session

En tant qu'organisatrice, je veux que mon assistant propose et enregistre le casting d'une session, et répartisse son déroulé, afin de préparer la session avec lui.

## Critères d'acceptation

- [x] L'assistant lance l'assistant de casting d'une session sur son cast actuel, et lit ses notes, ses interdits, ses alertes et sa proposition ([ADR-0051](../../adr/ADR-0051-assistant-de-casting.md)). Rien n'est écrit. Les inscriptions n'y apparaissent que par leur identifiant et le nom de la fiche, sans réponse libre.
- [x] Il enregistre des lignes du cast : pour un personnage du jeu, la personne (ou aucune), la note de la ligne, le cadenas. Les lignes non données restent telles quelles.
- [x] Quand la personne d'une ligne change, la photo de la ligne est retirée. Il ne pose jamais de photo, et ne change pas les réservations d'un personnage pour une personne retenue.
- [x] Une personne mise au cast entre dans l'équipe comme participant, comme dans l'interface. Les règles du cast s'appliquent (un seul PJ par participant…).
- [x] Il donne les responsables d'événements de la chronologie pour la session : des orgas ou PNJ de l'équipe. Les événements non donnés gardent leurs responsables.
- [x] Un personnage, un événement ou une personne d'un autre jeu est refusé. Une version dépassée est refusée.
- [x] Une autorisation en lecture seule n'a pas ces outils, assistant de casting compris (R10), et le serveur refuse quand même l'écriture.
- [x] Chaque écriture est notée au journal.

## Tests

- Intégration : proposition de l'assistant de casting, lignes données seules modifiées, photo retirée au changement de personne, cadenas, réservation gardée, responsables du déroulé, références d'un autre jeu, version dépassée, lecture seule, journal.
