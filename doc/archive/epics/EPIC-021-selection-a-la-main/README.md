---
id: EPIC-021
titre: Sélection à la main : retenues, liste d'attente, confirmation et vivier
statut: terminé
spec: ../../../specs/SPEC-001-inscriptions.md
date: 2026-10-31
---

# EPIC-021 : Sélection à la main : retenues, liste d'attente, confirmation et vivier

## Objectif

Première moitié du lot 3 de [SPEC-001](../../../specs/SPEC-001-inscriptions.md) (R5, R7, R16, R19 à R21, R30, R31) : l'équipe trie les inscriptions reçues par le formulaire, annonce les résultats, la personne retenue confirme sa place, et une place libérée propose la suivante de la liste d'attente. Le vivier de l'inscription permanente sert de la même façon, session par session.

Le tirage au sort, le mode mixte, les pondérations et la question d'équilibre (R4, R8, R17, R18) font l'epic suivant.

## Décisions

- L'équipe trie tranquillement, peut changer d'avis, puis clique sur « Annoncer les résultats » : les emails partent alors d'un coup.
- Dans une période à plusieurs sessions, on retient une personne directement pour une session où elle est disponible.
- La liste d'attente est propre à chaque session ; une personne peut attendre dans plusieurs, et sort des autres files dès qu'elle est retenue.
- L'email d'attente ne donne pas de rang.
- Une personne retenue confirme d'un bouton, par son lien ou son compte ; ses réponses restent celles du formulaire.
- On ne retient pas au-delà des places : il faut d'abord augmenter le nombre de places.
- Vivier : seules les personnes retenues ou mises en attente pour une session sont prévenues ; après avoir joué, une personne revient au vivier, sauf si les rejoueurs sont exclus.

## US

| US | Titre | Statut |
|---|---|---|
| [US-087](US-087-trier-les-inscriptions.md) | Retenir, mettre en attente ou écarter une inscription | terminée |
| [US-088](US-088-annoncer-les-resultats.md) | Annoncer les résultats | terminée |
| [US-089](US-089-confirmer-sa-place.md) | Confirmer sa place, et proposer la suivante quand une place se libère | terminée |
| [US-090](US-090-vivier-de-l-inscription-permanente.md) | Choisir dans le vivier de l'inscription permanente | terminée |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0047](../../../adr/ADR-0047-selection-des-inscriptions.md).
