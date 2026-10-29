---
id: SPEC-011
titre: Un compte pour tout le monde, organiser et participer
statut: validée
date: 2026-10-29
origine: ../todo/comptes-participants.md
epics: [EPIC-012, EPIC-013, EPIC-014, EPIC-015, EPIC-016]
adr: [ADR-0006, ADR-0007, ADR-0038, ADR-0039, ADR-0040, ADR-0041, ADR-0042]
---

# SPEC-011 : Un compte pour tout le monde, organiser et participer

## Objectif

Donner à chacun un seul compte, pour organiser ses jeux et participer à ceux des autres, et tenir lui-même ses données personnelles. Ouvrir Limbus à toutes celles et tous ceux qui veulent organiser un GN. Reprend la fiche [Un compte pour tout le monde](../todo/comptes-participants.md), les écarts 1 à 4 de [SPEC-008](SPEC-008-comptes-et-partage.md) et l'écart 1 de [SPEC-007](SPEC-007-participants-et-rgpd.md).

## Vocabulaire

- **Compte** : un email confirmé, un nom, un mot de passe. Le seul rôle global est administrateur, oui ou non.
- **Rôle dans un jeu** : propriétaire, co-organisatrice ou participant. Il vient du jeu, pas du compte.
- **Espace** : « J'organise » (les jeux qu'on possède ou qui nous sont partagés) ou « Je participe » (les jeux où l'on a une fiche participant).
- **Fiche participant** : la personne vue par une équipe ([SPEC-007](SPEC-007-participants-et-rgpd.md)). Elle se rattache à un compte par l'email confirmé.
- **Notes d'organisation** : ce qu'une équipe écrit sur une personne ; elles restent à cette équipe.

## Parcours

### Créer son compte

1. Sur la page d'inscription, la personne saisit son nom, son email et un mot de passe.
2. Elle reçoit un lien de confirmation. Tant que l'adresse n'est pas confirmée, le compte ne permet rien.
3. Une fois confirmée, ses fiches participant à cette adresse se rattachent à son compte, et elle arrive dans son espace.

### Passer d'un espace à l'autre

Un sélecteur « J'organise » / « Je participe » en haut de l'écran change le menu et les pages. Limbus rouvre le dernier espace utilisé ; la première fois, « J'organise » si la personne a un jeu à organiser, sinon « Je participe ». Une personne qui ne fait que participer ne voit pas le sélecteur.

### Participer

Pour chaque jeu, la personne retrouve ses sessions et l'état de ses inscriptions (auxquelles elle répond et dont elle se désiste aussi depuis son compte), ses documents reçus (fiche, trombinoscope, documents), son paiement (dû, versé, RIB ou lien) et sa fiche allergies, qu'elle tient à jour.

### Gérer son compte

Elle change son nom, son email (avec confirmation de la nouvelle adresse) et son mot de passe, réinitialise un mot de passe oublié par email, télécharge ses données et efface son compte.

### Organiser

Comme aujourd'hui ([SPEC-008](SPEC-008-comptes-et-partage.md)). En plus, une co-organisatrice quitte d'elle-même un jeu partagé, et la propriétaire propose le transfert de son jeu à une co-organisatrice.

## Règles métier

### Rôles (lot 1)

- **R1** Le seul rôle global est administrateur, oui ou non. Tout compte peut créer un jeu et en devenir propriétaire ; les droits sur un jeu viennent de la propriété ou du partage ([ADR-0038](../adr/ADR-0038-un-seul-role-global.md)).
- **R2** Une co-organisatrice quitte un jeu partagé sans l'accord de la propriétaire ; ce qu'elle y a écrit reste.
- **R3** La propriétaire propose le transfert de son jeu à une co-organisatrice. Le jeu change de main quand celle-ci accepte ; l'ancienne propriétaire reste co-organisatrice. Une proposition se retire tant qu'elle n'est pas acceptée. La destinataire reçoit un email, et le jeu porte « Transfert proposé » dans sa liste.

### Inscription et compte (lot 2)

- **R4** L'inscription libre est ouverte par un réglage du serveur ; elle reste fermée en production jusqu'à la publication des conditions d'utilisation et de la politique de confidentialité ([feuille de route](../feuille-de-route.md), étape 5). Fermée, l'écran de connexion ne propose pas de créer un compte.
- **R5** Un compte dont l'adresse n'est pas confirmée ne permet rien d'autre que renvoyer le lien de confirmation. Jamais confirmé, il est supprimé au bout de 7 jours. Un changement d'email prévient l'ancienne adresse.
- **R6** Contre les robots : un nombre d'inscriptions limité par adresse IP, et un champ invisible que seuls les robots remplissent. Aucun service externe.
- **R7** Chaque compte a un plafond de stockage (photos, RIB, documents téléversés), de 500 Mo par défaut, modifiable par l'administratrice. Les fichiers d'un jeu comptent pour sa propriétaire, quelle que soit la personne qui les téléverse. Aucune limite sur le nombre de jeux ou de participants.
- **R8** Seul le compte dont l'adresse confirmée est celle invitée accepte une invitation à co-organiser ; un autre compte connecté voit un message, et il faut une nouvelle invitation ([SPEC-008](SPEC-008-comptes-et-partage.md), écart 1).
- **R9** L'administratrice crée encore un compte : la personne reçoit un lien pour choisir son mot de passe (plus de mot de passe provisoire). Elle désactive ou supprime un compte et change son plafond de stockage.

### Équipes et personnes (lots 3 à 7)

- **R10** Les notes d'organisation sur une personne restent à l'équipe qui les écrit ([SPEC-007](SPEC-007-participants-et-rgpd.md), écart 1).
- **R11** À la confirmation de l'adresse, toutes les fiches participant qui portent cette adresse se rattachent au compte, automatiquement.
- **R12** Dès qu'une personne a un compte, elle seule modifie ses coordonnées (nom, email, téléphone, contact d'urgence, régime et allergies) ; chaque équipe les lit pour ses jeux seulement.
- **R13** L'effacement demandé depuis le compte est immédiat ; chaque équipe concernée reçoit un email (place libérée, paiement à régler à la main).
- **R14** Les documents envoyés gardent leur pièce jointe dans l'email, et sont aussi consultables dans le compte.
- **R15** Le lien personnel d'une invitation à s'inscrire marche toujours sans connexion ; l'inscription apparaît ensuite dans le compte.
- **R16** Une personne sans compte reste gérée par l'organisation, comme aujourd'hui.

## Données

- `User` : un rôle administrateur oui ou non, l'adresse confirmée, le plafond de stockage.
- Fiche participant rattachée à un compte ; notes d'organisation par équipe.
- L'export et l'effacement depuis le compte couvrent tout ce qui est rattaché au compte ; la durée de conservation est fixée à l'étape 5 (fiche [Photos et RGPD](../todo/photos-et-rgpd.md)).

## Sécurité et droits

- **R17** Toute route de l'API demande un compte connecté (`requireUser`), sauf les routes volontairement publiques ; l'accès à chaque jeu reste vérifié comme aujourd'hui ([ADR-0007](../adr/ADR-0007-isolation-par-jeu.md)).
- **R18** Le mode administrateur reste réservé aux administratrices ([SPEC-008](SPEC-008-comptes-et-partage.md), R7).

## Découpage

Un epic par lot, dans l'ordre :

1. Rôles : un seul rôle global, quitter un jeu, transférer un jeu ([EPIC-012](../archive/epics/EPIC-012-roles/README.md)).
2. Inscription libre, confirmation de l'adresse, protection contre les robots, compte en libre-service, mot de passe oublié, invitation par la bonne adresse, création par l'administratrice, plafond de stockage ([EPIC-013](../archive/epics/EPIC-013-inscription-et-compte/README.md)).
3. Notes d'organisation propres à chaque équipe : une note par jeu ([EPIC-014](../archive/epics/EPIC-014-notes-par-jeu/README.md)).
4. Compte participant : rattachement des fiches, espace « Je participe » (sessions, inscriptions, paiement), sélecteur d'espace ([EPIC-015](../archive/epics/EPIC-015-je-participe/README.md)).
5. Coordonnées et allergies tenues par la personne ([EPIC-016](../archive/epics/EPIC-016-coordonnees-tenues-par-la-personne/README.md)).
6. Export et effacement depuis le compte.
7. Documents et trombinoscopes dans le compte.

## Hors périmètre

- Conditions d'utilisation, politique de confidentialité et responsable de traitement : étape 5 de la [feuille de route](../feuille-de-route.md), avant d'ouvrir l'inscription en production.
- Durée de conservation des données : fiche [Photos et RGPD](../todo/photos-et-rgpd.md).
