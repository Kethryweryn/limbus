---
titre: Une session sans nom, désignée par sa date
statut: archivée
date: 2026-11-11
spec: ../../specs/SPEC-021-session-sans-nom.md
---

# Une session sans nom, désignée par sa date

## Besoin

Retour D2-1 du cahier de tests (2026-11-09) : l'utilisatrice ne veut pas de nom pour une session, et demande d'afficher à la place « Session <statut> ». Plusieurs sessions à venir ayant le même statut, la date les distingue mieux.

## Proposition

Une session n'a plus de nom à saisir : elle se lit « Session du 15 mai 2099 », avec son statut en badge, partout où son nom apparaissait.

## Découpage envisagé

Un lot : le libellé calculé, son adresse, les sessions existantes ; puis le jeu dans le libellé hors des pages du jeu.

## Points à trancher

Tranchés le 2026-11-11 avec l'utilisatrice :

- libellé : « Session du <date> », le statut en badge ; sans date, « Session sans date » ;
- même jour : l'heure en plus, seulement en cas de doublon ; même heure : le lieu ; sans date en double : le lieu, sinon un numéro ;
- sessions existantes : leur nom est oublié ;
- adresse : le jeu et la date ;
- hors des pages du jeu (emails, PDF, « Je participe », tableau de bord) : le jeu devant le libellé.

Devenue [SPEC-021](../../specs/SPEC-021-session-sans-nom.md).
