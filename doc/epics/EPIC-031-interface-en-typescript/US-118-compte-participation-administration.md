---
id: US-118
titre: Compte, « Je participe », administration, page publique ; règle étendue à tout
statut: à faire
epic: EPIC-031
regles: []
adr: [ADR-0057]
---

# US-118 : Compte, « Je participe », administration, page publique ; règle étendue à tout

En tant que développeuse, je veux que toute l'interface soit vérifiée, et qu'un nouveau fichier ne puisse pas échapper à la vérification.

## Critères d'acceptation

- [ ] Les pages restantes sont en TypeScript strict.
- [ ] La règle de lint couvre tous les `.vue` : un composant sans `lang="ts"` fait échouer la CI.
