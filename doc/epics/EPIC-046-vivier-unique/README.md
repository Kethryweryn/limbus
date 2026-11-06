---
id: EPIC-046
titre: Vivier unique et statut par session
statut: à faire
spec: ../../specs/SPEC-018-vivier-permanent.md
date: 2026-11-06
---

# EPIC-046 : Vivier unique et statut par session

## Objectif

Chaque jeu a un seul vivier, une personne y répond une seule fois, dit où elle est disponible, et son statut se lit session par session. Le casting à la main, le tirage et l'annonce fonctionnent sur ce nouveau modèle.

## US

| US | Titre | Statut |
|---|---|---|
| [US-160](US-160-regrouper-en-un-vivier.md) | Avoir un seul vivier par jeu | à faire |
| [US-161](US-161-statut-par-session.md) | Suivre une personne session par session | à faire |
| [US-162](US-162-ouvrir-une-session.md) | Ouvrir une session à la pré-inscription | à faire |
| [US-163](US-163-disponibilites-du-questionnaire.md) | Dire où je suis disponible en répondant au questionnaire | à faire |
| [US-164](US-164-inviter-a-rejoindre.md) | Inviter une personne à rejoindre le vivier, ou pour une session | à faire |
| [US-165](US-165-annuler-ou-quitter.md) | Annuler ma présence à une session, ou quitter le vivier | à faire |
| [US-171](US-171-tirage-par-session.md) | Tirer au sort pour une session | à faire |
| [US-176](US-176-joueur-par-le-questionnaire.md) | Faire passer tout joueur par le questionnaire | à faire |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.
- La migration respecte ADR-0024 ; les jeux de test et `doc/jeux-de-test.md` sont à jour ; l'utilisatrice recharge les jeux de test après le déploiement.
