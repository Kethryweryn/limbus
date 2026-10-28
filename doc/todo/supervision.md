---
titre: Supervision de la production
statut: à trancher
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

## Points à trancher

- Quel service ? À comparer : offre gratuite, fréquence, alertes par email, hébergement en Europe.
- La route de santé dit-elle seulement « ça marche », ou aussi la version déployée (SHA) ? Recommandation : le SHA aussi, utile pour vérifier un déploiement, et sans risque.
- Surveiller aussi le site professionnel (jdmottot.fr) avec le même service ? Recommandation : oui.
