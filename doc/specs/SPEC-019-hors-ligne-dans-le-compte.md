---
id: SPEC-019
titre: Gérer depuis son compte les données gardées pour le hors ligne
statut: validée
date: 2026-11-10
origine: ../archive/todo/cache-hors-ligne-dans-le-compte.md
epics: [EPIC-051, EPIC-052, EPIC-053]
adr: [ADR-0080, ADR-0081]
---

# SPEC-019 : Gérer depuis son compte les données gardées pour le hors ligne

## Objectif

Une organisatrice qui prépare un jeu sur un lieu sans réseau sait ce que son appareil garde, et prépare tout à l'avance : elle télécharge un jeu d'un clic, voit la place prise, efface ce qui est gardé, ou désactive le hors ligne sur un appareil prêté. Une participante fait de même pour ses sessions à venir.

Aujourd'hui, seule une page consultée avec le réseau se rouvre sans réseau ([SPEC-010](SPEC-010-hors-ligne.md), R1). Cette spec ne change ni la file des modifications (R5 à R9 de SPEC-010) ni la déconnexion (R10, R11), sauf mention ici.

## Parcours

### Organisatrice ou co-organisatrice

1. Avant de partir sur le lieu, elle ouvre « Mon compte », section « Hors ligne sur cet appareil ».
2. Elle choisit « Télécharger » sur un de ses jeux actifs. Limbus montre l'avancement, puis la date du téléchargement.
3. Sur place, sans réseau, elle ouvre toutes les pages du jeu, fiches et sessions comprises.
4. Quand le réseau revient, le jeu se remet à jour tout seul.
5. Après le GN, elle efface ce que l'appareil garde, ou désactive le hors ligne si l'appareil était prêté.

### Participante

1. Dans « Mon compte », elle choisit « Télécharger mes sessions à venir ».
2. Sans réseau, elle relit dans « Je participe » ses participations et les documents reçus pour ses sessions à venir.

## Règles métier

### Section du compte

- **R1** « Mon compte » a une section « Hors ligne sur cet appareil », pour toute personne connectée. Ses réglages valent pour l'appareil (le navigateur), et non pour le compte : un autre appareil garde les siens.
- **R2** La section affiche la place que prennent les données gardées (pages, PDF, photos), et en plus petit la place totale que le navigateur réserve à Limbus, application comprise. Un navigateur qui ne donne pas ces mesures le dit.

### Effacer

- **R3** « Effacer » vide ce que l'appareil garde : pages, PDF, photos, jeux téléchargés et file des modifications. La personne reste connectée, et Limbus garde de quoi s'ouvrir sans réseau pour ce compte ([SPEC-010](SPEC-010-hors-ligne.md), R3) : seule la désactivation (R5) l'oublie.
- **R4** S'il reste des modifications faites sans réseau, Limbus le dit avant d'effacer, et propose de les envoyer d'abord (avec le réseau), ou de les abandonner. Sans réseau, seul l'abandon est proposé. On peut aussi renoncer à effacer. Si l'envoi laisse des modifications refusées (erreur, conflit), Limbus s'arrête, dit lesquelles restent, et propose de les abandonner pour effacer, ou de renoncer pour les régler d'abord dans le panneau des modifications.

### Désactiver

- **R5** Une case « Garder Limbus sur cet appareil pour le hors ligne » est cochée par défaut. La décocher efface tout comme R3 (même demande pour les modifications en attente, R4), oublie aussi l'identité gardée pour le hors ligne, et retire l'application gardée sur l'appareil.
- **R6** Tant que la case est décochée, rien n'est gardé sur l'appareil, et aucune modification n'est mise en file : sans réseau, Limbus ne s'ouvre pas, et une modification échoue avec le message des actions qui demandent le réseau. La section le dit, et les boutons de téléchargement sont indisponibles, avec la raison.
- **R7** Le réglage reste sur l'appareil après la déconnexion et la connexion d'un autre compte. Recocher la case garde de nouveau les pages consultées ; rien de ce qui était effacé ne revient.

### Télécharger un jeu

- **R8** Chaque jeu actif auquel la personne a accès comme organisatrice ou co-organisatrice a un bouton « Télécharger ». Un rôle dans l'équipe d'une session (PNJ, cuisine) sans cet accès ne donne pas ce bouton, mais celui de R16. Un jeu archivé n'en a pas ; s'il avait été téléchargé avant, il reste gardé jusqu'à l'effacement.
- **R9** Le téléchargement garde tout ce que les pages du jeu lisent : le jeu, ses listes et chaque fiche (personnages, groupes, intrigues, objets, documents, événements, lieux, participants), la page Inscriptions et chaque inscription, et chaque session avec tous ses onglets. Pour les sessions à venir, il garde aussi leurs PDF (trombinoscopes, fiches de personnage, fiche allergies) et les photos du cast ; pas pour les sessions passées. Ces fichiers téléchargés échappent aux limites des fichiers consultés en passant (300 photos, 30 jours : [SPEC-010](SPEC-010-hors-ligne.md), R2) : ils restent tant que le jeu reste téléchargé.
- **R10** Le téléchargement garde aussi le contact d'urgence et les allergies de chaque participant du jeu, que la fiche ne garde pas quand on la consulte ([SPEC-007](SPEC-007-participants-et-rgpd.md), R1b ; [ADR-0080](../adr/ADR-0080-urgence-et-allergies-dans-un-telechargement.md)). La section le dit à côté du bouton.
- **R11** Pendant le téléchargement, Limbus affiche l'avancement (éléments gardés sur le total). Si le réseau tombe, il s'arrête et le dit ; ce qui est déjà gardé le reste, et un nouveau clic reprend tout. À la fin, la date du dernier téléchargement complet s'affiche à côté du jeu.
- **R12** Un téléchargement ne remplace jamais un élément qui a une modification en attente dans la file : sa copie « en attente » reste ([SPEC-010](SPEC-010-hors-ligne.md), R6).
- **R13** Sans réseau, le bouton est indisponible, avec la raison.

### Mise à jour et accès perdu

- **R14** Un jeu téléchargé se télécharge de nouveau tout seul, en arrière-plan, à l'ouverture de Limbus et au retour du réseau, au plus une fois par heure. Seuls les jeux téléchargés sur cet appareil sont concernés ; la date affichée est celle du dernier téléchargement complet.
- **R15** Si, à une mise à jour, le serveur refuse le jeu (accès retiré, jeu supprimé), Limbus efface de l'appareil ce qu'il en avait téléchargé, contact d'urgence et allergies compris, et la section dit que le jeu n'est plus accessible.

### Participante

- **R16** Une personne qui participe à au moins une session a un bouton « Télécharger mes sessions à venir » : ses participations, et pour chaque session à venir, les documents reçus et leurs PDF. Les règles R11 à R14 s'y appliquent, sessions à venir au lieu d'un jeu. À chaque mise à jour, une session que « Je participe » ne montre plus (personne retirée, session passée ou supprimée) part de l'appareil, avec ses documents.

## Données

- Tout est sur l'appareil, dans le navigateur : la base IndexedDB de Limbus et le cache du service worker. Le serveur ne garde rien de ces réglages.
- Le registre des téléchargements (jeu ou sessions à venir, date, éléments gardés) et la case de R5 restent sur l'appareil.
- Après un téléchargement, l'appareil garde des données de santé : allergies, et le contact d'urgence ([ADR-0080](../adr/ADR-0080-urgence-et-allergies-dans-un-telechargement.md)). Elles ne sont pas chiffrées ([ADR-0012](../adr/ADR-0012-donnees-hors-ligne.md)), et partent avec l'effacement (R3), la désactivation (R5), l'accès perdu (R15), la déconnexion et la connexion d'un autre compte ([SPEC-010](SPEC-010-hors-ligne.md), R10, R11).

## Sécurité et droits

- Le téléchargement passe par les routes que lisent les pages, avec les mêmes contrôles : il ne garde que ce que la personne a le droit de voir.
- Une participante ne télécharge que ce qu'elle voit dans « Je participe ».

## Hors périmètre

- Télécharger plusieurs jeux d'un seul clic, ou un jeu archivé.
- Chiffrer les données de l'appareil ([ADR-0012](../adr/ADR-0012-donnees-hors-ligne.md)).
- Une mise à jour pendant que Limbus est fermé (synchronisation en arrière-plan du navigateur, [ADR-0081](../adr/ADR-0081-telechargement-par-le-navigateur.md)).

## Découpage

1. Place prise, effacement et désactivation (R1 à R7), [EPIC-051](../epics/EPIC-051-gerer-le-hors-ligne/README.md).
2. Télécharger un jeu, sa mise à jour et l'accès perdu (R8 à R15), [EPIC-052](../epics/EPIC-052-telecharger-un-jeu/README.md).
3. Télécharger ses sessions à venir (R16), [EPIC-053](../epics/EPIC-053-telecharger-ses-sessions/README.md).

## Historique

- 2026-11-10 : création à partir de la fiche, avec les choix de l'utilisatrice :
  - un jeu choisi, un bouton par jeu actif (R8) ;
  - PDF et photos des sessions à venir seulement (R9) ;
  - contact d'urgence et allergies toujours inclus dans un téléchargement (R10) ;
  - effacer avec des modifications en attente : les envoyer, sinon les abandonner (R4) ;
  - désactivé, rien n'est gardé, file comprise (R6) ;
  - mise à jour toute seule, une fois par heure au plus (R14) ; accès perdu, jeu effacé de l'appareil (R15) ;
  - les participantes dans ce chantier, sessions à venir seulement (R16) ;
  - place des données, avec la place totale en petit ; effacer garde l'identité hors ligne, seule la désactivation l'oublie (R2, R3) ;
  - hors ligne actif par défaut sur un nouvel appareil (R5).
- 2026-11-10 (revue, choix de l'utilisatrice) : un envoi qui laisse des modifications refusées arrête l'effacement et demande (R4). Précisés aussi : fichiers téléchargés hors des limites du cache des pages consultées (R9), rôles d'équipe sans accès au jeu (R8), départ d'une session pour une participante (R16).
