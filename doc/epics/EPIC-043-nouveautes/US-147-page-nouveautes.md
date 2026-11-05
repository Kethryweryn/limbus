---
id: US-147
titre: Lire les nouveautés de Limbus
statut: terminée
epic: EPIC-043
regles: [R1, R2, R3, R4, R5, R6, R9, R10]
adr: [ADR-0065]
---

# US-147 : Lire les nouveautés de Limbus

En tant que personne qui utilise Limbus, avec ou sans compte, je veux lire ce qui a changé, afin de savoir ce qui est disponible aujourd'hui.

## Critères d'acceptation

- [x] Étant donné une personne sans compte, quand elle ouvre `/nouveautes`, alors elle lit les notes sans se connecter.
- [x] Étant donné plusieurs notes, quand la page s'affiche, alors la plus récente vient d'abord, y compris le même jour, chacune avec sa date, son type, son titre et son texte.
- [x] Étant donné une note fusionnée, quand un build lit l'historique, alors sa date est le jour de la fusion, à l'heure de Paris.
- [x] Étant donné une note au contenu invalide, quand les tests ou le build la lisent, alors ils échouent en nommant le fichier.
- [x] Étant donné un build de la CI ou de `deploy.sh` sans historique complet, alors il échoue plutôt que de donner de fausses dates.
- [x] La page démarre avec une seule note, et rien ne signale une note non lue.
- [x] Une pull request visible ajoute sa note : la règle est dans `CLAUDE.md`.

## Notes techniques

`nouveautes/*.json` ; module `modules/releaseNotes/` (lecture, dates git, gabarit `#build/release-notes.json`) ; `pages/nouveautes.vue` ; `app.vue` (page ouverte sans compte) ; `.github/workflows/ci.yml` et `deploy.sh` (`NOUVEAUTES_DEPOT`).

## Tests

`tests/modules/releaseNotes.test.ts` (notes du dépôt, schéma, tri, dates sur un vrai dépôt git, historique absent ou tronqué), `tests/e2e/nouveautes.spec.ts`.
