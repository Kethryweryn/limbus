---
id: US-172
titre: Annoncer le casting, puis écrire au cas par cas
statut: à faire
epic: EPIC-048
regles: [R26, R27, R28]
adr: [../../adr/ADR-0070-liens-personnels-durables.md]
---

# US-172 : Annoncer le casting, puis écrire au cas par cas

En tant que organisatrice, je veux décider de chaque email, afin de ne prévenir personne par accident.

## Critères d'acceptation

- [ ] Étant donné une session triée, quand j'annonce, alors toutes les personnes retenues reçoivent un email, et les personnes en attente seulement si j'ai coché la case.
- [ ] Étant donné une annonce faite, quand j'ajoute ou retire une personne, ou la fais entrer ou sortir de la liste d'attente, alors rien ne part, et sa ligne me propose un email individuel ; changer seulement son personnage ne propose rien.
- [ ] Étant donné cette proposition, quand je l'envoie, alors l'échéance de confirmation part de cet email ; quand je l'ignore, elle disparaît.
- [ ] Étant donné un changement non envoyé, alors la personne voit ce qui lui a déjà été annoncé, sinon sa dernière réponse pour cette session.

## Notes techniques

`announceSelection` dans `server/utils/registrationSelection.ts`, `announcedRegistrationStatus`, `RegistrationSelection.vue`. Chaque email crée un lien (ADR-0070).

## Tests

Intégration : annonce, case d'attente, proposition, statut vu par la personne. Playwright : sélection et espace participant.
