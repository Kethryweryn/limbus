---
id: US-079
titre: Retrouver ses documents dans « Je participe »
statut: terminée
epic: EPIC-018
regles: [R14]
adr: [ADR-0041, ADR-0044]
---

# US-079 : Retrouver ses documents dans « Je participe »

En tant que personne qui participe, je veux retrouver dans mon espace les documents, la fiche personnage et le trombinoscope reçus pour chaque session, afin de ne pas dépendre de mes emails.

## Critères d'acceptation

- [x] Chaque session de « Je participe » liste ce que la personne a reçu par email, avec la date d'envoi ; rien de ce qui n'est pas parti.
- [x] Un document ou une fiche s'ouvre dans une page qui en montre le texte, avec un bouton qui télécharge le même PDF que la pièce jointe.
- [x] Un trombinoscope s'affiche avec ses photos, ses noms, ses groupes et ses notes, et se télécharge en PDF.
- [x] Une personne n'atteint jamais l'envoi d'une autre fiche que les siennes : 404.
- [x] La liste se consulte hors ligne, comme le reste de l'espace.

## Notes techniques

- `GET /api/me/participations` : `documents` par session (id de l'envoi, sorte, titre, date, copie ou non).
- `GET /api/me/documents/:id`, `/pdf`, `/photos/:index` ; page `pages/participer/documents/[id].vue`.

## Tests

- Intégration : la personne lit sa copie et télécharge son PDF ; l'envoi d'une autre personne répond 404.
- Bout en bout : un document envoyé apparaît dans « Je participe » et s'ouvre.
