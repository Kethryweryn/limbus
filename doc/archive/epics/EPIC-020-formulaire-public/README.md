---
id: EPIC-020
titre: Formulaire public, lien de diffusion et inscription permanente
statut: terminé
spec: ../../../specs/SPEC-001-inscriptions.md
date: 2026-10-31
---

# EPIC-020 : Formulaire public, lien de diffusion et inscription permanente

## Objectif

Seconde moitié du lot 2 de [SPEC-001](../../../specs/SPEC-001-inscriptions.md) (R10, R11, R13, R30 à R32), après le formulaire complet ([EPIC-019](../EPIC-019-formulaire-complet/README.md)) : n'importe qui s'inscrit par le lien de diffusion d'une période en mode formulaire, ou à l'inscription permanente du jeu. Avec l'écart 3 de [SPEC-009](../../../specs/SPEC-009-page-publique.md) : la page publique montre, au choix, les sessions à venir et le lien d'inscription.

La sélection des inscriptions reçues (retenue, liste d'attente, tirage) est le lot 3.

## Décisions

- Une personne connectée trouve le formulaire prérempli par son compte, et son inscription est reçue sans email de confirmation.
- L'équipe est prévenue de chaque inscription reçue si la période le demande (case dans la période).
- Le formulaire de l'inscription permanente montre, pour information, les sessions à venir.
- L'aperçu du lien de diffusion sur les réseaux sociaux prend la vignette du teaser du jeu.
- La page publique a deux cases sur le jeu : « Afficher les sessions à venir » et « Afficher le lien d'inscription ».
- Une personne désistée qui remplit à nouveau le formulaire repart à « reçue ».

## US

| US | Titre | Statut |
|---|---|---|
| [US-083](US-083-periode-en-mode-formulaire.md) | Ouvrir une période en mode formulaire, ou l'inscription permanente | terminée |
| [US-084](US-084-formulaire-public.md) | S'inscrire par le lien de diffusion | terminée |
| [US-085](US-085-confirmer-son-email.md) | Confirmer son email, puis suivre son inscription | terminée |
| [US-086](US-086-page-publique-sessions-et-inscription.md) | Sessions à venir et lien d'inscription sur la page publique | terminée |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0046](../../../adr/ADR-0046-formulaire-public-des-inscriptions.md).
