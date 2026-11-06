---
id: US-172
titre: Annoncer le casting, puis écrire au cas par cas
statut: terminée
epic: EPIC-048
regles: [R26, R27, R28]
adr: [../../adr/ADR-0070-liens-personnels-durables.md]
---

# US-172 : Annoncer le casting, puis écrire au cas par cas

En tant que organisatrice, je veux décider de chaque email, afin de ne prévenir personne par accident.

## Critères d'acceptation

- [x] Étant donné une session triée, quand j'annonce, alors toutes les personnes retenues reçoivent un email, et les personnes en attente seulement si j'ai coché la case.
- [x] Étant donné une annonce faite, quand j'ajoute ou retire une personne, ou la fais entrer ou sortir de la liste d'attente, alors rien ne part, et sa ligne me propose un email individuel ; changer seulement son personnage ne propose rien.
- [x] Étant donné une personne jamais prévenue, sortie du cast par sa propre réponse, alors aucune proposition n'apparaît.
- [x] Étant donné cette proposition, quand je l'envoie, alors l'échéance de confirmation part de cet email ; quand je l'ignore, elle disparaît.
- [x] Étant donné un changement non envoyé, alors la personne voit ce qui lui a déjà été annoncé, sinon sa dernière réponse pour cette session.

## Notes techniques

`announceCast`, `sendLineAnnouncement` et `ignoreLineAnnouncement` dans `server/utils/registrationSelection.ts`, `pendingAnnouncement` et `visibleLineStatus` dans `utils/registrations.ts`, `RegistrationSelection.vue`. `RegistrationPeriodSession.castAnnouncedAt` : la date de l'annonce. `RegistrationSession.ignoredStatus` : le statut dont l'email est écarté, y compris la liste d'attente quand sa case reste décochée. Chaque email crée un lien (ADR-0070). Une personne qui a confirmé sa place apprend son annulation aussitôt.

## Tests

Unitaire : `tests/utils/registrations.test.ts`. Intégration : `tests/integration/registrationSelection.test.ts`, `isolation.test.ts`. Playwright : `tests/e2e/registration.spec.ts`.
