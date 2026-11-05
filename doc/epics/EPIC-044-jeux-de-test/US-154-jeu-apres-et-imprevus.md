---
id: US-154
titre: Essayer l'après-session et les imprévus sur Le Bal des Masques Brisés
statut: terminée
epic: EPIC-044
regles: []
adr: [ADR-0066]
---

# US-154 : Essayer l'après-session et les imprévus sur Le Bal des Masques Brisés

En tant qu'utilisatrice, je veux un jeu qui a déjà vécu, afin d'essayer ce qui arrive après une session ou quand elle ne se passe pas comme prévu.

## Critères d'acceptation

- [x] Étant donné le jeu, alors une session terminée récente (environ J-60) a ses statistiques, ses photos et son historique d'envois, sans copies, qui s'effacent le lendemain de la session (ADR-0044).
- [x] Étant donné une session annulée, alors des paiements y sont à rembourser ou déjà remboursés.
- [x] Étant donné une session reportée, alors elle renvoie à sa nouvelle session, et des paiements y sont reportés.
- [x] Étant donné les photos, alors une personne a refusé la sienne, et la durée de conservation du jeu s'affiche.
- [x] Étant donné le legs, alors une copie est en attente pour Manon, sans compte. Son invitation peut être renvoyée depuis l'application, et un rechargement supprime cette copie.
- [x] Étant donné Lucie, alors elle retrouve la session terminée dans « Je participe », et lit la version actuelle de ce qui lui a été envoyé, tant que ce document reste prêt à envoyer.
- [x] Étant donné les données d'origine, alors le texte, les personnages, les intrigues et l'intrigue sans rattachement restent là.

## Notes techniques

La session terminée doit rester dans les durées de conservation (ADR-0066). Les autres dates sont relatives au rechargement (annulée à J+20, reportée de J+30 à J+90).

## Tests

`tests/integration/seed.test.ts` : sessions et remboursements, refus de photo, vue de Lucie, contenu d'origine, legs listé et renvoyé sur le faux serveur d'emails, copie remplacée au rechargement.
