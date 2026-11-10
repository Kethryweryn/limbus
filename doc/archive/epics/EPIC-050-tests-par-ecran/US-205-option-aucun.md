---
id: US-205
titre: Choisir « Aucun » dans une liste de choix
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-205 : Choisir « Aucun » dans une liste de choix

En tant qu'organisatrice, je veux pouvoir choisir « Aucun personnage », « Aucun lieu », « À décider » ou « Aucun rôle » dans une liste de choix, afin de retirer un choix fait (défaut trouvé en écrivant les tests de l'US-198).

## Critères d'acceptation

- [x] Étant donné une liste de choix qui propose « Aucun… », alors cette option s'affiche et se choisit, et elle enregistre l'absence de choix.
- [x] Les listes concernées : emplacement d'un objet, lieu et équipe d'une session, lieu d'un report, participant d'un rôle au casting, attribut d'équilibre d'un personnage, tarif d'une personne, rôle et tarif de base d'un tarif, décision sur un remboursement ou un paiement d'une personne partie.

## Notes techniques

Reka UI, sous le `USelect` de Nuxt UI, lève une erreur au rendu d'une option de valeur vide : l'option ne s'affichait pas, et la console le signalait. `utils/selectOptions.ts` donne à « Aucun » une valeur réservée (`NONE_VALUE`), que `selectModel`, `toSelectValue` et `fromSelectValue` traduisent en chaîne vide dans les données ; `emptyStringModel` passe par lui. Le choix du remplaçant d'un transfert n'a plus d'option vide : son champ vide affiche déjà « Remplaçant… ».

## Tests

`tests/utils/selectOptions.test.ts`. De bout en bout : `tests/e2e/writingSheets.spec.ts` (emplacement d'un objet).
