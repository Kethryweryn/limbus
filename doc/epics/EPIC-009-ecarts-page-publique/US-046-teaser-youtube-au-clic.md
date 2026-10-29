---
id: US-046
titre: Teaser YouTube chargé seulement au clic
statut: terminée
epic: EPIC-009
regles: [R1, R9]
adr: []
---

# US-046 : Teaser YouTube chargé seulement au clic

En tant que visiteuse de la page publique, je veux que YouTube ne dépose rien chez moi tant que je n'ai pas choisi de regarder la vidéo.

## Critères d'acceptation

- [x] Un teaser YouTube s'affiche d'abord en vignette, avec un bouton « Lire la vidéo (YouTube) » ; rien n'est chargé depuis YouTube avant le clic.
- [x] La vignette est servie par Limbus, qui la récupère lui-même depuis YouTube ; sans vignette disponible, un fond neutre la remplace.
- [x] Au clic, le lecteur YouTube se charge et lit la vidéo.
- [x] La même règle vaut sur la fiche du jeu dans l'application.

## Notes techniques

- Route publique `GET /api/public/games/:slug/teaser-thumbnail` : seulement pour un jeu publié dont le teaser est une vidéo YouTube ; l'image passe par `fetchPublicImage` (hôte public, délai et taille bornés), avec un cache d'un jour.
- `youtubeVideoId` dans `utils/urls.ts`, partagé par l'intégration et la vignette.

## Tests

- Unitaires (`tests/utils/urls.test.ts`) : identifiant de vidéo.
- Bout en bout (`publicPage.spec.ts`) : pas d'iframe avant le clic, lecteur après.
