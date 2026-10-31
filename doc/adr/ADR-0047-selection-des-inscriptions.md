---
id: ADR-0047
titre: Sélection des inscriptions : décisions préparées puis annoncées, liste d'attente par session, vivier calculé
statut: accepté
date: 2026-10-31
liens: [../specs/SPEC-001-inscriptions.md, ADR-0018-jetons-des-liens-personnels.md, ADR-0019-modele-des-inscriptions.md, ADR-0020-echeances-evaluees-a-la-lecture.md, ADR-0046-formulaire-public-des-inscriptions.md]
---

# ADR-0047 : Sélection des inscriptions : décisions préparées puis annoncées, liste d'attente par session, vivier calculé

## Contexte

[SPEC-001](../specs/SPEC-001-inscriptions.md), lot 3, première moitié (R5, R7, R16, R19 à R21, R30, R31) : l'équipe trie les inscriptions reçues par le formulaire (retenue, en attente, non retenue), la personne retenue confirme sa place, et une place libérée propose la suivante de la liste d'attente. Le tirage au sort (R4, R17, R18) vient ensuite, dans son propre epic.

Choix de l'utilisatrice : l'équipe trie d'abord, puis « Annonce les résultats » ; la session est choisie en retenant ; la liste d'attente est propre à chaque session, et une personne peut attendre dans plusieurs ; l'email d'attente ne donne pas de rang ; une personne retenue confirme d'un bouton ; on ne dépasse pas les places ; dans le vivier, seules les personnes retenues ou mises en attente sont prévenues, et une personne qui a joué y revient.

## Décision

- **Statuts.** `retained` (retenue), `waitlisted` (en attente), `rejected` (non retenue) s'ajoutent à `received`, `confirmed` et `withdrawn`. Une inscription retenue porte sa session (`Registration.sessionId`) ; une non retenue n'en a pas.
- **Liste d'attente** : `RegistrationWaitlistEntry` (inscription, session, position), unique par couple. Une inscription est `waitlisted` tant qu'elle a au moins une entrée ; la retenir dans une session supprime toutes ses entrées ; retirer sa dernière entrée la remet à `received`. Les orgas réordonnent la file d'une session.
- **Places** : celles de la période (`RegistrationPeriodSession.seats`), ou pour une session de l'inscription permanente `Session.poolSeats` (vide : le nombre de personnages PJ, R5). Retenir au-delà des places est refusé : sont comptées les inscriptions retenues ou confirmées de la session, toutes périodes confondues.
- **Annonce.** Une décision ne prévient personne. `Registration.announcedStatus` et `announcedSessionId` gardent ce qui a été annoncé ; une inscription retenue, en attente ou non retenue dont l'état diffère de l'annonce est « à annoncer ». « Annoncer les résultats » envoie à chacune son email, avec un nouveau lien personnel (l'ancien cesse de marcher, comme un renvoi : le jeton n'est gardé que haché, ADR-0018), et fixe l'échéance d'une personne retenue à la date d'annonce plus le délai de la période. Une décision prise après l'annonce (place libérée, changement d'avis) attend l'annonce suivante : l'équipe valide toujours avant l'email (R21). Tant qu'une décision n'est pas annoncée, la personne voit l'état annoncé (ou « reçue »).
- **Confirmation** : une personne retenue, annoncée dans cette session, confirme d'un bouton, par son lien ou son compte, même après l'échéance tant que la place n'est pas libérée (R20). La confirmation crée le `SessionParticipant`, comme l'acceptation d'une invitation (R22). Relance, prolongation et libération s'appliquent à une personne retenue comme à une invitée ; « délai dépassé » se lit sur l'échéance (ADR-0020). Libérée, elle passe à `withdrawn`, et la file de la session propose sa première personne.
- **Rejoueurs** : `RegistrationPeriod.replayPolicy` (`allowed`, `flagged`, `excluded`). A déjà joué : participant d'une session terminée du jeu. En sélection à la main, `flagged` et `excluded` signalent la personne ; `excluded` l'écarte du tirage (epic suivant) et du vivier.
- **Vivier de l'inscription permanente** : une inscription par personne, comme ailleurs. Les sessions proposées sont les sessions à venir du jeu sans période dédiée. Une inscription dont la session est terminée ou annulée est de nouveau dans le vivier, calculé à la lecture, sauf si `excluded` et qu'elle a joué ; la retenir à nouveau change sa session. Une personne du vivier ne joue qu'une session à la fois. Les personnes non retenues pour une session restent `received`, sans email : il n'y a pas de « non retenue » dans le vivier.
- **R31** : rattacher une session à une période dédiée est refusé si des inscriptions de l'inscription permanente y sont retenues, confirmées ou en attente.

## Conséquences

- L'inscription d'une personne du vivier ne garde que sa dernière session ; ses sessions passées restent connues par son `SessionParticipant`.
- Chaque annonce renouvelle le lien personnel des personnes concernées : un ancien email ne marche plus, le dernier si.

## Options écartées

- **Envoyer l'email à chaque décision** : écarté par l'utilisatrice, l'équipe veut pouvoir changer d'avis avant de prévenir.
- **Une inscription par session jouée dans le vivier** : garderait l'historique sur l'inscription, mais il faudrait copier réponses et affinités à chaque session et lever l'unicité d'une inscription par personne et par période.
- **Retenir pour la période, et placer dans une session plus tard** : écarté par l'utilisatrice ; les places se comptent par session.
- **Mettre le rang dans l'email d'attente** : écarté, le rang bouge quand l'équipe réordonne.
