---
id: SPEC-005
titre: Trombinoscopes et documents PDF
statut: validée
date: 2026-10-29
origine: ../archive/todo/documentation-de-l-existant.md
epics: [EPIC-005]
adr: [ADR-0008, ADR-0030]
---

# SPEC-005 : Trombinoscopes et documents PDF

Cette spec décrit un comportement déjà en production, avant la reprise du développement ([Documentation de l'existant](../archive/todo/documentation-de-l-existant.md)). Elle n'a ni epic ni US. Les écarts constatés entre le code et l'intention sont listés à la fin, sans être corrigés.

## Objectif

Donner à chaque joueuse et chaque joueur, pour une session, ce que son personnage sait des autres : un trombinoscope propre à son personnage, avec les visages et les noms qu'il connaît. Produire aussi les documents à remettre en PDF : fiches de personnage et documents du jeu.

## Vocabulaire

- **Trombinoscope d'un personnage** : la liste des personnages que ce personnage connaît, avec pour chacun une photo (ou un emplacement vide), un nom et une note. Deux personnages d'un même jeu n'ont pas forcément le même trombinoscope.
- **Personnage qui regarde** : celui à qui le trombinoscope est destiné.
- **Personnage regardé** : une entrée de ce trombinoscope.
- **Fiche de personnage** : le PDF remis au participant qui joue un personnage dans une session.

## Parcours

### Configurer le trombinoscope d'un personnage

1. Sur la fiche d'un personnage, l'organisatrice ouvre « Trombinoscope ».
2. Pour chaque autre personnage du jeu, elle choisit :
   - s'il figure dans le trombinoscope ;
   - si sa photo est affichée ou laissée vide (visage inconnu) ;
   - le nom sous lequel il apparaît (identités multiples) ;
   - une note.
3. Elle enregistre. Le réglage vaut pour toutes les sessions du jeu.

### Générer et consulter les trombinoscopes d'une session

1. Dans la session, l'organisatrice génère les trombinoscopes : un par personnage casté sur un participant.
2. Chaque trombinoscope indique le nombre de photos manquantes. Elle peut l'ouvrir pour le relire.
3. Après un changement de casting ou de photos, elle les génère à nouveau.

## Règles métier

### Réglages par défaut d'un personnage regardé

- **R1** Sur sa fiche, chaque personnage a des réglages qui s'appliquent à tous les trombinoscopes où il apparaît :
  - « exclure des trombinoscopes » : il n'apparaît dans aucun ;
  - « visage caché » : sa photo n'est jamais affichée ;
  - un nom d'affichage et une note par défaut ;
  - une photo par défaut.
- **R2** Une faction marquée « afficher dans le trombinoscope » apparaît comme étiquette sur les entrées de ses membres.

### Trombinoscope d'un personnage

- **R3** Chaque personnage a son propre trombinoscope. Pour chaque autre personnage du jeu, il fixe : l'inclusion, l'affichage de la photo (visage connu ou non), le nom affiché et une note. Le nom affiché peut être différent du nom de la fiche, pour gérer les identités multiples.
- **R4** Sans réglage particulier, un personnage regardé est inclus, avec son visage connu, son nom d'affichage par défaut (sinon son nom) et sa note par défaut. Cela vaut pour tous les personnages du jeu, castés ou non dans la session. C'est la configuration du personnage qui regarde qui choisit qui y figure.
- **R5** Un personnage exclu des trombinoscopes (R1) n'apparaît jamais, quel que soit le réglage du personnage qui regarde. Un « visage caché » (R1) l'emporte sur « visage connu ».
- **R5b** Un personnage n'apparaît jamais dans son propre trombinoscope (confirmé par l'utilisatrice le 29 octobre 2026). Aujourd'hui, il y figure par défaut : voir les écarts.
- **R6** Les entrées sont triées : les PJ d'abord, puis les PNJ, et par nom.

### Génération pour une session

- **R7** La génération produit un trombinoscope par attribution qui a un participant (personnage qui regarde × participant), en HTML et en PDF, enregistré en base.
- **R8** La photo d'une entrée vient aujourd'hui de la photo par défaut du personnage regardé, sinon de la photo de son attribution dans la session (voir les écarts : l'ordre voulu est l'inverse). Une photo téléversée est lue dans les fichiers du jeu, une photo externe est téléchargée par `fetchPublicImage`. Une entrée dont la photo devrait être affichée mais n'existe pas compte comme « photo manquante ».
- **R9** Générer à nouveau remplace les trombinoscopes de la session. Ceux d'une attribution qui n'existe plus, parce que le rôle a été retiré ou donné à quelqu'un d'autre, sont supprimés.
- **R10** Un trombinoscope n'est pas mis à jour tout seul : après un changement de casting, de photo ou de réglage, il faut le générer à nouveau.

### Documents PDF

- **R11** La fiche de personnage d'une session est un PDF au nom du personnage. Elle contient son pitch, son histoire, le lien vers le document externe s'il y en a un, et ses indications de costume. Elle est « prête à envoyer » quand le personnage est marqué comme tel ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R7).
- **R12** Un document du jeu se télécharge en PDF pour une session : son titre, la session, son contenu, et son lien externe s'il y en a un.
- **R13** Les PDF sont générés à la demande, sauf les trombinoscopes, enregistrés à la génération (R7). L'envoi de ces documents par email est décrit dans [SPEC-006](SPEC-006-emails-et-paiements.md).

## Données

- `CharacterTrombinoscopeEntry` : réglage d'un personnage regardé dans le trombinoscope d'un personnage, valable pour toutes les sessions.
- `SessionTrombinoscope` : trombinoscope généré pour une attribution (HTML, PDF en base64, nombre de photos manquantes, date). Il est supprimé avec la session, le personnage ou le participant.
- Les trombinoscopes contiennent les photos des participants, qui sont des données personnelles. Supprimer un participant supprime les trombinoscopes des sessions où figurait sa photo ; il faut les générer à nouveau ([SPEC-004](SPEC-004-sessions.md), [SPEC-007](SPEC-007-participants-et-rgpd.md)).

## Sécurité et droits

- **R14** Configurer, générer et lire les trombinoscopes et les PDF demande l'accès au jeu de la session. Les photos sont lues sous contrôle, jamais servies en statique ([ADR-0008](../adr/ADR-0008-fichiers-televerses.md)). Une photo externe n'est téléchargée que depuis un hôte public, avec un délai et une taille bornés.

## Hors périmètre

- Envoi des fiches, trombinoscopes et documents par email : [SPEC-006](SPEC-006-emails-et-paiements.md).
- Photos d'attribution et casting : [SPEC-004](SPEC-004-sessions.md).

## Écarts constatés

Relevés le 29 octobre 2026 avec l'utilisatrice. Aucun n'est corrigé ici.

1. **Ordre des photos (R8)** : la règle voulue est la photo de la personne qui joue le rôle dans la session d'abord, et la photo par défaut du personnage seulement si elle manque. Le code fait l'inverse : dès qu'un personnage a une photo par défaut, la photo de la personne qui le joue n'apparaît jamais.
2. **Soi-même (R5b)** : la configuration et la génération listent aussi le personnage qui regarde. Par défaut, il apparaît donc dans son propre trombinoscope, sauf si on le décoche à la main.
3. **Trombinoscopes périmés (R10)** : rien n'indique qu'un trombinoscope généré ne correspond plus au casting, aux photos ou aux réglages actuels. Seul le nombre de photos manquantes est affiché.
