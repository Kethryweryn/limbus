---
id: EPIC-050
titre: Plusieurs tests de bout en bout par écran
statut: en cours
spec: ../../archive/todo/tests-par-ecran.md
date: 2026-11-09
---

# EPIC-050 : Plusieurs tests de bout en bout par écran

## Objectif

Chaque écran de Limbus a plusieurs tests Playwright, sur quatre axes : ses actions, ses erreurs de saisie, ses droits et le hors ligne ([fiche](../../archive/todo/tests-par-ecran.md), choix de l'utilisatrice du 2026-11-09). Un défaut trouvé en écrivant un test est corrigé dans le même lot, avec sa propre US.

## US

| US | Titre | Statut |
|---|---|---|
| [US-198](US-198-tests-ecriture.md) | Tester chaque écran de l'écriture d'un jeu | terminée |
| [US-199](US-199-tests-sessions.md) | Tester chaque écran des sessions | terminée |
| [US-200](US-200-tests-participants.md) | Tester chaque écran des participants | terminée |
| [US-201](US-201-tests-compte-et-administration.md) | Tester les écrans du compte, de l'accès et de l'administration | terminée |
| [US-202](US-202-tests-espace-participant.md) | Tester l'espace « Je participe », le lien public d'inscription et les assistants | à faire |
| [US-203](US-203-tests-inscriptions.md) | Tester chaque règle des inscriptions | à faire |
| [US-204](US-204-champ-obligatoire-explique.md) | Savoir quel champ obligatoire manque | terminée |
| [US-205](US-205-option-aucun.md) | Choisir « Aucun » dans une liste de choix | terminée |
| [US-206](US-206-erreur-du-serveur-dans-le-formulaire.md) | Voir le refus du serveur dans le formulaire d'un personnage ou d'un jeu | terminée |
| [US-207](US-207-supprimer-un-jeu-archive.md) | Supprimer définitivement un jeu archivé | terminée |
| [US-208](US-208-description-une-seule-fois.md) | Lire la description d'un jeu une seule fois | terminée |
| [US-209](US-209-carte-et-fiche-d-une-session.md) | Ouvrir une session d'un clic sur sa carte, et la supprimer depuis sa fiche | terminée |
| [US-210](US-210-messages-en-francais.md) | Lire en français les refus du serveur | terminée |
| [US-211](US-211-supprimer-un-participant-depuis-sa-fiche.md) | Supprimer un participant depuis sa fiche, et voir pourquoi c'est refusé | terminée |
| [US-212](US-212-fiches-hors-ligne.md) | Rouvrir hors ligne toute fiche consultée | terminée |
| [US-213](US-213-refus-explique-acces-et-compte.md) | Lire la raison d'un refus dans les formulaires de l'accès, du compte et de l'administration | terminée |
| [US-214](US-214-action-sans-reseau.md) | Savoir qu'une action demande le réseau | terminée |
| [US-215](US-215-page-d-administration-refusee.md) | Voir pourquoi une page d'administration est refusée | terminée |
| [US-216](US-216-message-dans-la-carte.md) | Lire le résultat d'un formulaire du compte à côté de son bouton | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Chaque écran de la fiche a ses tests sur les quatre axes, ou la raison de leur absence.
