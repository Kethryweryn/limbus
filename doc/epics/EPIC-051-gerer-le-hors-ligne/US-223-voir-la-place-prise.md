---
id: US-223
titre: Voir la place que prennent les données hors ligne de mon appareil
statut: terminée
epic: EPIC-051
regles: [R1, R2]
adr: []
---

# US-223 : Voir la place que prennent les données hors ligne de mon appareil

En tant que personne connectée, je veux voir dans mon compte la place que prennent les données gardées sur cet appareil, afin de savoir ce que Limbus garde.

## Critères d'acceptation

- [x] Étant donné une personne connectée, quand elle ouvre « Mon compte », alors une section « Hors ligne sur cet appareil » s'affiche, qu'elle organise ou participe.
- [x] Étant donné des pages, PDF et photos gardés, alors la section affiche leur place, et en plus petit la place totale réservée à Limbus par le navigateur.
- [x] Étant donné un navigateur qui ne donne pas ces mesures, alors la section le dit au lieu d'un chiffre.

## Notes techniques

Section dans `pages/compte.vue` (composant à part) ; mesure dans `utils/storage.ts` : taille sérialisée des enregistrements de la base, en-tête `Content-Length` des réponses des caches de fichiers, sans lire leur contenu, `navigator.storage.estimate()` (ADR-0081).

## Tests

De bout en bout (`tests/e2e/offlineDevice.spec.ts`), sur les quatre axes (ADR-0079) :

- Actions : « la place des données s’affiche, et l’effacement la vide sans déconnecter ».
- Erreurs de saisie : aucune saisie dans cette US.
- Droits : « une participante a aussi la section, pour son appareil ».
- Hors ligne : la section s'ouvre sans réseau (« sans réseau, seul l’abandon est proposé… »).

Unitaires : `tests/utils/offlineDevice.test.ts` (tailles lues dans le JSON et dans l'en-tête `Content-Length`).
