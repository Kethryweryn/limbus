---
id: ADR-0084
titre: Le libellé d'une session est calculé à chaque lecture, et la session n'a plus de nom en base
statut: accepté
date: 2026-11-11
liens: [SPEC-021, ADR-0083, ADR-0024, ADR-0030]
---

# ADR-0084 : Le libellé d'une session est calculé à chaque lecture, et la session n'a plus de nom en base

Remplace [ADR-0083](ADR-0083-libelle-de-session-calcule.md).

## Contexte

ADR-0083 gardait le libellé calculé dans la colonne `Session.name`. La revue de la PR #217 a montré le défaut de ce choix : un texte d'affichage rangé dans une colonne que du code technique lit déjà. L'empreinte des envois et celle des trombinoscopes contenaient le nom de la session, et le titre du jeu : un libellé qui change marquait des envois « à renvoyer » sans que rien d'envoyé n'ait changé. Le nom n'existant plus (SPEC-021), rien ne doit le stocker.

## Décision

- La colonne `Session.name` disparaît, en deux temps (ADR-0024) : d'abord facultative, et ni lue ni écrite par le code ; puis supprimée, une fois le build précédent remplacé.
- Le libellé se calcule à chaque lecture : `sessionLabels` (`utils/sessionLabels.ts`) sur les sessions du jeu ; côté serveur, `sessionLabelsFor` lit en une requête les sessions des jeux concernés, et chaque lecture qui montre une session lui ajoute `label`. Le libellé n'est jamais écrit en base, ni dans une empreinte, un identifiant ou une comparaison.
- L'adresse (`slug`) reste faite du jeu et de la date (SPEC-021, R5), recalculée quand une session est créée, déplacée ou supprimée ; c'est un identifiant de page, que les écritures n'utilisent pas (elles passent par l'identifiant).
- Les empreintes (envois, ADR-0044 ; trombinoscopes, ADR-0030) ne portent que le contenu : ni libellé de session, ni titre du jeu.

## Conséquences

- Toute lecture qui montre une session lit aussi la date, le lieu et la création des autres sessions de son jeu : une requête de plus par lecture, sur des listes courtes.
- Hors ligne, une page garde le libellé qu'elle a lu ; une session modifiée sans réseau prend le libellé de sa nouvelle date en attendant le serveur.
- Au déploiement, les envois et trombinoscopes existants sont marqués une fois « à renvoyer » ou « à regénérer » : leur empreinte change de forme.

## Options écartées

- Garder le libellé dans `name` (ADR-0083) : du code technique s'y appuie sans le savoir.
- Une colonne `label` dédiée : moins trompeuse, mais toujours un texte d'affichage stocké, qu'il faut recalculer à chaque écriture d'une voisine.
