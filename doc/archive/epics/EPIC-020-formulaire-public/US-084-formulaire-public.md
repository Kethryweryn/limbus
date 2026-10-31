---
id: US-084
titre: S'inscrire par le lien de diffusion
statut: terminée
epic: EPIC-020
regles: [R6, R8, R10, R12, R30, R32]
adr: [ADR-0045, ADR-0046]
---

# US-084 : S'inscrire par le lien de diffusion

En tant que personne qui a vu une annonce, je veux m'inscrire au jeu par le lien partagé, sans compte, afin de candidater à une place.

## Critères d'acceptation

- [x] Le lien de diffusion (`/i/…`) ouvre le formulaire du jeu, même sans page publique : note d'intention, sessions concernées et leurs dates, champs, affinités et questions.
- [x] Dans une période à plusieurs sessions, la personne coche celles où elle est disponible, au moins une. L'inscription permanente ne demande pas de disponibilités et liste pour information les sessions à venir.
- [x] Une période clôturée affiche « inscriptions closes » ; une période en brouillon répond comme un lien inconnu.
- [x] L'aperçu sur les réseaux sociaux donne le nom du jeu, les sessions et leurs dates, le début de la note d'intention et la vignette du teaser s'il y en a une.
- [x] La réponse est la même que l'adresse soit déjà inscrite ou non ; limite de débit par IP et champ piège.
- [x] Une personne connectée trouve le formulaire prérempli par son compte, et son inscription est reçue aussitôt, sans email de confirmation.

## Notes techniques

- `GET` et `POST /api/public/periods/:publicId` ; page `pages/i/[publicId].vue` rendue côté serveur.

## Tests

- Intégration : demande créée sans fiche ni inscription, même réponse pour une adresse inscrite, champ piège, période close ou en brouillon, disponibilités, personne connectée.
- Bout en bout : une personne s'inscrit par le lien et confirme son email.
