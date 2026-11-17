---
id: US-251
titre: Un nom de personne ne contient que des lettres et des séparateurs
statut: terminée
epic: EPIC-060
regles: [R1, R2, R3, R11, R12]
adr: [ADR-0092]
---

# US-251 : Un nom de personne ne contient que des lettres et des séparateurs

En tant que personne qui saisit un nom, le sien ou celui d'un participant, je veux qu'un nom avec des chiffres ou des symboles soit refusé, afin que les fiches, les emails et les trombinoscopes portent de vrais noms.

## Critères d'acceptation

- [x] Étant donné « Jean-Pierre O'Neill », « Zoë Ŝ. Müller » ou « Мария », quand je l'enregistre, alors il est accepté.
- [x] Étant donné « Jean2 », « @lice » ou « - », quand je l'enregistre, alors il est refusé, avec le message de R1 sous le champ.
- [x] Étant donné « Jean   Martin », quand je l'enregistre, alors il est rangé sous la forme « Jean Martin ».
- [x] La règle vaut pour chaque champ de R2 :
  - inscription, activation, Mon compte, administration, invitation dans une équipe ;
  - fiche participant, invitation au questionnaire ;
  - prénom et nom du questionnaire ;
  - nom du contact d'urgence.

  Elle vaut aussi pour les outils des assistants d'IA qui écrivent ces champs.
- [x] Les noms de R3 ne sont pas concernés : personnage, trombinoscope, nom Facebook, expéditeur, nom tiré de l'adresse email.
- [x] Un nom déjà en base qui ne suit pas R1 s'affiche. Il est refusé à la prochaine modification de la fiche (R12).

## Notes techniques

- La règle est écrite une seule fois, sous le nom `personName`, dans `server/utils/fieldRules.ts`.
- Elle sert à `schemas.ts`, à `registrationForms.ts` et aux outils de `server/mcp/`.
- Formulaires : `apiFieldErrors` transmet le message à l'`error` de chaque `UFormField` concerné (R11).

## Tests

De bout en bout (Playwright) :

- **Actions :** un nom accentué et un nom avec apostrophe s'enregistrent dans Mon compte, sur la fiche participant et dans le questionnaire.
- **Erreurs de saisie :** « Jean2 » est refusé, avec le message sous le champ, sur chacun de ces trois écrans.
- **Droits :** sans objet, car la règle ne change aucun droit.
- **Hors ligne :** une fiche participant modifiée hors ligne avec un nom invalide est refusée au retour du réseau, avec le message.

Tests unitaires : `personName`, avec les alphabets, les séparateurs et les refus.

Tests d'intégration : chaque route de R2, et les outils des assistants.

### Tests écrits

- `tests/e2e/personNames.spec.ts` :
  - Mon compte : nom et nom du contact d'urgence ;
  - création d'une fiche participant ;
  - questionnaire public ;
  - refus d'une modification faite hors ligne.
- `tests/integration/personNames.test.ts` :
  - fiche participant (création et modification) ;
  - Mon compte et Mes coordonnées ;
  - administration ;
  - invitation au vivier.
- Tests ajoutés à des fichiers d'intégration existants :
  - inscription libre (`accounts.test.ts`) ;
  - questionnaire public (`formRegistrations.test.ts`) ;
  - outil `creer_participant` (`aiAssistants.test.ts`).
- Tests unitaires :
  - `tests/server/fieldRules.test.ts` ;
  - `tests/server/registrationForms.test.ts` ;
  - `splitApiErrors` (`tests/utils/apiErrors.test.ts`) ;
  - message d'un refus hors ligne (`tests/utils/offlineSync.test.ts`).
- L'activation et l'invitation dans une équipe passent par le même schéma (`personName`) et affichent le message sous le champ. Leur parcours de bout en bout n'a pas été rejoué avec un nom refusé, car il demande un mot de passe choisi.

### Revue de la PR #254

- Un nom déjà enregistré n'est vérifié que s'il change, comme le dit R12 : il ne bloque plus la modification d'un autre champ de la fiche. Le contrôle passe par `assertChangedPersonName` : fiche participant, Mon compte, contact d'urgence, administration. Un nom tenu par le compte ne bloque plus la fiche.
- Un refus qui porte sur tout le formulaire reste affiché, même quand un champ est aussi refusé.
- Le refus du rôle s'affiche sous son champ dans l'administration.
- L'activation ne propose plus de nouveau lien pour une saisie à corriger.

### Changé en passant

- Une modification faite hors ligne et refusée au retour du réseau garde le détail du refus, au lieu de « Requête invalide » (`utils/offlineSync.ts`).
- Les tests génèrent des noms de personnes en lettres seulement (`uniquePersonName`).
