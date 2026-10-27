---
id: ADR-0011
titre: Effacement et export des données d'un participant centralisés
statut: accepté
date: 2026-10-27
liens: [ADR-0008, ADR-0007]
---

# ADR-0011 : Effacement et export des données d'un participant centralisés

*Rédigé a posteriori, pour des décisions prises le 2026-10-27.*

## Contexte

Les participants n'ont pas de compte : ce sont les organisatrices qui saisissent et gèrent leurs données (coordonnées, photos, paiements, envois). Le RGPD leur donne un droit d'accès et un droit à l'effacement, que l'organisatrice doit pouvoir exercer pour eux. Leurs données sont réparties dans de nombreuses tables et dans des fichiers.

## Décision

- Toute la logique est dans `server/utils/participantPrivacy.ts` :
  - `eraseParticipant` supprime, dans une transaction, le participant et tout ce qui en dépend. Elle retire sa photo des attributions de session (l'attribution du personnage reste), supprime les trombinoscopes des sessions où il avait une photo (à régénérer), puis supprime les fichiers devenus inutiles ([ADR-0008](ADR-0008-fichiers-televerses.md)).
  - `exportParticipantData(participantId, gameIds)` produit un JSON limité aux jeux auxquels l'organisatrice a accès ; un participant partagé entre plusieurs équipes ne révèle pas les données des autres.
- Routes : suppression du participant, et `GET /api/participants/:id/export` (fichier JSON en pièce jointe).
- Toute nouvelle donnée liée à un participant doit être couverte par ces deux fonctions ; c'est une règle de CLAUDE.md, vérifiée par `tests/integration/privacy.test.ts`.

## Conséquences

- Un seul endroit à relire pour savoir ce qu'on sait d'un participant et comment on l'efface.
- Supprimer un participant fait disparaître des trombinoscopes déjà générés : l'organisatrice doit les régénérer avant l'envoi.
- Les futures données d'inscription (allergies, contact d'urgence, affinités) devront y être ajoutées dès leur création.

## Options écartées

- **Anonymisation au lieu de suppression** : utile pour des statistiques, sans besoin aujourd'hui, et plus difficile à garantir.
- **Portail participant pour exercer ses droits soi-même** : demande des comptes participants, hors périmètre.
