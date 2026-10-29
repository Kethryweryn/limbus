---
id: EPIC-015
titre: Compte participant et espace « Je participe »
statut: terminé
spec: ../../../specs/SPEC-011-un-compte-pour-tout-le-monde.md
date: 2026-10-29
---

# EPIC-015 : Compte participant et espace « Je participe »

## Objectif

Lot 4 de [SPEC-011](../../../specs/SPEC-011-un-compte-pour-tout-le-monde.md) : les fiches participant se rattachent au compte de leur adresse (R11) ; la personne retrouve ses sessions, ses inscriptions et ses paiements dans un espace « Je participe », et passe d'un espace à l'autre par un sélecteur.

## Décisions

- Toute fiche à l'adresse confirmée d'un compte s'y rattache, créée avant ou après le compte ; si l'équipe change l'email de la fiche, le rattachement suit la nouvelle adresse.
- Le personnage attribué n'est pas montré : il viendra avec les documents (lot 7).
- Depuis son compte, la personne répond à une invitation à s'inscrire, modifie son inscription et se désiste, comme par son lien personnel, qui continue de marcher.

## US

| US | Titre | Statut |
|---|---|---|
| [US-070](US-070-rattacher-les-fiches.md) | Rattacher les fiches participant au compte de leur adresse | terminée |
| [US-071](US-071-espace-je-participe.md) | Espace « Je participe » : sessions, inscriptions, paiements | terminée |
| [US-072](US-072-repondre-depuis-son-compte.md) | Répondre à une inscription et se désister depuis son compte | terminée |
| [US-073](US-073-selecteur-d-espace.md) | Sélecteur d'espace « J'organise » / « Je participe » | terminée |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0041](../../../adr/ADR-0041-fiches-rattachees-a-un-compte.md) ; CLAUDE.md : routes `me/*` et RIB servi au compte rattaché.
