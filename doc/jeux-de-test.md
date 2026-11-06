# Jeux de test

Où essayer chaque fonctionnalité de Limbus, sur quel jeu et avec quel compte. Le rechargement et ses réglages sont décrits dans [`developpement.md`](developpement.md#jeux-de-test), la décision dans [ADR-0066](adr/ADR-0066-jeux-de-test-rechargeables-en-production.md).

## Les jeux

| Jeu | Étape | Sessions |
|---|---|---|
| Station Meridian | Avant les sessions | terminée à J-60 ; à venir de J+45 à J+230, une par sorte de sélection, et deux qui ne reçoivent que des pré-inscriptions |
| Les Cendres de Valombre | Session imminente | terminée à J-60 ; reportée, remplacée par la session imminente à J+10 ; une autre à J+75 |
| Le Bal des Masques Brisés | Après et imprévus | terminée à J-60 ; annulée (J+20) ; reportée (J+30) vers sa remplaçante (J+90) |

Les dates comptent à partir du jour du rechargement, et ne bougent plus ensuite : au bout de quelques jours, le délai de Lucie est dépassé ; après dix jours, la session imminente de Valombre est passée et ses copies d'envoi s'effacent. Il suffit alors de recharger. Un rechargement remplace ces trois jeux : ce qui y a été modifié à la main est perdu. Les partages, les autorisations d'assistants d'IA et le lien public du vivier reste.

## Les comptes

| Compte | Rôle | Ce qu'il montre |
|---|---|---|
| Le vôtre (`SEED_EMAIL`) | Propriétaire des trois jeux | Toutes les actions de l'équipe |
| Inès Lefèvre | Co-organisatrice de Meridian et de Valombre | Un jeu partagé, et un refus sur le Bal |
| Camille Bernard | Participante | Une session à venir et son paiement sur Valombre ; sur Meridian, pré-inscrite pour une session, et une décision pas encore annoncée pour une autre |
| Lucie Moreau | Participante | Une place à confirmer sur Meridian ; une session terminée sur le Bal |

Le mot de passe des comptes de test est celui donné au rechargement (`SEED_PASSWORD`). Une session ouverte sous l'un de ces comptes se ferme quand un rechargement remet le mot de passe à neuf.

## Qui reçoit vraiment les emails

Dans votre boîte, à l'adresse `SEED_EMAIL` complétée par `+prenom.nom` : Inès, Camille, Lucie, Nicolas Martin, Sarah Petit et Manon Richard. Le rechargement n'envoie rien.

Toutes les autres personnes sont en `example.test`, qui ne reçoit rien. **Un envoi groupé affiche donc des échecs pour elles, ou fait revenir des avis de non-distribution : ce n'est pas un défaut.** Les envois s'essaient plutôt sur Valombre, qui a le moins de personnes fictives.

Aucun lien personnel n'est préparé, car Limbus ne garde que l'empreinte d'un lien. Ils arrivent avec les envois lancés depuis l'application :

- présence : sur la session imminente de Valombre, la demande de présence écrit à Nicolas et à Inès, les seuls sans demande ;
- invitation à rejoindre le vivier : sur Meridian, Sarah attend la sienne, pour la « Session sur invitation » ;
- legs : sur le Bal, renvoyer l'invitation de Manon crée son lien.

## Où essayer quoi

| Spec | À essayer | Jeu | Compte |
|---|---|---|---|
| [SPEC-001](specs/SPEC-001-inscriptions.md) Inscriptions | Questionnaire, relations et assistant de casting | Meridian | Le vôtre, Inès ; Camille et Lucie côté personne |
| [SPEC-018](specs/SPEC-018-vivier-permanent.md) Vivier | Le vivier unique et son lien de diffusion (`/i/essai-meridian-vivier`) ; « Demander au vivier » sur une session ouverte, « Relancer » sur la Soirée du vivier (les adresses en `example.test` ne reçoivent rien) ; sessions ouvertes ou non ; sessions à la main, au tirage et mixte ; chaque statut par session ; annonce ; tirage et son annulation ; liste d'attente ; refus de Mehdi ; sortie de Clara ; invitations de Sarah et de Baptiste ; affinités et alerte (Nicolas et Raphaël) ; rejoueuse (Amandine) | Meridian | Le vôtre, Inès ; Camille et Lucie côté personne |
| [SPEC-002](specs/SPEC-002-copie-de-jeu.md) Copie et legs | Legs en attente, renvoi et acceptation avec l'adresse de Manon. Son invitation dure 14 jours : au-delà, Limbus retire la copie, et un rechargement en recrée une. Léguer un nouveau jeu reste possible depuis n'importe quel jeu | Le Bal | Le vôtre |
| [SPEC-003](specs/SPEC-003-ecriture-d-un-jeu.md) Écriture d'un jeu | Personnages, groupes, intrigues (dont une sans rattachement), objets, lieux, documents | Les trois | Le vôtre |
| [SPEC-004](specs/SPEC-004-sessions.md) Sessions et déroulé | Casting avec un rôle libre et une note ; équipe ; un joueur vient du vivier : sur Meridian, le choisir dans le cast le retient, et tout joueur des trois jeux a sa place dans le vivier (fermé sur Valombre et le Bal) ; déroulé avec responsables complets, manquants et en conflit (Thomas à 14 h 30). Annuler ou reporter une session pour de vrai | Valombre ; session annulée et reportée sur le Bal | Le vôtre, Inès |
| [SPEC-005](specs/SPEC-005-trombinoscopes-et-pdf.md) Trombinoscopes et PDF | Le trombinoscope d'Aélis est signalé à regénérer : la génération fait le vrai PDF. Réglages par personnage | Valombre | Le vôtre ; Camille pour le lire |
| [SPEC-006](specs/SPEC-006-emails-et-paiements.md) Envois et paiements | Document à jour et document dépassé à renvoyer ; tarifs par rôle et solidaires ; paiement à jour, en retard, en versements, offert et transféré (Antoine vers Julien) ; RIB fictif ; présence ; remboursements et report sur le Bal | Valombre, le Bal | Le vôtre |
| [SPEC-007](specs/SPEC-007-participants-et-rgpd.md) Participants et données | Filtres (Alex Morgan et Morgan Da Silva sont sur plusieurs jeux) ; notes propres à un jeu (Camille sur Valombre) ; export et effacement d'une fiche | Valombre | Le vôtre |
| [SPEC-008](specs/SPEC-008-comptes-et-partage.md) Comptes et partage | Partage, droits et refus ; invitation d'une nouvelle personne | Meridian, le Bal | Inès, le vôtre |
| [SPEC-009](specs/SPEC-009-page-publique.md) Page publique | Page, sessions et liens d'inscription, sans compte : `/public/games/station-meridian` | Meridian | Aucun |
| [SPEC-010](specs/SPEC-010-hors-ligne.md) Hors ligne | Consulter puis modifier une liste sans connexion, depuis le navigateur. Cela vaut pour tout jeu | Valombre | Le vôtre |
| [SPEC-011](specs/SPEC-011-un-compte-pour-tout-le-monde.md) Un compte pour tout | « Je participe », coordonnées et allergies tenues par la personne, documents reçus, export et effacement du compte. Effacer un compte de test est sans risque : un rechargement avec `SEED_PASSWORD` le recrée | Valombre, Meridian, le Bal | Camille, Lucie |
| [SPEC-012](specs/SPEC-012-photos-des-participants.md) Photos | Photos du casting, durée de conservation du jeu, refus d'une photo (Jeanne Giraud) | Le Bal | Le vôtre |
| [SPEC-013](specs/SPEC-013-pages-legales-et-conservation.md) Pages légales | Mentions, confidentialité, conditions. Les durées de conservation n'ont rien à montrer sur ces jeux, trop récents | Tout le site | Aucun |
| [SPEC-014](specs/SPEC-014-api-pour-ia.md) Assistants d'IA | Brancher un assistant, autoriser des jeux, lui faire lire et écrire. Les co-organisatrices peuvent le faire sur Valombre, pas sur Meridian | Valombre, Meridian | Le vôtre, Inès |
| [SPEC-015](specs/SPEC-015-qualite-du-questionnaire.md) Qualité du questionnaire | Repères sur les liens et les réponses, estimation générale : réponse dominante (« Aimez-vous mener une enquête ? »), questions en doublon (tension et pression), personnages indistincts (Eli et Jonas) | Meridian | Le vôtre |
| [SPEC-016](specs/SPEC-016-conception-du-questionnaire.md) Conception du questionnaire | Essai par l'équipe, prévision avec les proportions attendues sur les rôles, relecture (question sur la nuit), options mélangées (thèmes) | Meridian | Le vôtre |
| [SPEC-017](specs/SPEC-017-nouveautes.md) Nouveautés | La page et son lien, sans rapport avec ces jeux | Tout le site | Tout compte |

## Ce que ces jeux ne montrent pas

- La supervision, la politique de sécurité du navigateur et l'administration ne dépendent pas de ces jeux.
- Un formulaire public pas encore confirmé n'est pas préparé : il s'essaie en remplissant le formulaire de Meridian avec une adresse à vous.
- La page de Station Meridian est publique en production. Sa présentation annonce un jeu d'essai, et l'équipe n'est pas prévenue de chaque inscription, mais une personne qui a le lien peut s'y inscrire.
