---
id: US-190
titre: Faire tenir par la base les règles des liens du questionnaire et des relations
statut: terminée
epic: EPIC-049
regles: []
adr: [ADR-0073]
---

# US-190 : Faire tenir par la base les règles des liens du questionnaire et des relations

En tant que mainteneuse de Limbus, je veux que la base refuse un lien du questionnaire sans cible, à plusieurs cibles ou en double, et une relation d'un personnage avec lui-même, afin que ces règles ne dépendent plus du seul code.

## Critères d'acceptation

- [x] Un `RegistrationQuestionLink` vise exactement un personnage, un groupe ou une intrigue (contrainte `CHECK`).
- [x] Deux liens identiques (même question, même option, même cible) sont refusés.
- [x] Une `CharacterRelation` d'un personnage avec lui-même est refusée (contrainte `CHECK`) ; deux personnages peuvent garder plusieurs relations, dans un sens ou dans l'autre.
- [x] Avant la migration, aucune ligne de production n'enfreint ces règles.

## Notes techniques

Contraintes écrites à la main et nommées (ADR-0073), citées au-dessus de chaque modèle : `RegistrationQuestionLink_une_cible_check`, `CharacterRelation_deux_personnages_check`, et un index unique partiel par sorte de cible (`RegistrationQuestionLink_personnage_unique_key`, `…_groupe_…`, `…_intrigue_…`). L'unicité porte aussi sur le jeu : la copie d'un jeu garde les identifiants des questions.

Un index `NULLS NOT DISTINCT` sur les cinq colonnes a été essayé : Prisma ne le décrit pas et la migration suivante le retirerait. Il ignore en revanche les index partiels, comme ceux des envois de documents.

Production relevée le 2026-11-09 : 14 liens et 3 relations, aucun n'enfreint ces règles. Le build en service les vérifiait déjà avant d'écrire : migration compatible.

Deux enregistrements simultanés des liens se heurtent désormais aux index : le second répond 409 (« rechargez la page »). La copie d'un jeu ignore un lien dont la cible a été créée pendant sa lecture, au lieu de l'écrire sans cible.

ADR :
- [ADR-0073](../../adr/ADR-0073-enumerations-du-schema.md)

## Tests

Intégration : `tests/integration/characterRelations.test.ts`, « règles tenues par la base (US-190) » (chaque règle refusée par la base, avec un témoin qui passe ; un lien envoyé deux fois gardé une fois) ; les routes rendent leur message (relation avec soi-même, lien sans cible ou à deux cibles) ; plusieurs relations entre deux personnages dans les deux sens.

Migration jouée sur une base neuve : la différence avec le schéma est vide.
