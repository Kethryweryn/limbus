---
id: ADR-0019
titre: Modèle des inscriptions, champs standards en colonnes, formulaire versionné
statut: proposé
date: 2026-10-27
liens: [SPEC-001, EPIC-001, ADR-0011]
# Amendé le 2026-10-28, avant acceptation : portée « tout le jeu » (inscription permanente) et lien de diffusion.
---

# ADR-0019 : Modèle des inscriptions, champs standards en colonnes, formulaire versionné

## Contexte

La première version ([EPIC-001](../epics/EPIC-001-inscription-sur-invitation/README.md)) ne gère que les invitations et les champs standards. Les suivantes ajouteront le formulaire public, les questions propres au jeu, les affinités, le tirage et le casting, sur plusieurs sessions. Le modèle doit les accueillir sans refonte. Il doit aussi garder les réponses telles qu'elles ont été données, et rester simple à exporter et à effacer (RGPD).

## Décision

- `RegistrationPeriod` (une période d'inscription) appartient à un jeu. Elle porte :
  - le mode d'entrée (`invitation` | `form`), le mode de sélection (`random` | `chosen` | `mixed`, utilisé à partir de l'epic de sélection) ;
  - l'état, la clôture, le délai de réponse ;
  - les réglages des epics suivants, ajoutés au fur et à mesure.
- `RegistrationPeriod.scope` vaut `sessions` (sessions précises) ou `game` (inscription permanente, R30).
- `RegistrationPeriodSession` relie une période de portée `sessions` à ses sessions, avec le nombre de places ; `sessionId` y est unique (une session n'appartient qu'à une période dédiée).
- La couverture de l'inscription permanente n'est pas stockée : une session est couverte par sa période dédiée si elle en a une, sinon par la période de portée `game` ouverte du jeu. Ce calcul est fait à la lecture, par une seule fonction. Une session créée plus tard est donc couverte sans écriture supplémentaire.
- Au plus une période de portée `game` non clôturée par jeu. La règle est vérifiée dans une transaction à la création et à la réouverture ; PostgreSQL pourra l'imposer par un index unique partiel.
- `RegistrationPeriod.publicId` : identifiant aléatoire court, unique, qui forme le lien de diffusion (`/s/<publicId>`, R32). Il est distinct de l'identifiant interne et du slug du jeu, pour que le lien reste stable si le titre change et qu'il ne permette pas de deviner les autres périodes.
- `RegistrationForm` (un par jeu) et `RegistrationFormVersion` : chaque modification crée une version immuable, dont la définition (réglages des champs standards, puis questions et options) est un JSON validé par un schéma zod.
- `Registration` porte :
  - la période d'inscription, la session attribuée (facultative), le participant, le statut, la source, l'organisateur invitant, la version du formulaire remplie ;
  - les **champs standards en colonnes typées** : prénom, nom, email, nom Facebook, téléphone, contact d'urgence (nom, téléphone), allergies, date du consentement santé, date d'adhésion à la note d'intention ;
  - l'échéance, les dates de réponse, de confirmation et de désistement, le hash du jeton ;
  - une contrainte d'unicité sur (période d'inscription, participant).
- Les réponses aux questions propres au jeu (epics suivants) seront un JSON rattaché à la version du formulaire. Les affinités seront une table à part, parce qu'elles visent d'autres personnes.
- Statuts et modes sont des chaînes, avec des constantes dans `utils/domain.ts`, comme les autres énumérations du projet.
- Clés étrangères : la cascade suit le jeu, la période d'inscription et le participant ([ADR-0009](ADR-0009-suppression-en-cascade.md)) ; la session attribuée passe à `NULL` si la session est supprimée.

## Conséquences

- Les champs standards s'interrogent, se trient et s'exportent directement, et leur effacement est explicite dans `eraseParticipant` ([ADR-0011](ADR-0011-donnees-des-participants.md)).
- Ajouter un champ standard demande une migration ; c'est voulu, puisque ces champs portent des données personnelles qu'on veut voir dans le schéma.
- Les questions propres au jeu restent libres sans migration, au prix d'une validation applicative par version.
- Les informations de contact sont saisies à chaque inscription et ne mettent pas à jour la fiche du participant (R14). Une option « reprendre mes coordonnées » pourra s'ajouter plus tard.

## Options écartées

- **Tout en JSON** : souple, mais les données personnelles seraient invisibles dans le schéma, plus difficiles à exporter et à effacer avec certitude.
- **Table de réponses générique (une ligne par question)** : normalisée, mais lourde pour peu de gain ; les réponses ne sont lues qu'inscription par inscription.
- **Paramètres d'inscription directement sur `Session`** : rendrait impossible le vivier commun à plusieurs sessions.
