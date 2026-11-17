---
id: US-251
titre: Un nom de personne ne contient que des lettres et des séparateurs
statut: à faire
epic: EPIC-060
regles: [R1, R2, R3, R11, R12]
adr: [ADR-0092]
---

# US-251 : Un nom de personne ne contient que des lettres et des séparateurs

En tant que personne qui saisit un nom, le sien ou celui d'un participant, je veux qu'un nom avec des chiffres ou des symboles soit refusé, afin que les fiches, les emails et les trombinoscopes portent de vrais noms.

## Critères d'acceptation

- [ ] Étant donné « Jean-Pierre O'Neill », « Zoë Ŝ. Müller » ou « Мария », quand je l'enregistre, alors il est accepté.
- [ ] Étant donné « Jean2 », « @lice » ou « - », quand je l'enregistre, alors il est refusé, avec le message de R1 sous le champ.
- [ ] Étant donné « Jean   Martin », quand je l'enregistre, alors il est rangé sous la forme « Jean Martin ».
- [ ] La règle vaut pour chaque champ de R2 :
  - inscription, activation, Mon compte, administration, invitation dans une équipe ;
  - fiche participant, invitation au questionnaire ;
  - prénom et nom du questionnaire ;
  - nom du contact d'urgence.

  Elle vaut aussi pour les outils des assistants d'IA qui écrivent ces champs.
- [ ] Les noms de R3 ne sont pas concernés : personnage, trombinoscope, nom Facebook, expéditeur, nom tiré de l'adresse email.
- [ ] Un nom déjà en base qui ne suit pas R1 s'affiche. Il est refusé à la prochaine modification de la fiche (R12).

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
