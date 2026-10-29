---
id: ADR-0042
titre: Les coordonnées d'une personne qui a un compte vivent sur le compte et sont recopiées sur ses fiches
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-011-un-compte-pour-tout-le-monde.md, ADR-0041-fiches-rattachees-a-un-compte.md]
---

# ADR-0042 : Les coordonnées d'une personne qui a un compte vivent sur le compte et sont recopiées sur ses fiches

## Contexte

Les coordonnées sont aujourd'hui sur la fiche participant (nom, téléphone) et sur chaque inscription (prénom, nom, téléphone, contact d'urgence, allergies) ; la fiche allergies et les écrans des équipes lisent ces copies. [SPEC-011](../specs/SPEC-011-un-compte-pour-tout-le-monde.md) (R12) veut que la personne qui a un compte les tienne seule, en une seule version.

## Décision

- Les coordonnées vivent sur le compte : `User.name` et les colonnes `phone`, `emergencyContactName`, `emergencyContactPhone`, `dietary`, `healthConsentAt`, plus `profileUpdatedAt` (date du premier enregistrement, et des suivants).
- Elles sont recopiées (`syncProfileToParticipants`) sur les fiches rattachées (nom, téléphone) et sur leurs inscriptions non désistées déjà remplies, pour les seuls champs que le formulaire de chacune a demandés (prénom et nom découpés, téléphone, contact d'urgence, allergies et consentement), à chaque enregistrement et à chaque nouveau rattachement. Une invitation sans réponse se préremplit à l'affichage. Tant que la personne n'a jamais enregistré ses coordonnées, rien n'est recopié : les fiches gardent ce que les équipes ont saisi.
- Recopier plutôt que lire à la volée : tous les écrans, exports et la fiche allergies continuent de lire les fiches et les inscriptions, sans changement, et chaque équipe ne voit que les copies de ses jeux.
- Une réponse faite depuis le compte met aussi à jour le compte, puis recopie : une seule version. Une réponse par le lien personnel, qui peut avoir été transmis, ne touche pas au compte.
- La fiche allergies d'une session ajoute les allergies déclarées, avec consentement, dans le compte des personnes du cast sans inscription (PNJ, orgas, cuisine).
- Sur une fiche rattachée, le serveur ignore le nom et le téléphone envoyés par l'équipe ; l'email reste modifiable, et le changer détache la fiche ([ADR-0041](ADR-0041-fiches-rattachees-a-un-compte.md)).

## Conséquences

- Une inscription désistée garde les coordonnées du moment : c'est une trace.
- Les données de santé existent en une copie de plus (le compte). L'export et l'effacement depuis le compte (lot 6) devront les couvrir.

## Options écartées

- **Lire le compte à l'affichage** : chaque écran, export et la fiche allergies devraient choisir entre le compte et la copie.
- **Une version par jeu** : écartée par l'utilisatrice.
