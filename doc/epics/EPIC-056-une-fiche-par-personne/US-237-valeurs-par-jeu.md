---
id: US-237
titre: Le nom et le téléphone saisis par jeu
statut: en cours
epic: EPIC-056
regles: [R6]
adr: [ADR-0086]
---

# US-237 : Le nom et le téléphone saisis par jeu

En tant qu'organisatrice, je veux que le nom et le téléphone que je saisis sur une fiche soient ceux de mes jeux, afin qu'une autre équipe qui suit la même personne ne les voie ni ne les change.

## Critères d'acceptation

- [x] Étant donné une fiche existante, quand la migration passe, alors chacun de ses jeux porte le nom et le téléphone de la fiche ; rien ne change à l'écran.
- [ ] Étant donné une fiche que je modifie, quand j'enregistre un nom ou un téléphone, alors il s'applique à tous les jeux de la fiche que je vois, et à eux seuls.
- [ ] Étant donné une co-organisatrice qui ne voit qu'un des jeux de la fiche, quand elle modifie le nom, alors seul ce jeu change ; la propriétaire voit le nom de son jeu le plus récemment modifié.
- [ ] Étant donné une fiche rattachée à un compte dont la personne a enregistré ses coordonnées, alors le nom et le téléphone du compte restent recopiés sur chaque jeu, comme aujourd'hui (ADR-0042).
- [ ] Étant donné deux co-organisatrices qui modifient le nom en même temps, alors la seconde est refusée (« modifiée entre-temps »), en ligne comme au retour du réseau.
- [ ] Les listes, cast, trombinoscopes, fiche allergies, exports, emails et outils des assistants d'IA lisent le nom et le téléphone du jeu concerné.

## Notes techniques

Colonnes `name`, `phone` et `updatedAt` sur `ParticipantGame` ([ADR-0086](../../adr/ADR-0086-fiche-unique-et-valeurs-par-jeu.md)), remplies par la migration ; les colonnes de `Participant` restent écrites et lues par le build en service jusqu'à [US-242](US-242-retirer-nom-et-telephone-de-la-fiche.md) (ADR-0024). Écriture commune par `server/utils/participantWrites.ts` (interface et assistants), recopie du compte (`syncProfileToParticipants`) sur les liens.

## Tests

- Actions : modifier le nom et le téléphone depuis la fiche, relire dans la liste, le cast et le trombinoscope.
- Erreurs de saisie : inchangées (nom obligatoire), refus sans rien enregistrer.
- Droits : co-organisatrice d'un seul jeu, organisatrice sans accès (404), participante ; `isolation.test.ts` avec une fiche suivie par Alice et Bob.
- Hors ligne : modification mise en file puis envoyée au retour du réseau, relecture sans réseau.

## Avancement

- Étape 1 : colonnes `name`, `phone` et `updatedAt` sur `ParticipantGame`, migration `20261128090000_nom_et_telephone_par_jeu`, écritures sur la fiche et sur chaque lien (création, modification des jeux visibles, recopie du compte, inscriptions, invitations, jeux de test) ; `tests/integration/participants.test.ts`. Les lectures passent aux liens à l'étape 2.
