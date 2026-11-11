---
id: US-241
titre: Effacer et exporter ce qui concerne son équipe
statut: terminée
epic: EPIC-056
regles: [R14, R15]
adr: [ADR-0086]
---

# US-241 : Effacer et exporter ce qui concerne son équipe

En tant qu'organisatrice, je veux que l'effacement et l'export d'une personne ne portent que sur mes jeux, afin de ne jamais toucher ni montrer ce qu'une autre équipe tient.

## Critères d'acceptation

- [x] Étant donné la fiche de Paul suivie par Alice et Bob, quand Alice efface Paul, alors ses jeux, notes, valeurs, casts, inscriptions, envois, paiements et photos de ses jeux disparaissent ; la fiche reste pour Bob, intacte.
- [x] Étant donné la dernière équipe qui efface la fiche, alors la fiche disparaît entièrement, comme aujourd'hui.
- [x] Étant donné l'export d'Alice, alors il ne contient que ce qui concerne ses jeux.
- [x] L'export et l'effacement depuis le compte de Paul restent inchangés (ADR-0043).

## Notes techniques

`eraseParticipant` et `exportParticipantData` (`server/utils/participantPrivacy.ts`) limités aux jeux de l'équipe ; `collectUploadUrls` puis `deleteUnusedUploads` pour les photos de ses jeux.

## Tests

- Actions : `tests/e2e/participantScreens.spec.ts` (« suppression ») : une fiche suivie par une autre équipe ne perd que mes jeux, une fiche à moi seule disparaît ; `tests/integration/privacy.test.ts` (« effacement et export par équipe ») : chaque table de mes jeux vidée, celles de Bob intactes, puis l'effacement de Bob fait disparaître la fiche ; export limité à mes jeux, avec mon nom et les personnes de mes affinités nommées comme dans mon jeu.
- Erreurs de saisie : aucune saisie (confirmation seule).
- Droits : Alice n'efface ni n'exporte rien de Bob ; après son effacement, elle n'a plus accès à la fiche.
- Hors ligne : la suppression d'une fiche se met en file et se rejoue au retour du réseau, comme avant (ADR-0036) ; l'export demande le réseau. Rien de nouveau à tester.

## Avancement

- `eraseParticipantForTeam` (`server/utils/participantPrivacy.ts`) : dans les seuls jeux de l'équipe, liens, inscriptions, rôles, présences, paiements, envois, trombinoscopes, déroulé, affinités qui la désignent et photos du cast ; sans autre équipe, l'effacement complet (`eraseParticipant`). La route de suppression ne refuse plus une fiche liée au jeu d'une autre équipe (US-211).
- Export : nom, téléphone et dates de l'équipe (revue de la PR #232), et personnes de ses affinités nommées comme dans son jeu.
