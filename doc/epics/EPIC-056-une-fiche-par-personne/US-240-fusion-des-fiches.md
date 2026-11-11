---
id: US-240
titre: Fusionner les fiches d'une même adresse
statut: à faire
epic: EPIC-056
regles: [R8]
adr: [ADR-0086]
---

# US-240 : Fusionner les fiches d'une même adresse

En tant qu'organisatrice, je veux que les fiches existantes d'une même personne soient réunies sans rien perdre, afin que la règle d'une fiche par adresse vaille aussi pour l'existant.

## Critères d'acceptation

- [ ] Étant donné deux fiches de même adresse (sans tenir compte des majuscules), quand la migration passe, alors il n'en reste qu'une, qui porte tous les jeux, notes, valeurs de nom et de téléphone, casts, inscriptions, présences, envois, paiements, trombinoscopes et responsabilités de déroulé des deux.
- [ ] La fiche gardée est la plus ancienne, avec son adresse de page ; celles des autres ne répondent plus.
- [ ] Elle refuse la photo si l'une des fiches la refusait ; elle reste rattachée au compte de l'adresse s'il y en a un.
- [ ] Deux fiches dans un même jeu (doublon antérieur à US-185) : leurs lignes de cast et d'inscription sont réunies sans doublon, et la note du jeu garde les deux textes.
- [ ] Après la migration, la base refuse une deuxième fiche à la même adresse.

## Notes techniques

Migration SQL ([ADR-0086](../../adr/ADR-0086-fiche-unique-et-valeurs-par-jeu.md)), après le déploiement d'[US-239](US-239-une-fiche-par-adresse.md) ; jeux de test (`prisma/seed/`, `doc/jeux-de-test.md`) mis à jour. Les fiches sans adresse ne sont pas concernées.

## Tests

- Actions, erreurs de saisie, hors ligne : migration sans écran ; un test d'intégration prépare des doublons (deux propriétaires, même jeu, casse différente) et vérifie la fiche fusionnée.
- Droits : après fusion, chaque équipe ne voit que ses jeux (`isolation.test.ts`).
