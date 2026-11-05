---
id: US-153
titre: Essayer une session imminente sur Les Cendres de Valombre
statut: à faire
epic: EPIC-044
regles: []
adr: [ADR-0066]
---

# US-153 : Essayer une session imminente sur Les Cendres de Valombre

En tant qu'utilisatrice, je veux un jeu dont la session approche, afin d'essayer tout ce qui se prépare dans les derniers jours.

## Critères d'acceptation

- [ ] Étant donné le jeu, alors une session a lieu dans environ 10 jours, publiée et presque complète, et une autre, à environ J+75, a encore un casting incomplet.
- [ ] Étant donné le casting, alors il y a des rôles attribués et libres, des PNJ, une équipe (organisation, PNJ, cuisine) et des photos.
- [ ] Étant donné les paiements, alors on trouve des tarifs par rôle et solidaires, et des personnes à jour, en retard, en plusieurs versements, avec une place offerte et avec un paiement transféré à un remplaçant.
- [ ] Étant donné la présence, alors on trouve des réponses en attente, confirmées, refusées et un délai dépassé.
- [ ] Étant donné les envois, alors des documents et des trombinoscopes ont déjà été envoyés, et certains ont changé depuis, ce qui demande un renvoi.
- [ ] Étant donné le déroulé, alors des événements ont leurs responsables, et d'autres en manquent ou sont en conflit.
- [ ] Étant donné Camille, alors « Je participe » montre sa session, son personnage, ses documents, son trombinoscope et son paiement.
- [ ] Étant donné Nicolas, alors une demande de présence lancée par l'équipe lui arrive et son lien fonctionne.
- [ ] Étant donné le jeu, alors les co-organisatrices peuvent y brancher un assistant d'IA (`aiForCoorganizers`).

## Notes techniques

Les copies d'envoi suivent ADR-0044 et comptent dans le stockage de la propriétaire. Le RIB de la session est un fichier fictif, enregistré avec sa taille. Les données doivent rester couvertes par `eraseParticipant` et `exportParticipantData`, qui peuvent être essayés sur ces fiches.

## Tests

Test d'intégration : lecture du casting, des paiements, de la présence, des envois et de l'espace de Camille ; export de sa fiche ; effacement d'une fiche sans erreur.
