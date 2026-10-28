---
id: US-008
titre: Fiche allergies de la session
statut: terminée
epic: EPIC-001
regles: [R14, R15]
adr: []
---

# US-008 : Fiche allergies de la session

En tant qu'organisatrice, je veux une fiche des allergies et intolérances des participants confirmés de la session, afin que l'équipe cuisine prépare les repas en conséquence.

## Critères d'acceptation

- [x] Sur la session, une fiche liste, pour chaque inscription confirmée qui a déclaré des allergies ou intolérances, le nom de la personne et ce qu'elle a déclaré. Elle indique aussi le nombre de personnes confirmées.
- [x] Elle est téléchargeable en PDF.
- [x] Elle peut être envoyée par email aux membres de l'équipe cuisine de la session (rôle cuisine), avec le verrou d'envoi de session.
- [x] Une personne désistée disparaît de la fiche ; la fiche est générée à la demande, jamais stockée.
- [x] La fiche ne contient ni contact d'urgence ni téléphone.

## Réalisation

- La fiche est dans l'onglet Documents de la session : liste à l'écran, bouton « PDF » et bouton « Envoyer à l'équipe cuisine ».
- Routes : `GET /api/sessions/:id/allergies` (données de la fiche), `GET /api/sessions/:id/allergies/pdf`, `POST /api/sessions/:id/allergies/send`. Toutes en `no-store`.
- Choix du 2026-10-28 : la fiche donne le nombre de personnes qui mangent, c'est-à-dire les inscrits confirmés et toutes les personnes du cast de la session (participants, PNJ, orgas, cuisine, joueurs d'un personnage), chacune comptée une fois, et à part le nombre d'inscrits confirmés. Les allergies listées restent celles déclarées dans les inscriptions confirmées. Le nom affiché est celui de la fiche participant.
- L'envoi part à chaque membre de rôle « Cuisine » qui a un email, un email par personne, PDF en pièce jointe, avec le verrou d'envoi de session. L'email rappelle que ce sont des données de santé, à ne pas diffuser et à supprimer après le jeu. Sans équipe cuisine, ou sans email, l'envoi est refusé avec une explication.
- Correctifs de la revue du 2026-10-28 : une confirmée retirée à la main de la session (ADR-0021) n'est plus sur la fiche ni dans le compte des personnes à table ; un envoi parti à personne est une erreur ; les adresses de la cuisine sont dédoublonnées sans tenir compte de la casse. Hors ligne ou serveur injoignable, l'envoi n'est jamais mis en file pour plus tard.

## Notes techniques

- Génération PDF avec `pdf-lib`, comme les autres documents de session ; pas de stockage, pour ne pas multiplier les copies de données de santé.
- Route : `GET /api/sessions/:id/allergies` (HTML ou PDF) et `POST /api/sessions/:id/allergies/send`, avec `requireSessionAccess`.

## Tests

- Unitaires : contenu de la fiche (personnes confirmées seulement, sans contact).
- Intégration : envoi à l'équipe cuisine seulement ; ajout des deux routes à `isolation.test.ts`.
