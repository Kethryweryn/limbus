---
id: US-232
titre: Rechercher et filtrer dans le vivier
statut: à faire
epic: EPIC-054
regles: [R12]
adr: []
---

# US-232 : Rechercher et filtrer dans le vivier

En tant qu'organisatrice, je veux rechercher une personne du vivier par son nom et filtrer par vœu de session, afin de la retrouver vite dans un grand vivier.

## Critères d'acceptation

- [ ] Étant donné un vivier, quand je tape un nom ou un email, en minuscules ou sans accents, alors seules les personnes et invitations qui correspondent restent, avec « n sur N » (R12).
- [ ] Étant donné le filtre « Vœu de session », quand je choisis une session, alors seules les personnes qui l'ont demandée restent ; il se combine avec la recherche (R12).
- [ ] Étant donné une recherche sans résultat, alors la liste le dit et propose d'effacer la recherche (R12).

## Notes techniques

- Filtre côté navigateur, sur la liste déjà lue ; rien dans l'adresse.

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : recherche par nom, par email, sans accents ; filtre par vœu ; les deux ensemble ; effacer.
- Erreurs de saisie : une recherche sans résultat donne son message.
- Droits : ceux de la page (US-230), inchangés ; non rejoués ici.
- Hors ligne : recherche et filtre sans réseau, sur le vivier relu.
