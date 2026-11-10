---
id: SPEC-020
titre: Une page Inscriptions par jeu, en onglets
statut: en cours
date: 2026-11-10
origine: ../archive/todo/page-inscriptions.md
epics: [EPIC-054]
adr: []
---

# SPEC-020 : Une page Inscriptions par jeu, en onglets

## Objectif

Une organisatrice trouve vite ce qu'elle cherche dans les inscriptions : ce qui reste à traiter dans chacun de ses jeux, puis, dans un jeu, une session, une personne du vivier ou un réglage, sans faire défiler tout le reste.

Aujourd'hui, la page Inscriptions affiche l'un sous l'autre le bloc complet de chaque jeu, toutes ses sessions dépliées, le vivier, le journal des tirages et les réglages (retour D1-1 du cahier de tests). Cette spec ne change que la présentation : les actions, leurs règles et leurs messages restent ceux de [SPEC-001](SPEC-001-inscriptions.md) et [SPEC-018](SPEC-018-vivier-permanent.md).

## Parcours

### Organisatrice ou co-organisatrice

1. Elle ouvre Inscriptions. Sans jeu actif, elle voit une ligne par jeu, avec ce qui reste à traiter.
2. Elle ouvre un jeu : sa page s'ouvre sur l'onglet Sessions, la prochaine session dépliée.
3. Elle passe à l'onglet Vivier pour retrouver une personne par son nom, ou celles qui ont demandé une session.
4. Elle ouvre une fiche, puis revient : la page rouvre le même onglet et les mêmes sessions dépliées.

## Règles métier

### Résumé des jeux

- **R1** Sans jeu actif, Inscriptions affiche une ligne par jeu, triée par titre ; la case « Afficher les jeux archivés » reste, et la liste de choix d'un jeu disparaît. Chaque ligne donne l'état du vivier (pas de vivier, brouillon, ouvert, fermé), le nombre de personnes dans le vivier et ce qui reste à traiter (R2). Un clic ouvre la page du jeu (R4). Un jeu sans vivier a un bouton « Créer le vivier », qui ouvre ses réglages puis la page du jeu.
- **R2** « À traiter » compte, pour les sessions prévues du jeu (R7) :
  - les réponses modifiées depuis leur dernière lecture (celles qui ont « Marquer comme lu ») ;
  - les réponses attendues : une personne retenue, à qui le casting est annoncé, et qui n'a pas encore confirmé sa place (celles qui ont « Relancer » et « Prolonger ») ;
  - les sessions dont le casting attend une annonce : jamais annoncé avec au moins une personne retenue, ou annoncé avec des changements à proposer ([SPEC-018](SPEC-018-vivier-permanent.md)).

  La ligne détaille chaque nombre non nul (« 2 réponses modifiées · 1 réponse attendue · 1 casting à annoncer ») ; sans rien à traiter, elle n'en dit rien.
- **R3** Avec un jeu actif, Inscriptions mène directement à la page de ce jeu. Les liens vers Inscriptions (fiche de session, email « cette personne est dans le vivier ») mènent à la page du jeu concerné, sur l'onglet Vivier pour inviter ou retrouver une personne ; pour créer le vivier, sur la page du jeu, qui le propose (R4).

### Page d'un jeu

- **R4** Chaque jeu a sa page Inscriptions, à son adresse propre. Son en-tête donne le titre du jeu, l'état du vivier et, sans jeu actif, un lien vers le résumé ; avec un jeu actif, on en sort par la barre du jeu actif. Ouverte alors qu'un autre jeu est actif (lien de l'email, lien copié), la page rend son jeu actif. Elle a trois onglets : Sessions, Vivier (avec le nombre de personnes) et Réglages ; un seul s'affiche à la fois. Un jeu sans vivier n'a pas d'onglets : la page propose « Créer le vivier » et « Formulaire ».
- **R5** L'onglet ouvert est dans l'adresse de la page : le bouton Retour du navigateur, un rechargement ou un lien copié le rouvrent. Sans onglet dans l'adresse, la page s'ouvre sur Sessions.
- **R6** Les messages d'une action (réussite, erreur) s'affichent en haut de la page, au-dessus des onglets.

### Onglet Sessions

- **R7** L'onglet commence par le rappel actuel : les décisions ne préviennent personne, seul « Annoncer le casting » envoie les emails ; et la règle des rejoueurs du jeu. Puis viennent les sessions prévues (ni terminées ni annulées), à date dépassée comprises, dans l'ordre des dates, celles sans date en dernier.
- **R8** Chaque session est repliée sur une ligne : nom, date, places prises sur le total, état (« Ouverte à la pré-inscription » ou « Pas proposée au vivier ») et ce qui reste à traiter dans cette session (R2). Dépliée, elle montre tout ce qu'elle montre aujourd'hui (ouvrir ou refermer, sélection, tirage, annonce, demande de disponibilités, retenues, attente, pré-inscrites, ajout d'une personne), et ses tirages, repliés.
- **R9** On déplie autant de sessions qu'on veut. Les sessions dépliées sont dans l'adresse de la page (R5). À la première ouverture de l'onglet, quand l'adresse ne dit rien des sessions, la première session de la liste est dépliée d'office ; ensuite l'adresse garde le choix fait, même aucune session dépliée.
- **R10** En bas de l'onglet, une ligne repliée « Sessions passées » rassemble les tirages des sessions terminées, annulées ou supprimées, avec leurs détails actuels (graine, réglages, résultat, annulation passée). Ils s'y lisent seulement : on n'y annule plus un tirage. Sans tels tirages, la ligne n'apparaît pas.

### Onglet Vivier

- **R11** L'onglet donne les invitations sans réponse et le bouton « Inviter », puis les personnes du vivier avec leurs actions actuelles (détail, nouveau lien, retrait), puis, repliée, la liste « Sorties du vivier ».
- **R12** Un champ de recherche filtre les personnes du vivier et les invitations par nom ou par email, sans tenir compte des majuscules ni des accents. Un filtre « Vœu de session » ne garde que les personnes qui ont demandé une session donnée, parmi les sessions prévues. Les deux se combinent ; la liste dit combien de personnes elle montre sur le total, et ce qu'il faut faire quand aucune ne correspond. Recherche et filtre ne vont pas dans l'adresse.

### Onglet Réglages

- **R13** L'onglet donne l'état du vivier et « Ouvrir » ou « Fermer », le lien de diffusion à copier, le délai de réponse, l'équipe prévenue ou non, puis les boutons « Réglages », « Formulaire » et « Supprimer le vivier ».

### Hors ligne

- **R14** Le résumé et la page d'un jeu se relisent sans réseau depuis leur dernière lecture, onglets et sessions compris ([SPEC-010](SPEC-010-hors-ligne.md), R1). Un jeu téléchargé garde aussi la page Inscriptions du jeu et ce qu'elle lit ([SPEC-019](SPEC-019-hors-ligne-dans-le-compte.md), R9).

## Données

Aucune donnée nouvelle. Le résumé (R1, R2) se calcule à la lecture, à partir des inscriptions et des sessions existantes. Rien de personnel ne va dans l'adresse de la page : seuls l'onglet et les sessions dépliées y figurent.

## Sécurité et droits

- La page d'un jeu et le résumé suivent les droits actuels de la page Inscriptions : organisatrice et co-organisatrice du jeu ; une personne sans accès au jeu est refusée, sans apprendre s'il existe.
- Le résumé ne compte que les jeux auxquels la personne a accès.

## Hors périmètre

- Changer une action, une règle de sélection ou un email des inscriptions.
- Le formulaire d'inscription lui-même, qui reste dans sa fenêtre.
- Un tableau de bord des inscriptions sur plusieurs jeux à la fois, au-delà du résumé.

## Découpage

Un seul lot, [EPIC-054](../epics/EPIC-054-page-inscriptions/README.md) :

1. La page d'un jeu en trois onglets, et le résumé des jeux sans « à traiter » (R1, R3 à R7, R11, R13, R14).
2. Sessions repliées, sessions dans l'adresse, tirages par session et sessions passées (R8 à R10).
3. Recherche et filtre dans le vivier (R12).
4. Ce qui reste à traiter, dans le résumé et sur chaque session (R2).

## Historique

- 2026-11-10 : création à partir du retour D1-1, avec les choix de l'utilisatrice :
  - trois onglets, Sessions, Vivier, Réglages (R4) ;
  - sans jeu actif, un résumé par jeu (R1) ; « à traiter » : réponses modifiées, places à confirmer, casting à annoncer (R2) ;
  - une page propre au jeu, où mène Inscriptions avec un jeu actif (R3, R4) ;
  - onglet et sessions dépliées dans l'adresse (R5, R9) ;
  - sessions repliées, la prochaine dépliée d'office (R8, R9) ;
  - tirages avec leur session, ceux des sessions passées ou supprimées sous « Sessions passées » (R8, R10) ; sorties du vivier repliées avec le vivier (R11) ;
  - recherche par nom et filtre par vœu de session dans le vivier (R12).
- 2026-11-10 (revue, choix de l'utilisatrice) : « à traiter » compte les réponses attendues, et non des places à confirmer par l'équipe, qui n'existent pas (R2) ; pas de lien vers le résumé avec un jeu actif (R4) ; une session repliée le reste au retour, même toutes (R9) ; la liste suit les sessions prévues, et les tirages des sessions terminées, annulées ou supprimées se lisent sous « Sessions passées », sans annulation (R7, R10). Le lien pour créer le vivier mène à la page du jeu (R3).
- 2026-11-10 : US-230 livrée : résumé des jeux et page d'un jeu en onglets. Le lien « ouvrez le vivier » de la fiche de session mène à l'onglet Réglages, où le vivier s'ouvre (R3).
- 2026-11-10 (revue d'US-230, choix de l'utilisatrice) : la page d'un jeu ouverte avec un autre jeu actif rend son jeu actif (R4) ; « Créer le vivier » du résumé crée le vivier sans passer par la page du jeu (R1).
