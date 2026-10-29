---
titre: Cycle de vie d'une session : annulation, report, remboursement
statut: à trancher
date: 2026-10-29
---

# Cycle de vie d'une session : annulation, report, remboursement

## Besoin

Une session peut être annulée, reportée, ou « désannulée » quand une solution est trouvée. Aujourd'hui, ces statuts ne sont qu'affichés ([SPEC-004](../specs/SPEC-004-sessions.md), R2 et écart 1). Supprimer une session efface ses paiements sans rien proposer (R3). L'organisation n'a donc aucun outil pour :

- rembourser les personnes qui ont payé une session annulée ou reportée ;
- reprendre le casting d'une session reportée sur la nouvelle date ;
- savoir qui sera bien présent à la nouvelle date : participants, organisateurs, cuisine et PNJ.

## Proposition

- **Statuts réversibles** : une session passe de « Prévue » à « Annulée » ou « Reportée », et peut revenir en arrière (désannulation). Une session annulée peut aussi être reportée.
- **Remboursement** : pour une session annulée ou reportée, la page des paiements liste les personnes qui ont payé. Pour chacune, l'organisation choisit entre remboursement à faire, remboursé ou report du paiement sur la nouvelle session.
- **Report** : reporter une session crée la nouvelle session, ou en choisit une existante, et y reprend l'équipe et le casting. Chaque personne doit confirmer sa présence. L'organisation suit les confirmations (en attente, confirmé, ne viendra pas), et peut relancer.
- **Suppression** : supprimer une session qui a des paiements ou des inscriptions oriente d'abord vers l'annulation ou le report.

## Découpage envisagé

1. Statuts réversibles et suppression qui oriente vers l'annulation.
2. Suivi des remboursements.
3. Report avec reprise du casting.
4. Confirmation de présence et relances.

## Points à trancher

- Que doit faire une session « Terminée » : passer en lecture seule, sortir des listes courantes, les deux, ou rien de plus ?
- La confirmation de présence passe-t-elle par un lien personnel par email, comme les inscriptions ([SPEC-001](../specs/SPEC-001-inscriptions.md), [ADR-0018](../adr/ADR-0018-jetons-des-liens-personnels.md)) ? Recommandation : oui, en réutilisant ce mécanisme.
- Un report garde-t-il les paiements tels quels (la place est reportée), ou faut-il les rattacher explicitement à la nouvelle session ?
- Que devient une personne qui ne confirme pas avant une date limite ? Sa place est-elle libérée, comme pour une inscription sans réponse ([ADR-0020](../adr/ADR-0020-echeances-evaluees-a-la-lecture.md)) ?
- Faut-il prévenir les participants par email à l'annulation et au report ?
