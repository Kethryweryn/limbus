---
id: EPIC-034
titre: Brancher une IA, lot 2 : écriture du contenu d'un jeu
statut: en cours
spec: ../../specs/SPEC-014-api-pour-ia.md
date: 2026-11-03
---

# EPIC-034 : Brancher une IA, lot 2 : écriture du contenu d'un jeu

## Objectif

Lot 2 de [SPEC-014](../../specs/SPEC-014-api-pour-ia.md) (R10 à R13). Avec une autorisation en lecture et écriture, l'assistant crée et modifie un jeu, et écrit son contenu : personnages, factions, intrigues, objets, documents, lieux, chronologie et relations.

## Décisions

2026-11-03, choix de l'utilisatrice :

- l'assistant ne pose ni ne change aucun lien (vidéo de présentation, fichier d'un background ou d'un document) ;
- il peut marquer une fiche ou un document « prêt à envoyer », et régler le trombinoscope d'un personnage, mais jamais sa photo ;
- il n'archive ni ne restaure le jeu. Limbus n'archive pas un élément seul ;
- une suppression est définitive, comme dans l'interface, et le journal garde le nom de l'élément.

Choix techniques :

- Les écritures de l'interface passent dans des fonctions serveur (`server/utils/contentWrites.ts`), que les routes et les outils appellent toutes deux (R12). Les routes ne changent pas de comportement.
- Un outil de modification ne reçoit que les champs à changer. Il les complète avec la fiche actuelle, liens compris, avant la validation habituelle : un champ omis n'est jamais effacé.
- La version lue (`updatedAt`) est obligatoire pour modifier ou supprimer. Elle passe par le même contrôle que l'en-tête `If-Unmodified-Since` de l'interface.

## US

| US | Titre | Statut |
|---|---|---|
| [US-125](US-125-creer-et-modifier-un-jeu.md) | L'assistant crée et modifie un jeu | terminée |
| [US-126](US-126-ecrire-le-contenu.md) | L'assistant écrit le contenu d'un jeu | terminée |
