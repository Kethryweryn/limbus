---
id: US-226
titre: Télécharger un jeu pour le consulter sans réseau
statut: terminée
epic: EPIC-052
regles: [R8, R9, R10, R11, R12, R13]
adr: [ADR-0080, ADR-0081]
---

# US-226 : Télécharger un jeu pour le consulter sans réseau

En tant qu'organisatrice, je veux télécharger un jeu d'un clic avant de partir sur le lieu, afin d'en ouvrir toutes les pages sans réseau.

## Critères d'acceptation

- [x] Étant donné un jeu actif dont je suis organisatrice ou co-organisatrice, alors la section a un bouton « Télécharger » pour lui ; un jeu archivé n'en a pas.
- [x] Étant donné le téléchargement lancé, alors l'avancement s'affiche, puis la date du téléchargement à côté du jeu.
- [x] Étant donné le jeu téléchargé et le réseau coupé, alors chaque liste, chaque fiche, la page Inscriptions et chaque inscription, et chaque session avec ses onglets s'ouvrent ; pour une session à venir, ses PDF et les photos du cast aussi.
- [x] Étant donné le jeu téléchargé et le réseau coupé, alors la fiche d'un participant montre son contact d'urgence et ses allergies ; la section l'a dit à côté du bouton.
- [x] Étant donné une session passée, alors ses PDF ne sont pas téléchargés.
- [x] Étant donné un jeu aux nombreuses photos (plus de 300), alors toutes celles des sessions à venir sont gardées.
- [x] Étant donné la page de confidentialité, alors elle dit qu'un jeu téléchargé garde sur l'appareil le contact d'urgence et les allergies des participants (ADR-0080).
- [x] Étant donné un élément modifié sans réseau et pas encore envoyé, alors le téléchargement garde sa copie « en attente ».
- [x] Étant donné le réseau qui tombe pendant le téléchargement, alors il s'arrête et le dit ; un nouveau clic reprend.
- [x] Étant donné pas de réseau, alors le bouton est indisponible, avec la raison.

## Notes techniques

- Plan des lectures : `utils/offlinePlan.ts`, que lisent aussi les pages des fiches, des sessions et des inscriptions ; téléchargement : `utils/offlineDownload.ts`, registre `offlineDownloads` (base de l'appareil en version 14).
- Fichiers des sessions à venir dans le cache `offline-downloads`, sans limite ; le service worker s'y replie quand le réseau manque (greffon `cachedResponseWillBeUsed`, `nuxt.config.ts`).
- Contact d'urgence et allergies : la fiche participant les lit sur l'appareil quand le serveur ne répond pas, s'ils y ont été téléchargés.
- Politique de confidentialité complétée : nouvelle version à accepter (`TERMS_VERSION` 2026-11-10, ADR-0055).

## Tests

De bout en bout (`tests/e2e/offlineDownload.spec.ts`), sur les quatre axes (ADR-0079) :

- Actions : « le jeu téléchargé s’ouvre sans réseau : fiches, contact d’urgence, session et ses PDF ».
- Erreurs de saisie : aucune saisie ; le réseau qui tombe en cours est couvert par « sans réseau, le bouton est indisponible ; un réseau qui tombe arrête le téléchargement et le dit ».
- Droits : « une co-organisatrice télécharge le jeu partagé ; une organisatrice sans accès et un jeu archivé n’ont pas de bouton » ; « désactivé sur l’appareil, le téléchargement est indisponible et le dit ».
- Hors ligne : les deux premiers tests ; « une modification en attente garde sa copie pendant le téléchargement ».

Unitaires : `tests/utils/offlinePlan.test.ts` (plan, fichiers relevés, sessions à venir).
