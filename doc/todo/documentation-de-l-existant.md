---
titre: Documenter les fonctionnalités antérieures à la reprise
statut: prête
date: 2026-10-29
---

# Documenter les fonctionnalités antérieures à la reprise

## Besoin

Depuis la reprise du développement, chaque évolution passe par une spec (SPEC-001 inscriptions, SPEC-002 legs de jeu). Tout ce qui existait avant n'a pas de spec : écriture du jeu (personnages, factions, intrigues, objets, documents, chronologie, lieux), sessions et casting, trombinoscopes, feuilles de personnage en PDF, envois d'emails, paiements, participants et RGPD, partage d'un jeu, page publique, hors ligne, administration. Le README en donne un aperçu, sans les règles.

Conséquence : pour modifier une de ces fonctionnalités, il faut relire le code pour savoir ce qu'elle fait et ce qui est voulu. Une IA ou une nouvelle personne n'a pas de référence, et une régression ne se voit pas faute de règle écrite.

## Proposition

Rédiger, à partir du code et de l'usage réel, une spec par grand domaine, au même format que les specs existantes (règles métier numérotées, données, sécurité et droits), avec le statut `validée` puisque le comportement est déjà en production. Ces specs ne créent pas d'epic : elles décrivent l'existant, et toute évolution ultérieure les modifie comme les autres.

Domaines envisagés :

1. Écriture d'un jeu : jeux, personnages, factions, intrigues, objets, documents, chronologie, lieux.
2. Sessions : création, casting, chronologie de déroulé.
3. Trombinoscopes et feuilles de personnage (PDF).
4. Envois d'emails et paiements.
5. Participants et données personnelles (RGPD).
6. Comptes, partage d'un jeu, mode administrateur.
7. Page publique d'un jeu.
8. Hors ligne (PWA).

Ce que SPEC-001 décrit déjà (inscrits confirmés dans le tableau des paiements, fiche allergies, périodes d'inscription) y reste : les nouvelles specs y renvoient par un lien, sans recopier ses règles.

Au passage, les écarts constatés entre le code et ce qui semble voulu sont notés en fin de spec, sans être corrigés : chacun devient une fiche todo ou un correctif à part.

## Découpage envisagé

Une PR de documentation par domaine, dans l'ordre ci-dessus, ou dans l'ordre des prochains chantiers.

## Décisions

- 2026-10-29 : une spec par domaine, huit au total, dans l'ordre de la proposition : écriture du jeu, sessions, trombinoscopes et PDF, emails et paiements, participants et RGPD, comptes et partage, page publique, hors ligne.
- 2026-10-29 : des specs seulement, sans guide utilisateur. Un guide serait un autre besoin, avec sa propre fiche.
- 2026-10-29 : les règles douteuses déduites du code sont posées en questions à l'utilisatrice pendant la rédaction, avant la PR de chaque spec. Les écarts entre le code et l'intention sont notés en fin de spec, sans être corrigés.
- 2026-10-29 : chaque spec a le statut `validée` (elle décrit un comportement en production) et pas d'epic. La fiche part dans `archive/todo/` avec la dernière des huit specs.
