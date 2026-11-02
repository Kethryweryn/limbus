---
titre: Supervision de la production
statut: en partie traitée
date: 2026-10-29
revue: ../revues/2026-10-29-architecture.md
---

# Supervision de la production

## Besoin

Une panne de Limbus n'est découverte que lorsque quelqu'un ouvre le site (revue d'architecture, R-15). Le 29 octobre 2026, le site professionnel hébergé sur le même serveur est resté en erreur toute une nuit sans que personne le sache : une mise à jour de PHP avait été suivie d'un simple rechargement d'Apache.

## Proposition

- Une route `GET /api/public/health`, publique comme les autres routes de `public/` (CLAUDE.md), qui vérifie que la base répond et renvoie 200 ou 503, sans aucune donnée.
- Un service externe gratuit de surveillance de disponibilité, qui interroge cette route toutes les 5 minutes et prévient par email en cas d'échec. Il peut aussi surveiller jdmottot.fr.
- Plus tard, et seulement si la supervision le demande : des journaux structurés en JSON (Pino), pour alerter sur les erreurs serveur (R-16).

## Découpage envisagé

1. Route de santé (code, PR).
2. Compte et sondes chez le service choisi : c'est l'utilisatrice qui crée le compte.
3. Journaux structurés, si besoin (R-16).

## Suivi

- 2026-11-01 : choix de l'utilisatrice : Better Stack, version dans la réponse, site professionnel surveillé aussi. Route de santé faite ([EPIC-026](../archive/epics/EPIC-026-supervision/README.md), [ADR-0052](../adr/ADR-0052-page-de-sante.md)).
- 2026-11-01 : sondes Better Stack créées par l'utilisatrice, pour Limbus et pour le site professionnel. Reste : les journaux structurés, si besoin.

## Points tranchés

- Service : Better Stack (choix de l'utilisatrice, 2026-11-01).
- La route de santé donne aussi la version déployée (SHA).
- Le site professionnel est surveillé par le même service.

## Reste

- Journaux structurés (R-16), seulement si la supervision le demande.
