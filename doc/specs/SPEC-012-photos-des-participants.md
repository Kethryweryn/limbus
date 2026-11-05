---
id: SPEC-012
titre: Photos des participants, information, durée de conservation et retrait
statut: implémentée
date: 2026-11-01
origine: ../archive/todo/photos-et-rgpd.md
epics: [EPIC-028]
adr: [ADR-0054]
---

# SPEC-012 : Photos des participants, information, durée de conservation et retrait

## Objectif

Corriger les écarts R-08 et R-09 de la [revue d'architecture](../revues/2026-10-29-architecture.md). Une photo où l'on reconnaît une personne est une donnée personnelle. Il faut donc :

- informer les personnes de l'usage de leur photo ;
- ne la garder que le temps nécessaire ;
- la retirer sur demande.

## Contexte juridique

Pour la CNIL, l'image d'une personne identifiable est une donnée personnelle, et le consentement est au cœur du droit à l'image. Aucune source consultée ne traite le cas d'un trombinoscope de GN. Choix de l'utilisatrice : une **information** des personnes, sans accord préalable, avec un droit de retrait simple et bloquant. Ce point peut être revu après l'avis d'un juriste.

## Règles

- **P1 Information.** Le texte d'information dit :
  - l'usage de la photo : le trombinoscope de la session, remis à l'équipe et envoyé aux joueurs de la session ;
  - la durée de conservation du jeu ;
  - comment demander le retrait : depuis son compte, ou en écrivant à l'adresse de contact du jeu.

  Il figure :
  - dans le formulaire d'inscription (lien de diffusion et lien personnel) ;
  - dans l'email d'invitation ;
  - dans chaque email qui envoie un trombinoscope ;
  - dans l'espace « Je participe ».

  Une personne ajoutée à la main par l'équipe est informée par l'email du trombinoscope. L'équipe n'a rien à noter.
- **P2 Contact.** Chaque jeu a une adresse de contact, facultative, réglée par l'équipe. À défaut, l'information donne l'adresse de la propriétaire du jeu, sauf sur le lien de diffusion : il est public, et ne montre que l'adresse de contact. Sans elle, il renvoie au compte seul.
- **P3 Durée.** Chaque jeu règle sa durée de conservation, en mois après la date de la session : 6 par défaut, de 1 à 60.
  - À l'échéance, les photos de la session (lignes du cast) et ses trombinoscopes générés sont supprimés.
  - Une session sans date n'a pas d'échéance.
  - La photo par défaut d'un personnage fait partie du jeu : elle n'a pas d'échéance. Si elle montre une personne, l'équipe la retire sur demande.
- **P4 Retrait par la personne.** Depuis « Je participe », une personne qui a un compte retire ses photos d'un bouton.
  - Ses photos de toutes ses sessions sont supprimées, et les trombinoscopes déjà générés de ces sessions sont refaits.
  - Ses fiches participant passent à « photo refusée ».
  - Elle peut lever ce refus au même endroit.
- **P5 Refus bloquant.** Tant qu'une fiche est à « photo refusée », Limbus refuse d'ajouter une photo de cette personne au cast. Ses trombinoscopes n'utilisent aucune photo d'elle, et l'équipe voit le refus.
  - L'équipe peut poser ou lever le refus sur la fiche, à la demande de la personne : par exemple pour une personne sans compte qui a écrit.
  - Une fiche rattachée à un compte reste tenue par la personne (ADR-0042) : l'équipe peut poser le refus, mais pas le lever.

## Données

- `Game.photoRetentionMonths` (6 par défaut) et `Game.contactEmail` (facultatif). La durée est copiée par le legs, pas le contact.
- `Participant.photoRefusedAt`, couvert par l'export et l'effacement.

## Hors périmètre

- Les copies des envois (ADR-0044), déjà effacées après la session.
- Les photos gardées par le navigateur pour le mode hors ligne : elles expirent seules au bout de 30 jours.
- La durée de conservation des autres données des participants (SPEC-007, écart 3 ; SPEC-011) : elle se fixe avec la politique de confidentialité (étape 5, chantier 4).

## Découpage

Un epic, [EPIC-028](../archive/epics/EPIC-028-photos-des-participants/README.md) : information et contact (US-107), durée et purge (US-108), retrait et refus (US-109).

## Historique

- 2026-11-01 : création à partir de la fiche, avec les choix de l'utilisatrice.
- 2026-11-01 : EPIC-028 terminé et archivé ; ADR-0054 accepté.
