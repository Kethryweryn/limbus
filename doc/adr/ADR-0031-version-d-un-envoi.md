---
id: ADR-0031
titre: Un envoi garde l'empreinte de la version envoyée
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-006-emails-et-paiements.md, ../archive/epics/EPIC-006-ecarts-envois-et-paiements/US-030-renvoyer-la-version-a-jour.md]
---

# ADR-0031 : Un envoi garde l'empreinte de la version envoyée

## Contexte

Le renvoi groupé ne doit partir qu'aux personnes dont la version reçue d'un document, d'une fiche ou d'un trombinoscope est plus ancienne que l'actuelle ([SPEC-006](../specs/SPEC-006-emails-et-paiements.md), écart 1). Un envoi (`SessionDocumentDelivery`) ne garde aujourd'hui que sa date. Comparer cette date à la date de modification du document ou du personnage déclarerait une fiche changée pour toute modification du personnage, même sans effet sur la fiche (un réglage de trombinoscope, un tag).

## Décision

- Un envoi enregistre `contentHash`, l'empreinte SHA-256 de ce qui est parti :
  - pour un document : titre, contenu, lien externe, nom de la session et titre du jeu, soit ce que contiennent l'email et le PDF ;
  - pour une fiche : nom, pitch, histoire, lien externe et indications de costume du personnage, et nom de la session ;
  - pour un trombinoscope : l'empreinte du trombinoscope généré ([ADR-0030](ADR-0030-empreinte-d-un-trombinoscope.md)).
- La version reçue est dépassée quand l'empreinte actuelle diffère de celle de l'envoi.
- Un envoi antérieur à cette décision, sans empreinte, est dépassé quand le document ou le personnage a été modifié après l'envoi, ou le trombinoscope généré après l'envoi.
- Un renvoi met à jour la date et l'empreinte de l'envoi existant : on garde le dernier envoi, pas l'historique.

## Conséquences

- Une modification sans effet sur ce qui est envoyé ne déclenche pas de renvoi.
- Un trombinoscope périmé doit être généré à nouveau avant d'être renvoyé ([US-028](../archive/epics/EPIC-005-ecarts-trombinoscopes/US-028-trombinoscopes-perimes.md)).
- Pour les anciens envois, le repli sur les dates peut proposer un renvoi de trop, jamais en oublier un.

## Options écartées

- **Comparer les dates seulement** : trop de faux positifs pour les fiches.
- **Garder chaque envoi** : un historique complet n'est pas demandé, et le tableau ne montre que le dernier.
