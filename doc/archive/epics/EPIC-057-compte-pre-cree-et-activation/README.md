---
id: EPIC-057
titre: Un compte pré-créé pour chaque fiche, que la personne active
statut: terminé
spec: ../../../specs/SPEC-022-compte-pour-chaque-participant.md
date: 2026-11-12
---

# EPIC-057 : Un compte pré-créé pour chaque fiche, que la personne active

## Objectif

Lot 2 de [SPEC-022](../../../specs/SPEC-022-compte-pour-chaque-participant.md) : toute fiche qui a une adresse appartient à un compte. Si l'adresse n'en a pas, le compte est pré-créé, sans email. La personne l'active par un lien reçu à son adresse et y choisit son nom. Ensuite, chaque champ qu'elle remplit remplace celui de ses équipes. Les emails des équipes lui disent où retrouver tout cela.

Décisions :

- [ADR-0088](../../../adr/ADR-0088-compte-pre-cree-sans-mot-de-passe.md) : compte sans mot de passe, activation, ligne au bas des emails. La politique de confidentialité (R16) est avancée dans ce lot avec US-244, pour qu'aucun compte ne soit créé sans qu'elle le dise ;
- [ADR-0089](../../../adr/ADR-0089-recopie-champ-par-champ.md) : recopie champ par champ.

## US

| US | Titre | Statut |
|---|---|---|
| [US-244](US-244-compte-pre-cree.md) | Un compte pré-créé pour chaque fiche | terminée |
| [US-245](US-245-recopie-champ-par-champ.md) | Les coordonnées recopiées champ par champ | terminée |
| [US-246](US-246-activer-son-compte.md) | Activer son compte | terminée |
| [US-247](US-247-ligne-des-emails.md) | Une ligne au bas des emails des équipes | terminée |

Ordre : US-244 d'abord. Sa migration rend le mot de passe facultatif sans casser le build en service. Puis US-245, US-246 et US-247.

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.

## Suivi

- 2026-11-12 : déployé en quatre PR, chacune vérifiée en production (sites joignables, numéro de déploiement sur /nouveautes) : #241 (US-244), #242 (US-245), #243 (US-246, page /acces/activer joignable), #244 (US-247).
- Toute fiche qui a une adresse appartient à un compte, pré-créé sans mot de passe et sans email ([ADR-0088](../../../adr/ADR-0088-compte-pre-cree-sans-mot-de-passe.md)) ; la personne l'active par un lien reçu à son adresse, et ce qu'elle remplit remplace champ par champ les valeurs des équipes ([ADR-0089](../../../adr/ADR-0089-recopie-champ-par-champ.md)). La politique de confidentialité le dit depuis US-244 (`TERMS_VERSION` 2026-11-12).
- Choix de l'utilisatrice pendant le lot : une personne activée peut prendre l'adresse d'un compte non activé (fiches réunies), l'administratrice reprend un compte non activé en le créant.
- Les revues ont fait : effacer une fiche au compte jamais activé comme une fiche sans compte ; refuser à l'administratrice le lien de mot de passe, la modification et la suppression d'un compte pré-créé qui porte des fiches ; ne lire du compte, pour la liste des fiches, que le nom et le téléphone ; dire à la création qu'un nom est tenu par la personne ; noter un échec de la demande de lien sans changer la réponse ; ne pas mettre de ligne au bas d'un email sans compte à l'adresse ou pour un compte désactivé ; tests sans mot de passe écrit en clair (alerte GitGuardian, fausse alerte).
- Limites connues, pour le lot 3 : la liste des comptes de l'administration montre les comptes non activés sans nom ni mention ; un compte non activé suit encore la règle des 24 mois sans connexion.
