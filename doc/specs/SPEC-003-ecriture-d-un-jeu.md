---
id: SPEC-003
titre: Écriture d'un jeu
statut: validée
date: 2026-10-29
origine: ../todo/documentation-de-l-existant.md
epics: []
adr: [ADR-0007, ADR-0008]
---

# SPEC-003 : Écriture d'un jeu

Cette spec décrit un comportement déjà en production, avant la reprise du développement ([Documentation de l'existant](../todo/documentation-de-l-existant.md)). Elle n'a ni epic ni US. Les écarts constatés entre le code et l'intention sont listés à la fin, sans être corrigés.

## Objectif

Centraliser l'écriture d'un GN pour faciliter la rédaction, la relecture et la cohérence : le jeu, ses personnages, factions, intrigues, objets, documents, sa chronologie et ses lieux, et les liens entre eux.

## Vocabulaire

- **Jeu** : l'unité d'écriture. Tout le contenu appartient à un seul jeu.
- **Contenu d'un jeu** : personnages, factions, intrigues, objets, documents, événements de chronologie et lieux.
- **Jeu actif** : le jeu choisi dans l'interface (« Rendre actif »). Les listes s'y limitent. Ce choix est propre à l'appareil et ne donne aucun droit.

## Acteurs

- **Propriétaire** : l'organisatrice qui a créé le jeu, ou qui l'a reçu en legs ([SPEC-002](SPEC-002-copie-de-jeu.md)).
- **Co-organisatrice** : une organisatrice invitée à partager le jeu.
- **Administratrice** : en mode administrateur, elle accède à tous les jeux.

## Parcours

### Créer et préparer un jeu

1. L'organisatrice crée un jeu avec un titre ; elle en devient propriétaire.
2. Elle complète sa fiche : description, note d'intention, lien du teaser.
3. Elle le rend actif, puis crée son contenu depuis les pages Personnages, Factions, Intrigues, Objets, Documents, Chronologie et Lieux.

### Écrire le contenu

Chaque élément a une fiche, que l'on crée, modifie et supprime. Les liens se font depuis les formulaires : factions d'un personnage, personnages d'une intrigue, objets d'un événement… Dans les formulaires d'intrigue, de document et d'événement, des groupes permettent de sélectionner d'un coup tous les PJ, tous les PNJ ou tous les personnages.

### Archiver un jeu

Depuis la liste des jeux, la propriétaire ou une co-organisatrice archive un jeu terminé, puis peut le restaurer. Les jeux archivés sont masqués de la liste, sauf si l'on coche « Afficher les archives ».

## Règles métier

### Jeu

- **R1** Un jeu a un titre, une description, une note d'intention et un lien de teaser (facultatifs, sauf le titre). Un teaser YouTube est intégré dans la fiche ; tout autre lien est affiché comme lien.
- **R2** La personne qui crée un jeu en est la propriétaire.
- **R3** Un jeu est actif ou archivé. **Archiver un jeu archive tout son contenu** : il n'y a pas d'archivage élément par élément. Un jeu archivé n'a pas de page publique, même si elle était publiée.
- **R4** Supprimer un jeu supprime tout ce qui lui appartient : contenu, sessions, inscriptions, partages, invitations, fichiers téléversés ([ADR-0008](../adr/ADR-0008-fichiers-televerses.md)), et ses legs encore en attente ([SPEC-002](SPEC-002-copie-de-jeu.md)). Les participants, qui peuvent être liés à plusieurs jeux, restent.

### Contenu

- **R5** Chaque élément appartient à un jeu et n'en change jamais. Les liens entre éléments ne relient que des éléments du même jeu.
- **R6** Chaque jeu et chaque élément a un slug unique sur toute l'application, tiré de son nom ou de son titre. Le slug change quand le nom change. Les pages utilisent le slug, et l'API utilise les identifiants stables.
- **R7** **Personnage** : un nom, un type (PJ ou PNJ, PJ par défaut), un pitch, une histoire (texte, ou lien vers un document externe) et des indications de costume. Il appartient à des factions et participe à des intrigues. Ses réglages de trombinoscope et de fiche sont décrits dans la spec sur les trombinoscopes et les PDF.
- **R8** **Faction** : un nom, un pitch, une histoire (texte ou lien), des indications de costume et des membres (personnages). Elle est liée à des intrigues. Elle peut figurer sur les trombinoscopes.
- **R9** **Intrigue** : un nom, un pitch, une description et un niveau. Les niveaux sont, du plus au moins important : trame principale scénario, trame principale personnage, intrigue majeure, intrigue mineure (par défaut). Elle relie des personnages, des factions et des objets.
- **R10** **Objet** : un nom, une description, **une quantité**, et un emplacement : un texte libre ou un personnage qui le détient. Il est lié à des personnages et à des intrigues.
- **R11** **Document** : un titre, et un contenu ou un lien vers un document externe (au moins l'un des deux). Son audience est un ciblage manuel (par défaut), tout le monde, les organisateurs, les PNJ ou l'équipe cuisine. En ciblage manuel, il vise un personnage (champ « Personnage »), des personnages et des factions. Il est marqué « prêt à envoyer » quand il peut partir aux participants. Les envois sont décrits dans [SPEC-006](SPEC-006-emails-et-paiements.md).
- **R12** **Événement de chronologie** : un nom, une description, un jour (à partir de 1), une heure et un nombre de responsables requis. Il relie des personnages, des factions, des intrigues et des objets. La chronologie se lit par jour, puis par heure, puis par nom. L'affectation des responsables à une session est décrite dans la spec sur les sessions.
- **R13** **Lieu** : un nom, une adresse et des notes. Une session se tient dans un lieu.
- **R14** Supprimer un élément supprime ses liens, jamais les éléments liés. Exceptions :
  - supprimer un personnage retire aussi son casting dans toutes les sessions, sans demander de confirmation particulière ;
  - supprimer un personnage qui détient un objet laisse l'objet sans emplacement ;
  - supprimer le personnage choisi dans le champ « Personnage » d'un document laisse ce champ vide ;
  - supprimer un lieu laisse ses sessions sans lieu.
- **R15** Les URL saisies (teaser, histoire, document externe) sont des liens http(s). Un fichier téléversé n'est accepté que s'il appartient au même jeu.

## Données

- Tables `Game`, `Character`, `Faction`, `Intrigue`, `Item`, `Document`, `TimelineEvent` et `Location`, rattachées au jeu par `gameId`, avec suppression en cascade.
- Le contenu d'écriture n'est rattaché à aucun participant. Il n'entre donc ni dans l'export ni dans la suppression RGPD des participants (`exportParticipantData`, `eraseParticipant`).
- Il peut pourtant contenir des données personnelles :
  - la photo de trombinoscope par défaut d'un personnage peut montrer une personne réelle, par exemple la personne qui joue un PNJ ;
  - les textes libres peuvent nommer des personnes.

  Ces données ne sont supprimées qu'avec le personnage ou le jeu. La fiche [Photos et RGPD](../todo/photos-et-rgpd.md) doit en tenir compte.
- Le contenu d'un jeu est conservé tant que le jeu existe.

## Sécurité et droits

- **R16** La propriétaire, les co-organisatrices et l'administratrice en mode administrateur lisent et modifient tout le contenu du jeu. Elles peuvent aussi archiver ou restaurer le jeu (confirmé par l'utilisatrice le 29 octobre 2026), même si cela masque le jeu de la liste de la propriétaire et coupe sa page publique.
- **R17** Seule la propriétaire, ou l'administratrice en mode administrateur, supprime le jeu et gère ses partages. Seule la propriétaire le lègue ([SPEC-002](SPEC-002-copie-de-jeu.md)).
- **R18** Une organisatrice n'atteint rien d'un jeu auquel elle n'a pas accès : ni lecture, ni écriture, ni lien depuis son propre contenu ([ADR-0007](../adr/ADR-0007-isolation-par-jeu.md), `tests/integration/isolation.test.ts`).

## Hors périmètre

Ces sujets sont couverts par leurs propres specs :

- sessions, casting et chronologie de déroulé ;
- trombinoscopes et fiches de personnage en PDF ;
- envois d'emails et paiements ([SPEC-006](SPEC-006-emails-et-paiements.md)) ;
- participants et RGPD ;
- comptes et partage ;
- page publique ;
- hors ligne ;
- legs d'une copie ([SPEC-002](SPEC-002-copie-de-jeu.md)) ;
- inscriptions ([SPEC-001](SPEC-001-inscriptions.md)).

## Écarts constatés

Relevés le 29 octobre 2026 en comparant le code aux règles ci-dessus. Aucun n'est corrigé ici : chacun deviendra une fiche todo s'il est retenu.

1. **Archivage (R3)** : archiver un jeu ne marque que le jeu (`Game.published`). Personnages, factions, intrigues, objets, documents, événements et lieux ont aussi un champ `published` et un badge « Archivé », mais aucune action ne le change. Leur état reste donc toujours « actif », même dans un jeu archivé.
2. **Quantité d'un objet (R10)** : `Item.quantity` existe, mais vaut toujours 1. Le formulaire ne propose pas de la saisir, et l'API ne l'accepte pas.
3. **Intrigue « prête à envoyer »** : le schéma de validation d'une intrigue accepte `readyToSend`, qui n'existe pas dans la table et n'est jamais enregistré. Le champ est sans effet.
4. **Jeu archivé et page publique (R3)** : archiver un jeu ne retire pas sa marque « page publique » ; la page n'est masquée que parce que la route publique exige un jeu actif. Restaurer le jeu republie donc sa page sans qu'on le demande.
