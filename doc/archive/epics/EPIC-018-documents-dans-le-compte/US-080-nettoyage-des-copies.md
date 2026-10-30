---
id: US-080
titre: Effacer les copies après la session
statut: terminée
epic: EPIC-018
regles: [R7, R14]
adr: [ADR-0044]
---

# US-080 : Effacer les copies après la session

En tant que propriétaire d'un jeu, je veux que les copies des envois ne s'accumulent pas, afin que mon espace de stockage serve d'abord aux photos.

## Critères d'acceptation

- [x] Les copies d'une session s'effacent le lendemain de sa date ; une session sans date garde les siennes.
- [x] Une session reportée garde ses copies jusqu'au lendemain de la session qui la remplace.
- [x] Une session annulée garde ses copies un mois après son annulation.
- [x] Une copie dont le délai est passé n'est plus servie, même avant d'être effacée.
- [x] Sans copie, la personne lit la version actuelle tant qu'elle reste validée (document prêt à envoyer, fiche prête, trombinoscope généré pour elle) ; sinon l'envoi reste listé, sans contenu.

## Notes techniques

- `Session.cancelledAt`, posé au passage à « Annulée » ; migration : date de modification des sessions déjà annulées.
- Nettoyage à chaque connexion et avant chaque envoi (pas de tâche planifiée).

## Tests

- Unitaires : date d'effacement selon la date, le report et l'annulation.
- Intégration : copie expirée effacée, puis lecture de la version actuelle.
