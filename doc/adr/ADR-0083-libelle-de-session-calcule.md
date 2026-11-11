---
id: ADR-0083
titre: Le libellé d'une session est calculé par le serveur et gardé à la place du nom
statut: accepté
date: 2026-11-11
liens: [SPEC-021, SPEC-004]
---

# ADR-0083 : Le libellé d'une session est calculé par le serveur et gardé à la place du nom

## Contexte

SPEC-021 retire le nom d'une session : elle se lit par sa date, avec l'heure, le lieu ou un numéro quand une autre session du jeu lui ressemble (R2). Le libellé d'une session dépend donc des autres sessions de son jeu. Le nom est lu dans une trentaine d'endroits : pages, PDF, emails, export, assistants d'IA, hors ligne.

## Décision

- La colonne `Session.name` reste, et garde le libellé calculé. Personne ne l'écrit plus : `sessionLabels` (`utils/sessionLabels.ts`) calcule les libellés de toutes les sessions d'un jeu, et `refreshSessionLabels(tx, gameId)` (`server/utils/sessionLabels.ts`) les réécrit, avec leur adresse, dans la transaction de toute écriture qui crée une session, change sa date ou son lieu, ou en supprime une (formulaire, report, assistants d'IA, jeux de test).
- Le jour et l'heure se lisent à l'heure de Paris.
- L'adresse (`slug`) est faite du slug du jeu et de la date (`AAAA-MM-JJ`, ou `sans-date`), avec le suffixe de `generateUniqueSlug` en cas de doublon.
- Les sessions existantes prennent leur libellé et leur adresse au démarrage du serveur : un plugin Nitro recalcule, pour chaque jeu, les libellés qui diffèrent de ceux attendus. Il ne réécrit rien quand tout est à jour, et répare aussi une écriture qui aurait échappé au recalcul.

## Conséquences

- Les lectures ne changent pas : elles lisent `name`, qui est le libellé. Le hors ligne garde le libellé lu.
- Créer, déplacer ou supprimer une session peut changer le libellé et l'adresse de ses voisines du même jour.
- Le jeu devant le libellé (R4) se compose à l'affichage, là où le libellé sort des pages du jeu.
- Une ancienne adresse de session ne mène plus à elle.

## Options écartées

- Calculer le libellé à chaque lecture : il faudrait lire les autres sessions du jeu dans chaque route et chaque PDF, et le hors ligne ne les a pas toujours.
- Supprimer la colonne et en créer une nouvelle : une migration incompatible avec le build en service (ADR-0024) pour le même résultat.
- Recalculer les sessions existantes dans la migration SQL : il faudrait réécrire en SQL le format des dates en français et les règles de doublon, au risque de diverger du code.
