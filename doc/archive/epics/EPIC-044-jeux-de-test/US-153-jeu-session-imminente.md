---
id: US-153
titre: Essayer une session imminente sur Les Cendres de Valombre
statut: terminée
epic: EPIC-044
regles: []
adr: [ADR-0066]
---

# US-153 : Essayer une session imminente sur Les Cendres de Valombre

En tant qu'utilisatrice, je veux un jeu dont la session approche, afin d'essayer tout ce qui se prépare dans les derniers jours.

## Critères d'acceptation

- [x] Étant donné le jeu, alors une session a lieu dans environ 10 jours, publiée et presque complète, en remplacement d'une session reportée, seule situation où l'application demande une présence (US-024), et une autre, à environ J+75, a encore un casting incomplet.
- [x] Étant donné le casting, alors il y a des rôles attribués et libres, des PNJ, une équipe (organisation, PNJ, cuisine) et des photos.
- [x] Étant donné les paiements, alors on trouve des tarifs par rôle et solidaires, et des personnes à jour, en retard, en plusieurs versements, avec une place offerte et avec un paiement transféré à un remplaçant.
- [x] Étant donné la présence, alors on trouve des réponses en attente, confirmées, refusées et un délai dépassé.
- [x] Étant donné les envois, alors des documents et des trombinoscopes ont déjà été envoyés, et certains ont changé depuis, ce qui demande un renvoi.
- [x] Étant donné les fiches, alors des notes d'organisation propres au jeu existent, et Alex Morgan et Morgan Da Silva sont présents sur plusieurs jeux, pour essayer les filtres et le fait que ces notes restent propres à chaque jeu.
- [x] Étant donné le déroulé, alors des événements ont leurs responsables, et d'autres en manquent ou sont en conflit.
- [x] Étant donné Camille, alors « Je participe » montre sa session, son personnage, ses documents, son trombinoscope et son paiement.
- [x] Étant donné Nicolas, alors une demande de présence lancée par l'équipe lui arrive et son lien fonctionne.
- [x] Étant donné le jeu, alors les co-organisatrices peuvent y brancher un assistant d'IA (`aiForCoorganizers`).

## Notes techniques

Les copies d'envoi suivent ADR-0044 et comptent dans le stockage de la propriétaire. Le RIB de la session est un fichier fictif, enregistré avec sa taille. Les données doivent rester couvertes par `eraseParticipant` et `exportParticipantData`, qui peuvent être essayés sur ces fiches.

## Tests

`tests/integration/seed.test.ts` : casting, paiements et RIB, présence, envois à jour et dépassés, déroulé, espace de Camille et ses documents, export et effacement d'une fiche, droits d'Inès, demande de présence à Nicolas et à Inès, lien compris, sur le faux serveur d'emails.
