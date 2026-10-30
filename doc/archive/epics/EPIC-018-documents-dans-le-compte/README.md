---
id: EPIC-018
titre: Documents et trombinoscopes dans le compte
statut: terminé
spec: ../../../specs/SPEC-011-un-compte-pour-tout-le-monde.md
date: 2026-10-30
---

# EPIC-018 : Documents et trombinoscopes dans le compte

## Objectif

Lot 7 de [SPEC-011](../../../specs/SPEC-011-un-compte-pour-tout-le-monde.md) (R14) : ce qu'une personne reçoit par email (documents, fiche personnage, trombinoscope) garde sa pièce jointe, et se retrouve aussi dans son espace « Je participe », à lire dans la page ou en PDF.

## Décisions

- La personne voit ce qu'on lui a envoyé, pas la version en cours d'écriture : Limbus garde une copie de chaque envoi, pour tout le monde (un compte créé plus tard retrouve ses envois). Un renvoi remplace la copie.
- Seul ce qui est parti par email apparaît.
- Documents et fiche se lisent dans la page, avec le PDF à télécharger ; le trombinoscope s'affiche aussi avec ses photos.
- Les copies comptent dans le stockage de la propriétaire du jeu, sans jamais bloquer un envoi.
- Les copies s'effacent le lendemain de la session ; une session reportée suit sa nouvelle date ; une session annulée s'efface un mois après l'annulation. Ensuite, la personne lit la dernière version validée, par un lien direct.

## US

| US | Titre | Statut |
|---|---|---|
| [US-078](US-078-copie-de-chaque-envoi.md) | Garder une copie de ce qui est envoyé | terminée |
| [US-079](US-079-mes-documents.md) | Retrouver ses documents dans « Je participe » | terminée |
| [US-080](US-080-nettoyage-des-copies.md) | Effacer les copies après la session | terminée |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0044](../../../adr/ADR-0044-copies-des-envois.md).
