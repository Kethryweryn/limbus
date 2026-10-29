---
titre: Un compte pour tout le monde, organiser et participer
statut: tranchée
date: 2026-10-29
---

# Un compte pour tout le monde, organiser et participer

## Besoin

Les participants n'ont pas de compte : leur fiche est tenue par l'organisation ([SPEC-007](../specs/SPEC-007-participants-et-rgpd.md)). Une même fiche sert à plusieurs jeux, et parfois à plusieurs équipes : chacune voit et modifie alors les coordonnées et les notes de l'autre (SPEC-007, écart 1). Une même personne peut aussi avoir plusieurs fiches, que rien ne rapproche.

Plutôt que de faire une fiche complète par jeu, l'utilisatrice veut unifier la personne pour de bon : un vrai compte, avec lequel elle gère ses jeux et ses données personnelles.

Côté organisation, les comptes ne sont aujourd'hui créés que par l'administratrice ou sur invitation ([SPEC-008](../specs/SPEC-008-comptes-et-partage.md)). L'utilisatrice veut ouvrir Limbus à toutes celles et tous ceux qui voudraient organiser un GN.

Enfin, le rôle global « organisateur » n'a pas vraiment de sens : on peut organiser un jeu et participer à un autre. Le seul rôle global est celui d'administrateur, oui ou non (précisé par l'utilisatrice le 29 octobre 2026).

## Proposition

- **Inscription libre** : une page d'inscription permet à chacun de créer son compte, sans invitation, pour organiser ses propres jeux ou participer à ceux des autres.
- **Rôles par jeu** : le seul rôle global est « administrateur » (oui ou non). Le reste dépend du jeu : propriétaire ou co-organisatrice d'un jeu, participant d'un autre. Le rôle global « organisateur » disparaît. Le contrôle `requireOrganizer`, en tête de toutes les routes de l'API (CLAUDE.md), devient « compte connecté », l'accès à chaque jeu restant vérifié comme aujourd'hui ; la règle de CLAUDE.md change avec lui.
- **Compte en libre-service** : avec des comptes ouverts, chacun change lui-même son nom, son email et son mot de passe, et réinitialise un mot de passe oublié par email ([SPEC-008](../specs/SPEC-008-comptes-et-partage.md), écart 2).
- **Deux espaces dans un même compte** : la personne retrouve les jeux qu'elle organise et ceux auxquels elle participe, avec une bascule entre les deux dans l'interface. Une personne qui ne fait que participer ne voit que son espace de participation.
- **Compte participant** : une personne crée son compte, ou l'active depuis un lien reçu par email (inscription, invitation). Elle y retrouve ses jeux et ses sessions.
- **Coordonnées tenues par la personne** : nom, email, téléphone, contact d'urgence, régime et allergies. Elle les met à jour elle-même, et chaque équipe les lit pour ses jeux seulement.
- **Données propres à l'équipe** : les notes d'organisation restent à l'équipe qui les écrit, et ne se voient pas d'une équipe à l'autre.
- **Droits RGPD en libre-service** : la personne télécharge ses données et demande leur effacement depuis son compte.
- **Documents** : elle retrouve ses fiches, trombinoscopes et documents dans son compte, en plus des emails.
- **Sans compte** : une personne qui n'en veut pas reste gérée par l'organisation, comme aujourd'hui.

## Découpage envisagé

1. Rôles : un seul rôle global (administrateur oui ou non), les droits d'organisation venant des jeux possédés ou partagés.
2. Inscription libre, avec vérification de l'adresse email et protection contre les inscriptions automatiques, et compte en libre-service (changer ses informations, mot de passe oublié).
3. Notes d'organisation propres à chaque équipe, séparées de la fiche commune.
4. Compte participant : rattachement des fiches existantes par email vérifié, espace « Je participe » et bascule entre les deux espaces.
5. Coordonnées et allergies tenues par la personne.
6. Export et effacement depuis le compte.
7. Documents et trombinoscopes consultables dans le compte.

## Décisions

- 2026-10-29 : un seul compte pour organiser et participer, avec l'administrateur comme seul rôle global. Inscription libre, ouverte à toutes celles et tous ceux qui veulent organiser. Bascule dans l'interface entre les jeux qu'on organise et ceux auxquels on participe.
- 2026-10-29, points ouverts tranchés avec l'utilisatrice (détail dans [SPEC-011](../specs/SPEC-011-un-compte-pour-tout-le-monde.md)) :
  - adresse email confirmée avant de pouvoir faire quoi que ce soit ;
  - contre les robots : limite par adresse IP et champ piège, sans service externe ;
  - plafond de stockage par compte (500 Mo par défaut, modifiable par l'administratrice), pas de limite de jeux ni de participants ;
  - sélecteur « J'organise » / « Je participe » dans l'en-tête ; le dernier espace utilisé se rouvre ;
  - fiches rattachées au compte par l'email confirmé, automatiquement ;
  - la personne fait foi sur ses coordonnées dès qu'elle a un compte ;
  - effacement immédiat depuis le compte, équipes prévenues par email ;
  - « Je participe » : sessions et inscriptions, documents reçus, paiement, fiche allergies ;
  - documents en pièce jointe et dans le compte ;
  - invitation à co-organiser acceptée par le seul compte de l'adresse invitée ;
  - transfert d'un jeu accepté par la co-organisatrice, l'ancienne propriétaire restant co-organisatrice ;
  - le lien personnel d'inscription marche toujours sans connexion ;
  - l'administratrice crée encore des comptes, par un lien pour choisir le mot de passe.
- Conditions d'utilisation, politique de confidentialité et responsable de traitement : tranchés à l'étape 5 de la feuille de route, avant d'ouvrir l'inscription en production.
