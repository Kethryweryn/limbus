---
titre: Cycle de vie d'une session : annulation, report, remboursement
statut: prête
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

Aucun : tranchés le 29 octobre 2026 (voir les décisions).

## Décisions

- 2026-10-29 : la fiche est traitée avec les écarts de [SPEC-004](../specs/SPEC-004-sessions.md), dans [EPIC-004](../epics/EPIC-004-ecarts-sessions/README.md). Choix de l'utilisatrice :
  - une session « Terminée » sort des listes courantes (tableau de bord, prochaines sessions) mais reste modifiable ;
  - la confirmation de présence passe par un lien personnel envoyé par email, comme les inscriptions ([ADR-0018](../adr/ADR-0018-jetons-des-liens-personnels.md)) ;
  - pour une session reportée, l'organisation choisit pour chaque personne qui a payé : report du paiement sur la nouvelle session, remboursement à faire, ou remboursé ;
  - une personne qui ne confirme pas avant la date limite est signalée « délai dépassé » ; l'organisation libère sa place ou prolonge le délai ([ADR-0020](../adr/ADR-0020-echeances-evaluees-a-la-lecture.md)) ;
  - à l'annulation et au report, Limbus propose un email, que l'organisation relit et envoie à la main ;
  - supprimer une session qui a des paiements ou des inscriptions est refusé : Limbus oriente vers l'annulation ou le report ;
  - un report crée toujours une nouvelle session, sans choisir une session existante ; la confirmation de présence va à toute l'équipe, avec une date limite choisie au report (7 jours par défaut) ;
  - les sessions existantes ne sont pas visibles sur la page publique ; une session terminée ou annulée est rangée avec les sessions passées.
