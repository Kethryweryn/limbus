---
id: US-253
titre: Une longueur maximale sur chaque texte, des emails vérifiés partout
statut: terminée
epic: EPIC-060
regles: [R9, R10, R11]
adr: [ADR-0092]
---

# US-253 : Une longueur maximale sur chaque texte, des emails vérifiés partout

En tant qu'organisatrice, je veux :

- que chaque texte ait un plafond adapté à son usage, assez large pour un long historique ;
- que chaque adresse email soit vérifiée de la même façon ;

afin qu'aucune saisie démesurée ou mal formée n'entre dans Limbus.

## Critères d'acceptation

- [x] Chaque champ texte saisi, dans les routes comme dans les outils des assistants d'IA, a le plafond de son type selon le barème de R9. Les plafonds déjà en place ne changent pas.
- [x] Étant donné un historique de personnage de 900 000 caractères, quand je l'enregistre, alors il est accepté.
- [x] Étant donné un nom de personnage de 201 caractères, quand je l'enregistre, alors « Le nom : 200 caractères au plus » s'affiche sous le champ.
- [x] Chaque adresse email saisie est mise en minuscules, fait 254 caractères au plus et a la forme d'une adresse (R10).
- [x] Sur chaque formulaire, les refus s'affichent sous le champ concerné (R11).

## Notes techniques

- Les plafonds sont écrits une seule fois : `text(type)` et `TEXT_MAX`, dans `server/utils/fieldRules.ts`.
- Il faut relever chaque champ de `schemas.ts` et de `server/mcp/`.
- Les vérifications faites sur l'écran reprennent le texte du serveur : « Le nom est obligatoire », et non « Le nom est requis. » (formulaires de l'écriture du jeu et des sessions, revue de la PR #254).
- Limbus n'a pas de limite générale de taille d'une requête : vérifier qu'un texte de fond de 1 000 000 de caractères (jusqu'à 4 Mo en UTF-8) passe aussi Apache en production.

## Tests

De bout en bout (Playwright) :

- **Actions :** un long historique de personnage s'enregistre et se relit.
- **Erreurs de saisie :**
  - un nom de personnage trop long est refusé, avec le message sous le champ ;
  - un titre de document trop long aussi ;
  - une adresse email mal formée aussi.
- **Droits :** sans objet, car la règle ne change aucun droit.
- **Hors ligne :** un texte trop long saisi hors ligne est refusé au retour du réseau, avec le message.

Tests unitaires : `text(type)`, et ses messages.

Tests d'intégration : un champ de chaque type, et un texte de fond de 1 000 000 de caractères.

### Tests écrits

- `tests/e2e/textLengths.spec.ts` :
  - personnage : nom trop long refusé sous le champ, historique de 300 000 caractères enregistré ;
  - jeu : adresse de contact mal formée refusée, puis mise en minuscules ;
  - refus d'une modification faite hors ligne.
- `tests/integration/textLengths.test.ts` :
  - historique de 900 000 caractères, et refus à 1 000 001 ;
  - nom de personnage, titre de document, description d'intrigue et adresse d'un lieu au-delà de leur plafond ;
  - document de 900 000 caractères ;
  - adresse de contact d'un jeu (minuscules, refus, gardée par une modification qui ne l'envoie pas) ;
  - invitation à co-organiser.
- Tests unitaires : `tests/server/fieldRules.test.ts` (`TEXT_MAX`, `tooLong`, `requiredTextField`, `optionalTextField`, `requiredEmail`, `optionalEmail`).

### Revue de la PR #256

- Les messages nomment le champ comme l'écran : « Le pitch », « Le background », « Le corps », « La localisation libre », « La fausse identité »…
- Le plafond du serveur d'envoi passe par `TEXT_MAX` et `tooLong`.
- R12 précisée par l'utilisatrice : un texte déjà trop long est refusé à la prochaine modification de sa fiche, sans comparaison champ par champ.

### Notes

- Chaque formulaire de l'écriture du jeu et des sessions range les refus du serveur sous leur champ (`SERVER_FIELDS`) ; ceux d'un champ absent restent sous le bouton. Les messages faits sur l'écran reprennent le texte du serveur : « Le nom est obligatoire », et non plus « Le nom est requis. ».
- Les outils des assistants d'IA bornent un texte au plus grand plafond (1 000 000) ; le plafond de chaque champ vient ensuite du schéma commun, avec son message.
- Les plafonds déjà posés gardent leur valeur et reçoivent un message en français (sujet et texte d'un email d'annulation, nom d'un tarif, valeur d'équilibre).
- L'écran de connexion met l'adresse en minuscules sans vérifier sa forme : une adresse mal formée y reçoit le même refus qu'un mot de passe faux.
- Limites connues :
  - certains formulaires, hors de l'écriture du jeu et des sessions, affichent encore un texte trop long sous leur bouton plutôt que sous le champ : le trombinoscope d'un personnage, la note d'une ligne de casting et les réglages d'envoi des emails. Le message nomme le champ et son plafond ;
  - Limbus n'a pas de limite générale de taille d'une requête. La limite d'Apache sur le serveur (`LimitRequestBody`) n'a pas été vérifiée, et un texte de fond de 1 000 000 de caractères n'a pas été essayé en production.
