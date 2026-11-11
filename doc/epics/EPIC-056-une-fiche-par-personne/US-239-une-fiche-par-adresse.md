---
id: US-239
titre: Une fiche par adresse dans tout Limbus
statut: à faire
epic: EPIC-056
regles: [R4, R5, R7]
adr: [ADR-0086]
---

# US-239 : Une fiche par adresse dans tout Limbus

En tant qu'organisatrice, je veux qu'une personne n'ait qu'une fiche, même suivie par d'autres équipes, sans rien voir de ces équipes, afin qu'elle soit la même personne partout.

## Critères d'acceptation

- [ ] Étant donné une fiche de Paul dans les jeux de Bob, quand Alice crée une fiche avec l'adresse de Paul (sans tenir compte des majuscules), alors aucune fiche n'est créée : les jeux et notes d'Alice s'ajoutent à la fiche, avec le nom et le téléphone saisis par Alice pour ses jeux ; le message est celui d'une création.
- [ ] Étant donné la fiche de Paul déjà dans les jeux d'Alice, alors le message dit que ses jeux ont été ajoutés à la fiche existante, comme aujourd'hui.
- [ ] Étant donné la fiche commune, alors Alice ne voit que ses jeux, notes, casts, inscriptions, envois et paiements, et ses valeurs de nom et de téléphone ; Bob de même.
- [ ] Étant donné une fiche dont je corrige l'adresse, alors seuls les jeux que je vois, avec leurs notes, valeurs, inscriptions, casts et envois, passent à la fiche de la nouvelle adresse (créée si besoin) ; les autres jeux gardent l'ancienne ; aucun compte ne change d'adresse.
- [ ] Une inscription (lien personnel, formulaire public, vivier) rejoint la fiche de son adresse dans tout Limbus.
- [ ] Tant que des doublons existent (avant [US-240](US-240-fusion-des-fiches.md)), la fiche rejointe est la plus ancienne de l'adresse.
- [ ] Étant donné les jeux de test, alors une personne est suivie par deux propriétaires, chacune avec son nom ; `doc/jeux-de-test.md` le dit.

## Notes techniques

Remplace `ficheForAddress`, limitée à la propriétaire, et `duplicateAddressError` (US-185) ([ADR-0086](../../adr/ADR-0086-fiche-unique-et-valeurs-par-jeu.md)). Rapprochement des inscriptions (`participantEmailMatchWhere`, `formRegistrations`, `publicRegistrations`). L'index unique sur l'adresse arrive avec la fusion ([US-240](US-240-fusion-des-fiches.md)). Jeux de test : `prisma/seed/` et `doc/jeux-de-test.md` (CLAUDE.md, ADR-0066).

## Tests

- Actions : création rejointe (deux équipes), correction d'adresse qui ne déplace que les jeux visibles.
- Erreurs de saisie : adresse invalide refusée, rien d'enregistré.
- Droits : Alice ne voit rien de Bob sur la fiche commune (liste, fiche, export, assistants) ; co-organisatrice d'un seul jeu ; `isolation.test.ts`.
- Hors ligne : création mise en file qui rejoint la fiche au retour du réseau.
