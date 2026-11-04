---
id: US-141
titre: Indiquer les proportions attendues des options
statut: terminée
epic: EPIC-041
regles: [R6]
adr: [ADR-0062, ADR-0050]
---

# US-141 : Indiquer les proportions attendues des options

En tant qu'organisatrice, je veux indiquer la part de joueurs que j'attends pour chaque option d'une question reliée, afin que la prévision repose sur ce que je sais de mon public plutôt que sur une répartition égale.

## Critères d'acceptation

- [x] Sous chaque question reliée, un volet replié « Proportions attendues (facultatif) » donne un champ en % par option, ou par niveau d'une échelle.
- [x] La phrase du volet dit comment les parts se lisent : tout vide, chaque option a la même chance (une fois sur deux pour une question à choix multiples) ; une option vide compte pour 0 ; pour une question à choix unique ou une échelle, les parts sont ramenées à 100 % au total.
- [x] Une question à choix unique ou une échelle dont toutes les parts sont nulles, ou une part hors de 0 à 100, est refusée avant tout enregistrement.
- [x] Les proportions s'enregistrent avec le formulaire, sans créer de version. Une part suit son option quand celle-ci est renommée ou déplacée.
- [x] Deux membres de l'équipe ne s'écrasent pas sans le savoir : une modification depuis la version lue répond 409. Sans changement des proportions, rien n'est écrit, donc enregistrer le formulaire ne gêne personne.
- [x] Une ligne vers une question ou une option disparue est ignorée à la lecture.
- [x] Les proportions sont copiées avec le jeu et supprimées avec lui.

## Notes techniques

- Modèle `RegistrationOptionExpectation` (`gameId`, `questionId`, `option`, `share`, `updatedAt`), unique par jeu, question et option. Migration : création de table seule.
- `GET` et `PUT /api/games/:id/registration-option-expectations` (`requireGameAccess`, `readZodBody`) ; `server/utils/registrationOptionExpectations.ts` ; version : `assertRowsVersion`, avec le plus récent `updatedAt` des lignes.
- `server/utils/gameCopy.ts` (`GAME_COPY_FIELDS` et copie).
- `components/RegistrationFormEditor.vue` : parts par texte d'option, en texte saisi, à côté de `optionLinks`.

## Tests

- Unitaires : `gameCopy` classe tous les champs du nouveau modèle.
- Intégration : aller-retour, 400 (option inconnue, parts toutes nulles), 409 sur une version périmée, y compris après une liste vidée, ligne d'une option disparue ignorée, copie du jeu ; `isolation.test.ts` avec témoin positif.
- Bout en bout : saisir des proportions, enregistrer sans les changer sans les réécrire, renommer une option, rouvrir et les retrouver.
