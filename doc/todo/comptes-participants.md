---
titre: Comptes participants
statut: à trancher
date: 2026-10-29
---

# Comptes participants

## Besoin

Les participants n'ont pas de compte : leur fiche est tenue par l'organisation ([SPEC-007](../specs/SPEC-007-participants-et-rgpd.md)). Une même fiche sert à plusieurs jeux, et parfois à plusieurs équipes : chacune voit et modifie alors les coordonnées et les notes de l'autre (SPEC-007, écart 1). Une même personne peut aussi avoir plusieurs fiches, que rien ne rapproche.

Plutôt que de faire une fiche complète par jeu, l'utilisatrice veut unifier la personne pour de bon : un vrai compte, avec lequel elle gère ses jeux et ses données personnelles.

## Proposition

- **Compte participant** : une personne crée son compte, ou l'active depuis un lien reçu par email (inscription, invitation). Elle y retrouve ses jeux et ses sessions.
- **Coordonnées tenues par la personne** : nom, email, téléphone, contact d'urgence, régime et allergies. Elle les met à jour elle-même, et chaque équipe les lit pour ses jeux seulement.
- **Données propres à l'équipe** : les notes d'organisation restent à l'équipe qui les écrit, et ne se voient pas d'une équipe à l'autre.
- **Droits RGPD en libre-service** : la personne télécharge ses données et demande leur effacement depuis son compte.
- **Documents** : elle retrouve ses fiches, trombinoscopes et documents dans son compte, en plus des emails.
- **Sans compte** : une personne qui n'en veut pas reste gérée par l'organisation, comme aujourd'hui.

## Découpage envisagé

1. Notes d'organisation propres à chaque équipe, séparées de la fiche commune.
2. Compte participant : création, connexion, rattachement des fiches existantes par email vérifié.
3. Coordonnées et allergies tenues par la personne.
4. Export et effacement depuis le compte.
5. Documents et trombinoscopes consultables dans le compte.

## Points à trancher

- Un compte participant et un compte d'organisatrice sont-ils le même compte, avec des rôles, ou deux espaces séparés ? Recommandation : un seul compte, pour qu'une organisatrice qui joue ailleurs n'en ait pas deux.
- Fusion des doublons : comment rattacher plusieurs fiches à un même compte (email vérifié, choix de la personne, validation par l'équipe) ?
- Qui fait foi quand la personne et l'équipe modifient la même coordonnée ? Recommandation : la personne, dès qu'elle a un compte.
- Effacement demandé depuis le compte : immédiat, ou validé par chaque équipe (paiements à régler, session en cours) ?
- Les règles actuelles qui supposent l'absence de compte (fichiers en pièce jointe, jamais en lien vers l'API ; liens personnels d'inscription, [ADR-0018](../adr/ADR-0018-jetons-des-liens-personnels.md)) changent-elles, et faut-il un ADR pour le modèle de comptes ?
