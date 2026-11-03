---
id: US-132
titre: L'assistant aide à la sélection et tire au sort
statut: terminée
epic: EPIC-036
regles: [R4, R5, R8, R10, R11, R12, R13, R15]
adr: [ADR-0058, ADR-0047, ADR-0048]
---

# US-132 : L'assistant aide à la sélection et tire au sort

En tant qu'organisatrice, je veux que mon assistant prépare les décisions d'une période, afin de n'avoir plus qu'à les relire et les annoncer.

## Critères d'acceptation

- [x] L'assistant retient une inscription pour une session, la met en liste d'attente, l'en retire, l'écarte ou la remet à trier, en donnant la version lue de l'inscription. Rien n'est annoncé ni envoyé.
- [x] Une inscription dont une décision a déjà été annoncée est refusée : elle se change dans l'interface. Les règles de l'interface s'appliquent (disponibilités, places, rejoueurs…).
- [x] Il fixe l'ordre de la liste d'attente d'une session, et les places d'une session recrutée par l'inscription permanente, en donnant la version lue de la période.
- [x] Il lance un tirage au sort sur une période en mode tirage ou mixte, et annule un tirage tant que rien n'en est annoncé, en donnant la version lue de la période. Un tirage qui déciderait pour une inscription déjà annoncée est refusé.
- [x] Une autorisation en lecture seule n'a pas ces outils, et le serveur refuse quand même l'écriture.
- [x] Chaque écriture est notée au journal.

## Tests

- Intégration : décisions (retenue, attente, écartée, à trier), inscription annoncée refusée, version dépassée, ordre de liste d'attente, places du vivier, tirage et annulation, période hors autorisation, lecture seule, journal.
