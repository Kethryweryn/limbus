---
id: US-240
titre: Fusionner les fiches d'une même adresse
statut: terminée
epic: EPIC-056
regles: [R8]
adr: [ADR-0086]
---

# US-240 : Fusionner les fiches d'une même adresse

En tant qu'organisatrice, je veux que les fiches existantes d'une même personne soient réunies sans rien perdre, afin que la règle d'une fiche par adresse vaille aussi pour l'existant.

## Critères d'acceptation

- [x] Étant donné deux fiches de même adresse (sans tenir compte des majuscules), quand la migration passe, alors il n'en reste qu'une, qui porte tous les jeux, notes, valeurs de nom et de téléphone, casts, inscriptions, présences, envois, paiements, trombinoscopes et responsabilités de déroulé des deux.
- [x] La fiche gardée est la plus ancienne, avec son adresse de page ; celles des autres ne répondent plus.
- [x] Elle refuse la photo si l'une des fiches la refusait ; elle reste rattachée au compte de l'adresse s'il y en a un.
- [x] Deux fiches dans un même jeu (doublon antérieur à US-185) : leurs lignes de cast et d'inscription sont réunies sans doublon, et la note du jeu garde les deux textes.
- [x] Après la migration, la base refuse une deuxième fiche à la même adresse.

## Notes techniques

Migration SQL ([ADR-0086](../../adr/ADR-0086-fiche-unique-et-valeurs-par-jeu.md)), après le déploiement d'[US-239](US-239-une-fiche-par-adresse.md) ; jeux de test (`prisma/seed/`, `doc/jeux-de-test.md`) mis à jour. Les fiches sans adresse ne sont pas concernées.

## Tests

- Actions, erreurs de saisie, hors ligne : migration sans écran. `tests/integration/participantMerge.test.ts` rejoue la fusion (`limbus_merge_duplicate_participants`) sur des doublons préparés, dans une transaction qui retire puis rétablit l'index : deux propriétaires, même jeu (cast, inscription, notes), casse différente, et l'index qui refuse ensuite un doublon, sans compter les fiches sans adresse.
- Droits : après fusion, chaque équipe ne voit que ses jeux (`isolation.test.ts`, `participants.test.ts`).

## Avancement

- Migration `20261203090000_fusion_des_fiches` : la fonction `limbus_merge_duplicate_participants` s'appuie sur `limbus_move_participant` (US-239), puis l'index unique `Participant_email_key` ; `email` est `@unique` dans le schéma.
- Une réponse par le lien personnel qui donne l'adresse d'une autre fiche ne change plus l'adresse de la fiche ni celle de l'inscription (la base la refuserait) : la preuve de cette adresse, puis la fusion, viennent avec [US-243](US-243-prouver-une-autre-adresse.md). Une adresse ainsi gardée ne compte pas comme une réponse modifiée.
- Le refus d'inviter « deux fiches avec la même adresse » disparaît : elles n'existent plus. Les tests qui préparaient une fiche par équipe pour une même personne la lient maintenant au jeu de chaque équipe.
