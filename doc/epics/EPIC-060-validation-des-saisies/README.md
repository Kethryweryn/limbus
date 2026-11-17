---
id: EPIC-060
titre: Valider les saisies partout
statut: en cours
spec: ../../specs/SPEC-023-validation-des-saisies.md
date: 2026-11-17
---

# EPIC-060 : Valider les saisies partout

## Objectif

Limbus refuse les saisies qui ne peuvent pas être justes et affiche le message sous le champ concerné ([SPEC-023](../../specs/SPEC-023-validation-des-saisies.md), [ADR-0092](../../adr/ADR-0092-validation-des-saisies.md)). Les cas visés :

- un nom avec des chiffres ;
- un téléphone qui n'en est pas un ;
- un contact d'urgence à moitié rempli ;
- un texte démesuré.

Cet epic répond aux retours A9-1, A9-2 et A10-1 du cahier de tests.

## US

| US | Titre | Statut |
|---|---|---|
| [US-251](US-251-noms-de-personnes.md) | Un nom de personne ne contient que des lettres et des séparateurs | terminée |
| [US-252](US-252-telephones-et-contact-d-urgence.md) | Des téléphones vérifiés selon leur pays, et un contact d'urgence complet | à faire |
| [US-253](US-253-longueurs-et-emails.md) | Une longueur maximale sur chaque texte, des emails vérifiés partout | à faire |

## Définition de terminé

- Toutes les US sont terminées.
- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- La spec est à jour, et les décisions prises ont leur ADR.
- Les jeux de test et `doc/jeux-de-test.md` suivent les nouvelles règles.
- Le cahier de tests est à jour (A9, A10).
