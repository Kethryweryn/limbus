---
id: EPIC-060
titre: Valider les saisies partout
statut: terminé
spec: ../../../specs/SPEC-023-validation-des-saisies.md
date: 2026-11-17
---

# EPIC-060 : Valider les saisies partout

## Objectif

Limbus refuse les saisies qui ne peuvent pas être justes et affiche le message sous le champ concerné ([SPEC-023](../../../specs/SPEC-023-validation-des-saisies.md), [ADR-0092](../../../adr/ADR-0092-validation-des-saisies.md)). Les cas visés :

- un nom avec des chiffres ;
- un téléphone qui n'en est pas un ;
- un contact d'urgence à moitié rempli ;
- un texte démesuré.

Cet epic répond aux retours A9-1, A9-2 et A10-1 du cahier de tests.

## US

| US | Titre | Statut |
|---|---|---|
| [US-251](US-251-noms-de-personnes.md) | Un nom de personne ne contient que des lettres et des séparateurs | terminée |
| [US-252](US-252-telephones-et-contact-d-urgence.md) | Des téléphones vérifiés selon leur pays, et un contact d'urgence complet | terminée |
| [US-253](US-253-longueurs-et-emails.md) | Une longueur maximale sur chaque texte, des emails vérifiés partout | terminée |

## Définition de terminé

- Toutes les US sont terminées.
- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- La spec est à jour, et les décisions prises ont leur ADR.
- Les jeux de test et `doc/jeux-de-test.md` suivent les nouvelles règles.
- Le cahier de tests est à jour (A9, A10).

## Suivi

- 2026-11-17 : les trois US sont déployées.
  - US-251, noms de personnes : PR #254, déploiement n° 254.
  - US-252, téléphones et contact d'urgence : PR #255, déploiement n° 255. La migration s'est appliquée avec le déploiement ; son résultat sur les numéros de production n'a pas été relu, seulement vérifié par le test d'intégration.
  - US-253, longueurs et emails : PR #256, déploiement n° 256.
- Ce que les revues ont changé :
  - un nom ou un téléphone déjà enregistré n'est vérifié que s'il change ;
  - un refus sans champ reste affiché ;
  - l'export CSV garde le téléphone en texte pour Excel ;
  - les messages nomment les champs comme l'écran ;
  - R12 précisée : un texte déjà trop long est refusé à la prochaine modification de sa fiche.
- Changé en passant : une modification faite hors ligne et refusée affiche le détail du refus.
- Limites connues :
  - le trombinoscope d'un personnage, la note d'une ligne de casting et les réglages d'envoi gardent le message sous le bouton ;
  - la limite de taille d'Apache sur le serveur n'a pas été vérifiée ;
  - hors ligne, un numéro s'affiche tel qu'il a été tapé jusqu'au retour du réseau (choix de l'utilisatrice).
- À vérifier dans le cahier : A9-1, A9-2 et A10-1.
