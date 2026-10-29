---
titre: Un compte pour tout le monde, organiser et participer
statut: à trancher
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

## Points à trancher

- Inscription libre : vérification de l'email avant de pouvoir créer un jeu ? Protection contre les robots (limite par adresse IP, défi) ? Faut-il des limites par compte (nombre de jeux, de participants, place des fichiers) sur un serveur partagé ?
- Conditions d'utilisation et politique de confidentialité à publier avant d'ouvrir les inscriptions : qui les rédige, et qui est responsable de traitement pour les données des participants d'un jeu (l'équipe qui organise, ou l'hébergeur) ?
- Bascule entre les deux espaces : un sélecteur dans l'en-tête, ou deux entrées séparées dans le menu ? Que montre le tableau de bord d'une personne qui fait les deux ?
- Fusion des doublons : comment rattacher plusieurs fiches à un même compte (email vérifié, choix de la personne, validation par l'équipe) ?
- Qui fait foi quand la personne et l'équipe modifient la même coordonnée ? Recommandation : la personne, dès qu'elle a un compte.
- Effacement demandé depuis le compte : immédiat, ou validé par chaque équipe (paiements à régler, session en cours) ?
- Les règles actuelles qui supposent l'absence de compte (fichiers en pièce jointe, jamais en lien vers l'API ; liens personnels d'inscription, [ADR-0018](../adr/ADR-0018-jetons-des-liens-personnels.md)) changent-elles ? Le modèle de comptes et de rôles demande un ADR.

## Décisions

- 2026-10-29 : un seul compte pour organiser et participer, avec l'administrateur comme seul rôle global. Inscription libre, ouverte à toutes celles et tous ceux qui veulent organiser. Bascule dans l'interface entre les jeux qu'on organise et ceux auxquels on participe.
