---
id: EPIC-057
titre: Un compte pré-créé pour chaque fiche, que la personne active
statut: en cours
spec: ../../specs/SPEC-022-compte-pour-chaque-participant.md
date: 2026-11-12
---

# EPIC-057 : Un compte pré-créé pour chaque fiche, que la personne active

## Objectif

Lot 2 de [SPEC-022](../../specs/SPEC-022-compte-pour-chaque-participant.md) : toute fiche qui a une adresse appartient à un compte. Si l'adresse n'en a pas, le compte est pré-créé, sans email. La personne l'active par un lien reçu à son adresse et y choisit son nom. Ensuite, chaque champ qu'elle remplit remplace celui de ses équipes. Les emails des équipes lui disent où retrouver tout cela.

Décisions :

- [ADR-0088](../../adr/ADR-0088-compte-pre-cree-sans-mot-de-passe.md) : compte sans mot de passe, activation, ligne au bas des emails. La politique de confidentialité (R16) est avancée dans ce lot avec US-244, pour qu'aucun compte ne soit créé sans qu'elle le dise ;
- [ADR-0089](../../adr/ADR-0089-recopie-champ-par-champ.md) : recopie champ par champ.

## US

| US | Titre | Statut |
|---|---|---|
| [US-244](US-244-compte-pre-cree.md) | Un compte pré-créé pour chaque fiche | terminée |
| [US-245](US-245-recopie-champ-par-champ.md) | Les coordonnées recopiées champ par champ | terminée |
| [US-246](US-246-activer-son-compte.md) | Activer son compte | terminée |
| [US-247](US-247-ligne-des-emails.md) | Une ligne au bas des emails des équipes | à faire |

Ordre : US-244 d'abord. Sa migration rend le mot de passe facultatif sans casser le build en service. Puis US-245, US-246 et US-247.

## Limites jusqu'au lot 3

- La liste des comptes de l'administration montre les comptes non activés sans nom et sans mention.
- Un compte non activé suit encore la règle des 24 mois sans connexion, comptés depuis sa création.

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.
