---
id: US-047
titre: Une session consultée reste disponible hors ligne
statut: terminée
epic: EPIC-010
regles: [R1]
adr: [ADR-0012]
---

# US-047 : Une session consultée reste disponible hors ligne

En tant qu'organisatrice sur le lieu du GN, je veux rouvrir sans réseau une session que j'ai consultée avec le réseau, avec ses fiches de personnages, ses trombinoscopes et sa fiche allergies.

## Critères d'acceptation

- [x] Une session ouverte avec le réseau est gardée sur l'appareil, telle qu'elle a été vue : détails, équipe, casting, déroulé, envois, paiements, présence, fiche allergies.
- [x] Sans réseau, la page de cette session s'ouvre depuis l'appareil. Une session jamais ouverte avec le réseau affiche « Cette session n'a pas été consultée avec le réseau sur cet appareil ».
- [x] La fiche d'un personnage consultée avec le réseau s'ouvre aussi sans réseau.
- [x] Les PDF consultés avec le réseau (trombinoscopes, fiches de personnage, fiche allergies) se rouvrent sans réseau.
- [x] La déconnexion efface tout cela, comme le reste du cache de l'appareil.

## Notes techniques

- Cache des réponses : `useApiFetch(url, { offlineCache: true })` garde la réponse d'une lecture dans le magasin `responses` (clé : l'URL) et la rend hors ligne.
- Pages rendues côté serveur (fiche d'un personnage) : `useOfflineFetch`, qui garde aussi la réponse reçue à l'hydratation.
- PDF : cache `session-documents` du service worker (NetworkFirst), effacé par `clearOfflineData`.

## Tests

- Unitaires : cache des réponses (lecture en ligne gardée, rendue hors ligne, erreur sans cache).
