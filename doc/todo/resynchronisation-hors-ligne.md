---
titre: Resynchronisation hors ligne
statut: à trancher
date: 2026-10-29
revue: ../revues/2026-10-29-architecture.md
---

# Resynchronisation hors ligne

## Besoin

Les modifications faites hors ligne sont rejouées au retour du réseau ([SPEC-010](../specs/SPEC-010-hors-ligne.md)). Quand l'une d'elles est refusée (conflit avec une modification faite ailleurs, élément supprimé, droits retirés), elle reste en erreur :

- l'organisatrice voit seulement le nombre d'erreurs, sans savoir lesquelles ;
- elle ne peut ni corriger, ni réessayer, ni abandonner ces modifications ;
- seule la déconnexion les fait disparaître, en effaçant tout l'appareil.

De plus, le contrôle de conflit est partiel : il n'a lieu que si la requête porte la date de la version lue, et jamais pour une suppression ([revue d'architecture](../revues/2026-10-29-architecture.md), R-13). Une suppression rejouée peut effacer un élément modifié entre-temps par une co-organisatrice.

## Proposition

- **Liste des modifications en attente et en erreur** : pour chacune, l'élément, l'action, la date et la cause du refus.
- **Résolution d'un conflit** : comparer la version locale et celle du serveur, puis garder l'une ou l'autre, ou abandonner la modification.
- **Contrôle de conflit sur toutes les écritures rejouées**, suppressions comprises (R-13).
- **Abandon sans déconnexion** : vider la file, ou une modification, sans effacer le reste de l'appareil.

## Découpage envisagé

1. Liste des modifications en attente et en erreur, avec abandon.
2. Contrôle de conflit sur toutes les écritures rejouées, suppressions comprises (R-13).
3. Résolution d'un conflit par comparaison.

## Points à trancher

- La comparaison se fait-elle champ par champ, ou version entière contre version entière ? Recommandation : version entière d'abord, plus simple, quitte à affiner.
- Une modification en erreur bloque-t-elle les suivantes qui portent sur le même élément ? Aujourd'hui, elles partent quand même.
- Faut-il un ADR pour le protocole de conflit (date de version, ou numéro de version incrémenté) ?
