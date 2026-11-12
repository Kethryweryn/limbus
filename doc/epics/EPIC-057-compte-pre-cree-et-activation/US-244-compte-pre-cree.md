---
id: US-244
titre: Un compte pré-créé pour chaque fiche
statut: à faire
epic: EPIC-057
regles: [R1, R2, R16]
adr: [ADR-0088]
---

# US-244 : Un compte pré-créé pour chaque fiche

En tant qu'organisatrice, je veux que la fiche que je crée appartienne au compte de son adresse, même si la personne ne s'est jamais inscrite, afin qu'elle puisse un jour retrouver ses sessions sans que je fasse rien de plus.

## Critères d'acceptation

- [ ] Étant donné une adresse sans compte, quand je crée une fiche à cette adresse depuis l'interface ou un assistant d'IA, alors :
  - un compte non activé existe à cette adresse ;
  - la fiche lui est rattachée ;
  - aucun email ne part.
- [ ] Étant donné une fiche, quand je lui donne une adresse sans compte, alors il se passe la même chose.
- [ ] Étant donné une fiche créée par une inscription (lien personnel, formulaire public confirmé), alors il se passe la même chose.
- [ ] Étant donné les fiches existantes qui ont une adresse, après la migration, alors chacune est rattachée au compte de son adresse, créé non activé s'il n'existait pas.
- [ ] Étant donné un compte non activé, quand on essaie de s'y connecter, alors la réponse est la même que pour un mauvais mot de passe.
- [ ] Étant donné une fiche rattachée à un compte non activé, alors :
  - l'équipe modifie le nom et le téléphone comme avant ;
  - la page de la fiche ne dit pas qu'elle est tenue par la personne.
- [ ] Étant donné une inscription libre non confirmée à une adresse qui a une fiche, quand son délai passe, alors le compte perd son nom, son mot de passe et ses conditions acceptées mais reste rattaché à la fiche. Sans fiche, il est effacé comme avant.
- [ ] La politique de confidentialité dit qu'une équipe qui inscrit une personne lui crée un compte inactif, sans email, ce que ce compte contient et quand il est effacé. `TERMS_VERSION` change, et chaque compte l'accepte de nouveau.
- [ ] Étant donné un compte non activé, alors il ne peut pas se connecter, et n'a donc accès ni à l'espace « Je participe » ni à l'export ou à l'effacement du compte.

## Notes techniques

- **Schéma** (`prisma/schema.prisma`) : `User.password` devient facultatif. Une migration `DROP NOT NULL`, puis une migration de données qui crée les comptes et rattache les fiches.
- **Rattachement** (`server/utils/participantAccounts.ts`) : `accountForEmail` remplace `accountIdForEmail`. Il s'exécute dans la transaction et sous le verrou de l'adresse.
- **Appelants à adapter** : `participantWrites.ts`, `registrations.ts`, `formRegistrations.ts`, `publicRegistrations.ts`, `emailProofs.ts`, `account/index.put.ts`.
- **Connexion** (`login.post.ts`) : comparaison avec une empreinte factice si le compte n'a pas de mot de passe.
- **Nettoyage** : `purgeUnconfirmedAccounts` (`server/utils/accounts.ts`).
- **Écran** (`components/ParticipantForm.vue`) : seule une fiche rattachée à un compte activé est tenue par la personne.
- **Politique** : `pages/confidentialite.vue`, `utils/legal.ts` (`TERMS_VERSION`), note dans `nouveautes/`.
- **Jeu de test** : `prisma/seed/` et `doc/jeux-de-test.md` gagnent une personne au compte non activé.

## Tests

- Actions : création d'une fiche à une adresse nouvelle, puis modification de son nom et de son téléphone (`tests/e2e/participantScreens.spec.ts`).
- Erreurs de saisie : sans objet, aucun champ n'est ajouté. L'email obligatoire est déjà couvert par US-238.
- Droits :
  - connexion refusée sur un compte non activé (`tests/e2e/auth.spec.ts`) ;
  - l'isolation d'une fiche suivie par Alice et Bob reste vérifiée (`isolation.test.ts`), et ni l'une ni l'autre ne voit le compte.
- Hors ligne : une fiche créée hors ligne reçoit son compte quand la création est rejouée.

Intégration :

- compte créé sans email (faux serveur d'emails vide) ;
- migration des fiches existantes ;
- nettoyage d'une inscription non confirmée qui a une fiche ;
- création par `creer_participant`.
