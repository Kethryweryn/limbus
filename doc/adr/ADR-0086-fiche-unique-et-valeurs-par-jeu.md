---
id: ADR-0086
titre: Une fiche par adresse dans tout Limbus, nom et téléphone par jeu, et fusion des fiches existantes
statut: accepté
date: 2026-11-11
liens: [SPEC-022, ADR-0040, ADR-0041, ADR-0042, ADR-0024, ADR-0075]
---

# ADR-0086 : Une fiche par adresse dans tout Limbus, nom et téléphone par jeu, et fusion des fiches existantes

## Contexte

[SPEC-022](../specs/SPEC-022-compte-pour-chaque-participant.md) veut une seule fiche par adresse dans tout Limbus. Aujourd'hui, la règle vaut seulement dans les jeux d'une même propriétaire, et seul le code la tient (US-185). Le nom et le téléphone sont sur la fiche (`Participant.name`, `Participant.phone`), communs à tous ses jeux. Avec une fiche partagée entre équipes, chaque équipe doit garder ses propres valeurs tant que la personne n'a pas rempli les siennes (R6). Les notes sont déjà rangées par jeu, sur `ParticipantGame` ([ADR-0040](ADR-0040-notes-par-jeu.md)). Les droits d'une équipe passent tous par l'accès aux jeux (`accessibleGameIds`).

## Décision

1. **Nom et téléphone par jeu** : colonnes `name`, `phone` et `updatedAt` sur `ParticipantGame`, choix de l'utilisatrice le 2026-11-11.
   - Une modification s'applique aux jeux de la fiche que voit la personne qui modifie.
   - Une lecture prend la valeur du jeu concerné. Sans jeu précis (fiche, liste), elle prend celle du jeu visible au `updatedAt` le plus récent.
   - Une modification envoie la version lue : le plus récent `updatedAt` des liens visibles (`assertRowsVersion`), comme une liste remplacée d'un bloc ; un lien modifié entre-temps la refuse, en ligne comme au retour du réseau (ADR-0036).
   - La recopie des coordonnées d'un compte ([ADR-0042](ADR-0042-coordonnees-du-compte.md)) écrit sur les liens.
   - Les colonnes de `Participant` sont retirées en deux temps (ADR-0024) : d'abord écrites et lues avec les nouvelles, puis supprimées (US-242).
2. **Une fiche par adresse** : la création et le rapprochement des inscriptions cherchent la fiche de l'adresse dans tout Limbus, en comparant sans la casse (`citext`, [ADR-0075](ADR-0075-emails-en-citext.md)). Tant que la fusion n'est pas passée, s'il y en a plusieurs, c'est la plus ancienne (`createdAt`), celle que la fusion gardera. Après la fusion, un index unique sur `Participant.email` le garantit en base. Plusieurs fiches sans adresse restent possibles, car PostgreSQL ne compare pas les valeurs nulles.
3. **Correction d'adresse par équipe** : déplacer vers la fiche de la nouvelle adresse les seules lignes des jeux visibles. Ce sont les liens, les casts, les inscriptions, les présences, les envois, les paiements, les trombinoscopes et les responsabilités de déroulé. La fiche de la nouvelle adresse est créée si besoin. Une fiche qui n'a plus de jeu est supprimée.
4. **Fusion** : une migration SQL réunit les fiches d'une même adresse dans la plus ancienne (`createdAt`).
   - Toutes les lignes qui désignent une fiche y sont reportées.
   - Quand deux lignes se retrouvent en double pour une même clé unique, elles sont réunies : notes concaténées, ligne la plus récente pour le cast, l'inscription et le paiement.
   - Le refus de photo est gardé si l'une le portait, et le compte de l'adresse est rattaché s'il existe.
   - Les adresses de page des fiches absorbées ne répondent plus.
   - La migration ajoute ensuite l'index unique.
5. **Une fonction SQL commune** : `limbus_move_participant(from, to, jeux)` fait le déplacement de la décision 3 et la réunion de la décision 4, avec les mêmes règles de doublon. L'application l'appelle à la correction d'adresse, la migration de fusion pour chaque doublon. Un test d'intégration vérifie qu'elle porte chaque table qui désigne une fiche.

## Conséquences

- Les droits ne changent pas de forme : une équipe voit et modifie ce qui est rattaché aux jeux auxquels elle a accès. Un jeu cédé à une autre propriétaire emporte ses valeurs.
- Une co-organisatrice qui ne voit qu'un des jeux d'une propriétaire peut donner à ce jeu un nom différent des autres jeux de la propriétaire.
- La fusion est irréversible. Elle ne touche que des données de test en production à ce jour.
- Les tables qui désignent une fiche doivent toutes figurer dans la fusion et dans le déplacement par équipe. Un test d'intégration le vérifie à partir du schéma, comme `sameGame.test.ts`.

## Options écartées

- **Valeurs par propriétaire** : il faudrait une règle de droits nouvelle entre co-organisatrices, et déplacer les valeurs quand un jeu change de propriétaire.
- **Une fiche par équipe reliée au même compte** : contraire à la décision « une seule fiche par personne dans tout Limbus ».
