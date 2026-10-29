---
id: ADR-0033
titre: "Paiement d'une personne qui part : décision sur le paiement, transfert par versement, proposition à la lecture"
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-006-emails-et-paiements.md, ../specs/SPEC-007-participants-et-rgpd.md, ../epics/EPIC-007-ecarts-participants/US-039-paiement-d-une-personne-qui-part.md]
---

# ADR-0033 : Paiement d'une personne qui part

## Contexte

Une personne qui a payé peut quitter une session : désistement, retrait d'un jeu ([SPEC-007](../specs/SPEC-007-participants-et-rgpd.md), écart 2), retrait de l'équipe. Son paiement reste affiché à part, sans suite possible dans Limbus ([SPEC-006](../specs/SPEC-006-emails-et-paiements.md), R16). Dans les GN, une date limite de désistement fixe souvent le moment après lequel la place n'est remboursée qu'au bon vouloir des orgas, et un remplaçant peut reprendre la place, parfois offerte. L'utilisatrice a fait ses choix le 29 octobre 2026.

## Décision

- La décision porte sur le paiement (`SessionPayment.refundStatus`), comme pour une session annulée ou reportée ([ADR-0029](ADR-0029-cycle-de-vie-d-une-session.md)). Deux statuts s'ajoutent : `kept` (gardé, non remboursé) et `transferred` (transféré au remplaçant), avec `transferredToParticipantId`.
- Une personne « partie » est une personne qui a payé (case cochée ou versement, [ADR-0032](ADR-0032-tarifs-et-versements.md)) et n'est plus dans le tableau. On ne garde pas la date de son départ : elle part par plusieurs chemins (équipe, désistement, retrait d'un jeu).
- Tant qu'aucune décision n'est prise, la proposition est calculée à la lecture ([ADR-0020](ADR-0020-echeances-evaluees-a-la-lecture.md)) : « à rembourser » si la date limite de désistement de la session (`Session.withdrawalDeadline`) n'est pas passée, « gardé » sinon ; rien sans date limite.
- Le transfert crée chez le remplaçant ce qui compte comme payé dans le mode de la session : un versement du montant reçu en mode tarifs, la case « payé » en mode simple. Revenir sur un transfert ne retire rien chez le remplaçant.
- Une place offerte (`SessionPayment.offered`) met le dû à zéro et l'état à « place offerte », dans les deux modes.

## Conséquences

- La proposition peut changer si l'organisatrice tarde à décider après la date limite : c'est la date de la décision qui compte, pas celle du départ.
- Les statuts de remboursement servent aux sessions annulées ou reportées et aux personnes parties ; l'interface ne propose que ceux qui ont un sens dans chaque cas.

## Options écartées

- **Garder la date du départ** : il faudrait la noter à chaque chemin de départ, et un retour dans l'équipe la rendrait fausse.
- **Transférer l'enregistrement du paiement** : on perdrait la trace de qui a payé.
