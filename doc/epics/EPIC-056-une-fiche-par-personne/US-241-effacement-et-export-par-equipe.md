---
id: US-241
titre: Effacer et exporter ce qui concerne son équipe
statut: à faire
epic: EPIC-056
regles: [R14, R15]
adr: [ADR-0086]
---

# US-241 : Effacer et exporter ce qui concerne son équipe

En tant qu'organisatrice, je veux que l'effacement et l'export d'une personne ne portent que sur mes jeux, afin de ne jamais toucher ni montrer ce qu'une autre équipe tient.

## Critères d'acceptation

- [ ] Étant donné la fiche de Paul suivie par Alice et Bob, quand Alice efface Paul, alors ses jeux, notes, valeurs, casts, inscriptions, envois, paiements et photos de ses jeux disparaissent ; la fiche reste pour Bob, intacte.
- [ ] Étant donné la dernière équipe qui efface la fiche, alors la fiche disparaît entièrement, comme aujourd'hui.
- [ ] Étant donné l'export d'Alice, alors il ne contient que ce qui concerne ses jeux.
- [ ] L'export et l'effacement depuis le compte de Paul restent inchangés (ADR-0043).

## Notes techniques

`eraseParticipant` et `exportParticipantData` (`server/utils/participantPrivacy.ts`) limités aux jeux de l'équipe ; `collectUploadUrls` puis `deleteUnusedUploads` pour les photos de ses jeux.

## Tests

- Actions : effacement et export depuis la fiche, par Alice puis par Bob.
- Erreurs de saisie : aucune saisie (confirmation seule).
- Droits : Alice n'efface ni n'exporte rien de Bob ; co-organisatrice ; `isolation.test.ts`.
- Hors ligne : effacement et export sont des actions, jamais mises en file : refus sans réseau avec le message habituel.
