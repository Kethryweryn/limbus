---
id: US-253
titre: Une longueur maximale sur chaque texte, des emails vérifiés partout
statut: à faire
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

- [ ] Chaque champ texte saisi, dans les routes comme dans les outils des assistants d'IA, a le plafond de son type selon le barème de R9. Les plafonds déjà en place ne changent pas.
- [ ] Étant donné un historique de personnage de 900 000 caractères, quand je l'enregistre, alors il est accepté.
- [ ] Étant donné un nom de personnage de 201 caractères, quand je l'enregistre, alors « Le nom : 200 caractères au plus » s'affiche sous le champ.
- [ ] Chaque adresse email saisie est mise en minuscules, fait 254 caractères au plus et a la forme d'une adresse (R10).
- [ ] Sur chaque formulaire, les refus s'affichent sous le champ concerné (R11).

## Notes techniques

- Les plafonds sont écrits une seule fois : `text(type)` et `TEXT_MAX`, dans `server/utils/fieldRules.ts`.
- Il faut relever chaque champ de `schemas.ts` et de `server/mcp/`.
- La limite générale de taille d'une requête doit laisser passer un texte de fond de 1 000 000 de caractères.

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
