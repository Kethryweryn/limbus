---
id: ADR-0045
titre: Questions propres au jeu et affinités dans la définition du formulaire
statut: accepté
date: 2026-10-31
liens: [../specs/SPEC-001-inscriptions.md, ADR-0019-modele-des-inscriptions.md]
---

# ADR-0045 : Questions propres au jeu et affinités dans la définition du formulaire

## Contexte

[SPEC-001](../specs/SPEC-001-inscriptions.md) (R8, lot 2) : le formulaire d'un jeu pose, en plus des champs standards, les affinités et des questions propres au jeu (texte libre, choix unique, choix multiple, échelle de 1 à 5). Les versions du formulaire sont immuables et chaque inscription garde la sienne ([ADR-0019](ADR-0019-modele-des-inscriptions.md), R9). Les affinités seront rapprochées des inscrits au lot 4 (R23) ; les options des questions seront reliées aux personnages au lot 5.

## Décision

- **Définition.** La définition versionnée (`RegistrationFormVersion.definition`) gagne :
  - `affinities` : un réglage demandé / obligatoire pour chacune des quatre affinités (`wantWith`, `notWith`, `refusedRelations`, `avoid`), comme les champs standards ; aucune n'est demandée par défaut ;
  - `questions` : une liste ordonnée de questions `{ id, label, type, required, options }`, `type` parmi `text`, `single`, `multiple`, `scale`. L'`id` est attribué par le serveur à la création de la question et garde son sens d'une version à l'autre ; `options` n'existe que pour les choix.
  Une définition d'avant ce changement se lit avec des affinités non demandées et aucune question.
- **Réponses aux questions** : `Registration.questionAnswers` (JSON), par identifiant de question : un texte, une option, une liste d'options ou un entier de 1 à 5. Le libellé se relit dans la version du formulaire de l'inscription. Une réponse à une question absente de cette version, ou une option inconnue, est refusée.
- **Affinités** : une table `RegistrationAffinity` (inscription, sorte, texte, ordre), une ligne par personne ou relation citée : la personne en écrit une par ligne. Chaque enregistrement remplace les lignes de l'inscription. Le lot 4 y ajoutera la cible rapprochée.
- **Données personnelles.** Réponses et affinités partent avec l'inscription (cascade) quand la fiche est effacée, et `exportParticipantData` les donne. Elles ne vont dans aucun document envoyé ni dans l'export CSV des inscriptions (R24).
- **Lien personnel et compte.** Le même formulaire se remplit par le lien personnel et depuis « Je participe » ; une réponse depuis le compte ne met à jour que les coordonnées (ADR-0042), jamais les réponses ni les affinités.

## Conséquences

- Supprimer une question dans une nouvelle version ne touche pas les réponses déjà données : elles restent lisibles avec la version de l'inscription.
- Une option renommée devient une autre option : une inscription qui avait choisi l'ancienne la garde.

## Options écartées

- **Une table de questions** : la définition versionnée en JSON garde déjà les champs standards ; une table doublerait le versionnement.
- **Une colonne de texte par affinité** : le lot 4 rapprochera chaque personne citée ; une ligne par mention le permet sans relire du texte libre.
