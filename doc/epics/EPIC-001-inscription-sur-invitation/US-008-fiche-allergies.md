---
id: US-008
titre: Fiche allergies de la session
statut: à faire
epic: EPIC-001
regles: [R14, R15]
adr: []
---

# US-008 : Fiche allergies de la session

En tant qu'organisatrice, je veux une fiche des allergies et intolérances des participants confirmés de la session, afin que l'équipe cuisine prépare les repas en conséquence.

## Critères d'acceptation

- [ ] Sur la session, une fiche liste, pour chaque inscription confirmée qui a déclaré des allergies ou intolérances, le nom de la personne et ce qu'elle a déclaré. Elle indique aussi le nombre de personnes confirmées.
- [ ] Elle est téléchargeable en PDF.
- [ ] Elle peut être envoyée par email aux membres de l'équipe cuisine de la session (rôle cuisine), avec le verrou d'envoi de session.
- [ ] Une personne désistée disparaît de la fiche ; la fiche est générée à la demande, jamais stockée.
- [ ] La fiche ne contient ni contact d'urgence ni téléphone.

## Notes techniques

- Génération PDF avec `pdf-lib`, comme les autres documents de session ; pas de stockage, pour ne pas multiplier les copies de données de santé.
- Route : `GET /api/sessions/:id/allergies` (HTML ou PDF) et `POST /api/sessions/:id/allergies/send`, avec `requireSessionAccess`.

## Tests

- Unitaires : contenu de la fiche (personnes confirmées seulement, sans contact).
- Intégration : envoi à l'équipe cuisine seulement ; ajout des deux routes à `isolation.test.ts`.
