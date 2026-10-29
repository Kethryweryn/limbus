---
id: SPEC-008
titre: Comptes et partage d'un jeu
statut: validée
date: 2026-10-29
origine: ../archive/todo/documentation-de-l-existant.md
epics: [EPIC-008, EPIC-012]
adr: [ADR-0006, ADR-0007, ADR-0018]
---

# SPEC-008 : Comptes et partage d'un jeu

Cette spec décrit un comportement déjà en production, avant la reprise du développement ([Documentation de l'existant](../archive/todo/documentation-de-l-existant.md)). Les écarts 5 et 6, listés à la fin, sont corrigés par [EPIC-008](../archive/epics/EPIC-008-ecarts-comptes/README.md), les écarts 3 et 4 par [EPIC-012](../archive/epics/EPIC-012-roles/README.md) ; les écarts 1 et 2 viennent avec la suite de [SPEC-011](SPEC-011-un-compte-pour-tout-le-monde.md).

## Objectif

Donner un compte aux organisatrices, et leur permettre de travailler à plusieurs sur un même jeu sans rien voir des jeux des autres.

## Vocabulaire

- **Compte** : un email, un nom, un mot de passe et un rôle. Seules les organisatrices ont un compte ; les participants n'en ont pas ([SPEC-007](SPEC-007-participants-et-rgpd.md)).
- **Rôle** : administratrice ou non ; les droits sur un jeu viennent de sa propriété ou de son partage ([ADR-0038](../adr/ADR-0038-un-seul-role-global.md)).
- **Partage** : l'accès d'une co-organisatrice à un jeu dont elle n'est pas propriétaire.
- **Invitation à co-organiser** : un lien personnel envoyé par email, qui donne le partage à qui l'accepte.
- **Mode administrateur** : un mode que l'administratrice active pour accéder à tous les jeux.

## Acteurs

- **Administratrice** : crée et gère les comptes ; en mode administrateur, elle agit sur tous les jeux.
- **Propriétaire** : l'organisatrice qui a créé ou reçu un jeu ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R2). Elle invite des co-organisatrices et retire leurs partages.
- **Co-organisatrice** : elle a accès au jeu partagé ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R16).

## Parcours

### Se connecter

1. L'organisatrice saisit son email et son mot de passe.
2. Elle reste connectée 20 heures sur cet appareil. Elle se déconnecte, ou déconnecte tous ses appareils depuis le menu.

### Créer un compte

- L'administratrice crée un compte dans l'administration : email, nom, mot de passe provisoire et rôle.
- Ou une personne invitée à co-organiser, ou à recevoir un legs ([SPEC-002](SPEC-002-copie-de-jeu.md)), crée son compte depuis le lien reçu.

Il n'y a pas d'inscription libre.

### Partager un jeu

1. Depuis la fiche du jeu, la propriétaire saisit l'email d'une co-organisatrice. Limbus envoie l'invitation, et lui montre aussi le lien, à transmettre elle-même si l'email ne part pas.
2. La personne ouvre le lien. Connectée, elle accepte ; sans compte, elle en crée un ; sinon, elle se connecte.
3. Le jeu apparaît dans sa liste. La propriétaire voit les partages et les invitations en attente, et peut annuler une invitation ou retirer un partage.

## Règles métier

### Comptes et connexion

- **R1** Un email ne sert qu'à un compte, sans tenir compte de la casse. Le mot de passe compte au moins 8 caractères ; il est haché (bcrypt).
- **R2** Une connexion refusée ne dit pas si l'email existe : même message et même temps de réponse. Les tentatives sont limitées à 30 par adresse IP et 10 par email en 15 minutes.
- **R3** La session dure 20 heures. Le jeton ne porte que l'identifiant du compte et sa version de session : le rôle et l'email sont relus à chaque requête ([ADR-0006](../adr/ADR-0006-sessions-et-revocation.md)).
- **R4** « Déconnecter tous mes appareils » et tout changement de mot de passe par l'administratrice invalident toutes les sessions ouvertes du compte.
- **R5** Seule l'administratrice crée, modifie (email, nom, rôle, mot de passe) et supprime un compte. Elle ne peut pas supprimer le sien. Un compte qui possède encore des jeux ne peut pas être supprimé. Le rôle de la dernière administratrice ne peut pas lui être retiré : il faut d'abord en nommer une autre ([US-043](../archive/epics/EPIC-008-ecarts-comptes/US-043-jamais-sans-administratrice.md)).
- **R6** Supprimer un compte retire ses partages et les invitations qu'il a envoyées. Les inscriptions qu'il a gérées restent, sans son nom.

### Mode administrateur

- **R7** Hors mode administrateur, l'administratrice n'a accès qu'à ses jeux, comme toute organisatrice. Le mode s'active pour 2 heures sur l'appareil ; il donne accès à tous les jeux, sauf au contenu des copies léguées en attente ([SPEC-002](SPEC-002-copie-de-jeu.md)).

### Partage

- **R8** Seule la propriétaire, ou l'administratrice en mode administrateur, invite, voit les partages et les invitations, annule une invitation et retire un partage ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R17). Une co-organisatrice quitte d'elle-même un jeu partagé ; ce qu'elle y a écrit reste ([US-059](../archive/epics/EPIC-012-roles/US-059-quitter-un-jeu.md)). La propriétaire, elle seule, propose le transfert de son jeu à une co-organisatrice ; le jeu change de main quand celle-ci accepte, et l'ancienne propriétaire reste co-organisatrice ([US-060](../archive/epics/EPIC-012-roles/US-060-transferer-un-jeu.md)).
- **R9** Il n'y a qu'un niveau de partage : la co-organisatrice lit et modifie tout le contenu et les sessions du jeu, et peut l'archiver ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R16).
- **R10** On n'invite ni la propriétaire, ni une personne qui a déjà accès. Une nouvelle invitation à la même adresse annule la précédente. Les invitations sont limitées à 10 par propriétaire et par jeu en une heure.
- **R11** Une invitation vaut 14 jours et ne sert qu'une fois. Le lien est un jeton aléatoire ; une invitation annulée, acceptée ou expirée est refusée.
- **R12** L'invitation peut être acceptée par le compte connecté, quel que soit son email : la page signale seulement que l'invitation a été envoyée à une autre adresse (voir les écarts). Créer un compte depuis le lien permet aussi de choisir une autre adresse que celle invitée.
- **R13** Si l'email d'invitation ne part pas, l'invitation est quand même créée, et la propriétaire reçoit le lien et la cause de l'échec.
- **R14** Retirer un partage coupe l'accès dès la requête suivante. Ce que la co-organisatrice a écrit reste dans le jeu.

## Données

- `User` (compte), `GameShare` (partage) et `GameInvitation` (invitation, de partage ou de legs).
- Une invitation ne garde que l'empreinte de son jeton, comme les liens personnels ; renvoyer un legs envoie un nouveau lien ([US-042](../archive/epics/EPIC-008-ecarts-comptes/US-042-jeton-d-invitation-hache.md), [ADR-0034](../adr/ADR-0034-jeton-d-invitation-hache.md)).
- Un compte n'est supprimé qu'à la main par l'administratrice.

## Sécurité et droits

- **R15** Toute route de l'API demande un compte connecté (`requireUser`, [ADR-0038](../adr/ADR-0038-un-seul-role-global.md)), sauf les routes de connexion (`auth/*` : connexion, inscription par invitation, déconnexion, état de la connexion), la lecture d'une invitation et les routes publiques ([ADR-0007](../adr/ADR-0007-isolation-par-jeu.md)). Accepter une invitation et « déconnecter tous mes appareils » demandent seulement un compte connecté.
- **R16** Le cookie de session est `httpOnly`, `secure` et `SameSite=Lax`. Celui du mode administrateur aussi.
- **R17** Une organisatrice n'atteint que ses jeux et ceux qu'on lui a partagés (`tests/integration/isolation.test.ts`).

## Hors périmètre

- Legs d'une copie : [SPEC-002](SPEC-002-copie-de-jeu.md).
- Configuration SMTP : [SPEC-006](SPEC-006-emails-et-paiements.md).
- Comptes des participants : fiche [Un compte pour tout le monde](../todo/comptes-participants.md).
- Durcissement du cookie et des en-têtes : fiche [Durcissement web](../todo/durcissement-web.md).

## Écarts constatés

Relevés le 29 octobre 2026 avec l'utilisatrice. Les écarts 5 (jeton d'invitation en clair) et 6 (dernière administratrice) sont corrigés par [EPIC-008](../archive/epics/EPIC-008-ecarts-comptes/README.md), les écarts 3 et 4 par [EPIC-012](../archive/epics/EPIC-012-roles/README.md) ; les écarts 1 et 2 relèvent de la suite de la refonte des comptes ([SPEC-011](SPEC-011-un-compte-pour-tout-le-monde.md)).

1. **Invitation acceptée par un autre compte (R12)** : seul le compte de l'adresse invitée devrait pouvoir accepter. Avec un autre compte connecté, ou en créant un compte avec une autre adresse, il faudrait une nouvelle invitation.
2. **Libre-service (R5)** : chaque organisatrice devrait pouvoir changer elle-même son nom, son email et son mot de passe, et réinitialiser un mot de passe oublié par email. Aujourd'hui, seule l'administratrice le fait.
3. **Quitter un jeu (R8)** : une co-organisatrice devrait pouvoir se retirer d'elle-même d'un jeu partagé.
4. **Transférer un jeu (R5)** : la propriétaire devrait pouvoir donner son jeu, et non une copie, à une co-organisatrice. Le refus de supprimer un compte qui possède des jeux demande de « les transférer », ce qui n'existe pas.
