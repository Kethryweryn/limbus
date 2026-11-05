---
id: US-154
titre: Essayer l'après-session et les imprévus sur Le Bal des Masques Brisés
statut: à faire
epic: EPIC-044
regles: []
adr: [ADR-0066]
---

# US-154 : Essayer l'après-session et les imprévus sur Le Bal des Masques Brisés

En tant qu'utilisatrice, je veux un jeu qui a déjà vécu, afin d'essayer ce qui arrive après une session ou quand elle ne se passe pas comme prévu.

## Critères d'acceptation

- [ ] Étant donné le jeu, alors une session terminée récente (environ J-60) a ses statistiques, ses photos et son historique d'envois.
- [ ] Étant donné une session annulée, alors des paiements y sont à rembourser ou déjà remboursés.
- [ ] Étant donné une session reportée, alors elle renvoie à sa nouvelle session, et des paiements y sont reportés.
- [ ] Étant donné les photos, alors une personne a refusé la sienne, et la durée de conservation du jeu s'affiche.
- [ ] Étant donné le legs, alors une copie est en attente pour Manon, sans compte. Son invitation peut être renvoyée depuis l'application, et un rechargement supprime cette copie.
- [ ] Étant donné Lucie, alors elle retrouve la session terminée dans « Je participe », avec ce qui lui a été envoyé.
- [ ] Étant donné les données d'origine, alors le texte, les personnages, les intrigues et l'intrigue sans rattachement restent là.

## Notes techniques

La session terminée doit rester dans les durées de conservation (ADR-0066). Les autres dates sont relatives au rechargement (annulée à J+20, reportée de J+30 à J+90).

## Tests

Test d'intégration : lecture des trois sessions et de leurs paiements, legs en attente listé, disparition de la copie au rechargement suivant.
