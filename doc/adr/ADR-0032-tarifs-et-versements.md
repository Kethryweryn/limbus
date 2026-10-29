---
id: ADR-0032
titre: Tarifs de session, versements et état de paiement calculé
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-006-emails-et-paiements.md, ../archive/epics/EPIC-006-ecarts-envois-et-paiements/README.md]
---

# ADR-0032 : Tarifs de session, versements et état de paiement calculé

## Contexte

Le suivi des paiements n'a ni montant ni tarif : une case « payé » par personne ([SPEC-006](../specs/SPEC-006-emails-et-paiements.md), écart 3). Les PAF de GN ont souvent un tarif PJ, un tarif PNJ, la gratuité pour la cuisine et parfois pour les orgas, et des places solidaires : des tarifs de soutien financent des places réduites, attribuées par les orgas. L'utilisatrice a fait ses choix le 29 octobre 2026.

## Décision

- **Montants en centimes d'euro**, entiers, pour éviter les arrondis.
- **`SessionTariff`** (session, nom, montant, rôle par défaut facultatif, tarif de base facultatif). Le rôle par défaut vaut `pj`, `pnj`, `organizer` ou `kitchen`, au plus un tarif par rôle et par session. Un tarif qui a un tarif de base est un tarif solidaire : de soutien s'il est plus cher que sa base, réduit s'il est moins cher.
- **Tarif d'une personne** : `SessionPayment.tariffId` s'il est choisi, sinon le tarif par défaut de son rôle dans la session, par ordre PJ, PNJ, orga, cuisine. Est PJ une personne castée sur un PJ ou inscrite sans personnage ; est PNJ une personne castée sur un PNJ ou de rôle PNJ. Sans tarif, la personne n'a rien à payer.
- **`SessionPaymentInstalment`** (paiement, montant, date de réception) : chaque versement reçu. Le reçu est leur somme.
- **Deux modes**, selon que la session a des tarifs :
  - **mode simple**, sans tarif : le tableau et la case « payé » (`SessionPayment.paidAt`) restent ceux d'aujourd'hui ;
  - **mode tarifs** : tout le monde de la session est dans le tableau, et l'état est calculé à la lecture (comme les échéances, [ADR-0020](ADR-0020-echeances-evaluees-a-la-lecture.md)) : payé quand le reçu atteint le dû, partiel entre zéro et le dû, non payé à zéro, rien à payer quand le dû est nul. Un `paidAt` coché en mode simple, sans versement, compte comme payé : passer aux tarifs ne fait pas perdre un paiement déjà validé.
- **Solidarité** : un soutien apporte (montant − base) par personne, une place réduite coûte (base − montant). Le tableau calcule l'apport sur les tarifs attribués et sur l'argent encaissé (la part d'un versement au-delà de la base), le coût des réductions, et les deux soldes.
- **« A payé quelque chose »**, utilisé par les remboursements et la suppression d'une session : `paidAt` renseigné ou au moins un versement.
- **Report du paiement sur la nouvelle session** : il recopie `paidAt` comme aujourd'hui et, s'il y a des versements, un versement du total reçu, à la date du premier.

## Conséquences

- Supprimer un tarif remet ses personnes au tarif de leur rôle ; supprimer un tarif de base retire le lien des tarifs solidaires qui s'y rattachaient.
- Les montants et versements sont des données personnelles du participant : export et effacement RGPD les couvrent (`participantPrivacy.ts`).
- Aucun calcul n'est stocké : changer un tarif change aussitôt l'état de toutes les personnes concernées.

## Options écartées

- **Un seul champ « montant reçu »** : écarté par l'utilisatrice, qui veut l'historique des versements.
- **Marquer « payé » à la main en mode tarifs** : écarté, l'état est calculé.
- **Un tarif unique avec ajustement par personne** : écarté au profit des tarifs nommés.
