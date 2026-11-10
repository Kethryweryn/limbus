---
id: EPIC-045
titre: Retours du cahier de tests fonctionnels
statut: terminé
spec: ../../todo/retours-du-cahier-de-tests.md
date: 2026-11-06
---

# EPIC-045 : Retours du cahier de tests fonctionnels

## Objectif

Corriger ce que l'utilisatrice signale en déroulant son cahier de tests ([fiche](../../todo/retours-du-cahier-de-tests.md)).

## US

| US | Titre | Statut |
|---|---|---|
| [US-156](US-156-retrouver-ses-participations.md) | Retrouver ses participations depuis l'organisation | terminée |
| [US-157](US-157-page-d-erreur.md) | Comprendre qu'une page n'est pas accessible | terminée |
| [US-158](US-158-carte-du-jeu-actif.md) | Repérer le jeu actif sur la page Jeux | terminée |
| [US-159](US-159-connexion-sans-blocage.md) | Se connecter sans rester bloquée | terminée |
| [US-177](US-177-mes-photos-dans-le-compte.md) | Retrouver « Mes photos » dans mon compte | terminée |
| [US-178](US-178-urgence-et-allergies-sur-la-fiche.md) | Voir le contact d'urgence et les allergies sur la fiche participante | terminée |
| [US-179](US-179-carte-participant-cliquable.md) | Ouvrir une fiche en cliquant sur sa carte | terminée |
| [US-180](US-180-afficher-le-mot-de-passe.md) | Afficher le mot de passe pendant la saisie | terminée |
| [US-181](US-181-urgence-et-allergies-toujours-demandees.md) | Toujours demander le contact d'urgence et les allergies | terminée |
| [US-182](US-182-nom-du-contact-d-urgence.md) | Lire le nom du contact d'urgence sur la fiche | terminée |
| [US-183](US-183-sessions-sur-la-fiche.md) | Ouvrir les sessions d'une personne depuis sa fiche | terminée |
| [US-184](US-184-mise-a-jour-sans-perdre-sa-saisie.md) | Recevoir une nouvelle version sans perdre sa saisie | terminée |
| [US-185](US-185-une-fiche-par-personne.md) | Une seule fiche par personne dans mes jeux | terminée |
| [US-186](US-186-supprimer-depuis-la-fiche.md) | Supprimer un élément depuis sa fiche | terminée |
| [US-187](US-187-public-des-documents.md) | Choisir le public d'un document par rôles et par personnages | terminée |
| [US-196](US-196-reperer-la-nouvelle-version.md) | Repérer une nouvelle version sans recharger la page | terminée |
| [US-197](US-197-carte-lieu-cliquable.md) | Ouvrir un lieu en cliquant sur sa carte | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.

## Suivi

- 2026-11-06 au 2026-11-09 : déployé en dix PR, chacune vérifiée en production (sites joignables ; une note dans /nouveautes pour chaque PR sauf #187) : US-156 à US-158 (#152), US-159 (#154), US-177 (#157), US-178 à US-181 (#167), US-182 à US-184 (#168), US-185 (#169), US-186 (#171), US-187 (#172), US-196 (#187), US-197 (#188).
- Une US par retour du cahier de tests, au fil des essais de l'utilisatrice ; les décisions prises en route sont dans [ADR-0071](../../../adr/ADR-0071-mise-a-jour-au-changement-de-page.md), [ADR-0072](../../../adr/ADR-0072-public-des-documents.md) et [ADR-0078](../../../adr/ADR-0078-recherche-de-la-nouvelle-version.md).
- Limite connue : « une seule fiche par personne » (US-185) ne vaut que dans les jeux d'une même propriétaire, et seul le code la tient ; la fiche [Un compte pour chaque participant](../../../todo/compte-pour-chaque-participant.md) en part.
- Epic archivé.
