---
id: SPEC-014
titre: Brancher une IA sur ses jeux
statut: validée
date: 2026-11-02
origine: ../archive/todo/api-pour-ia.md
epics: []
adr: [ADR-0038, ADR-0042, ADR-0043, ADR-0053, ADR-0055]
---

# SPEC-014 : Brancher une IA sur ses jeux

## Objectif

Une organisatrice confie une partie du travail sur ses jeux à une IA (Claude, ChatGPT, Mistral…). L'IA écrit des personnages, relie intrigues et factions, prépare le casting d'une session, aide à la sélection des inscriptions. Elle le fait avec les droits de l'organisatrice, sur les seuls jeux que celle-ci a choisis. Elle ne voit ni les coordonnées des participants ni aucun texte libre écrit par un tiers, et elle ne fait rien qui sorte de Limbus.

Fiche d'origine : [API pour une IA](../archive/todo/api-pour-ia.md). État de l'art et risques : [revue du 2026-11-02](../revues/2026-11-02-api-pour-ia.md).

## Vocabulaire

- **Assistant** : le logiciel d'IA qui se branche sur Limbus (Claude, ChatGPT, Mistral…), un « client » au sens d'OAuth.
- **Autorisation** : l'accord donné par une organisatrice à un assistant. Il précise des droits (lecture seule, ou lecture et écriture) et des jeux. Une organisatrice peut en donner plusieurs, une par assistant.
- **Outil** : une action que Limbus propose à l'assistant (« lister les personnages d'un jeu », « créer une intrigue »…), au sens du protocole MCP.

## Acteurs et parcours

### Organisatrice : brancher un assistant

1. Dans son assistant, elle ajoute Limbus comme connecteur, avec l'adresse du serveur MCP de Limbus.
2. L'assistant ouvre une page de Limbus. Si elle n'est pas connectée, elle se connecte d'abord.
3. La page d'autorisation affiche :
   - le nom de l'assistant et l'adresse où il recevra l'accès ;
   - le choix entre lecture seule, et lecture et écriture ;
   - ses jeux à cocher : ceux qu'elle possède, et ceux qu'on lui a partagés si leur propriétaire l'a permis (R5).
4. Elle autorise. L'assistant voit alors les outils de Limbus et peut s'en servir.

### Organisatrice : suivre et retirer

1. Dans son compte, la page « Assistants connectés » liste ses autorisations : l'assistant, la date, les droits, les jeux et le dernier usage.
2. Elle change les jeux d'une autorisation, ou la retire. Pour changer les droits, elle retire l'autorisation et en donne une nouvelle.
3. Elle consulte le journal des actions de ses assistants (R11).

### Propriétaire d'un jeu partagé

1. Dans le partage du jeu, un réglage « Les co-organisatrices peuvent y brancher une IA » est désactivé par défaut.
2. Elle y voit les autorisations qui donnent accès au jeu, la sienne comme celles des co-organisatrices, et le journal des actions des assistants sur ce jeu.
3. Désactiver le réglage, ou retirer une co-organisatrice du partage, coupe aussitôt l'accès des assistants de celle-ci à ce jeu.

## Règles métier

### Connexion et autorisation

- **R1 Protocole.** Limbus sert un serveur MCP (version stable du 28 juillet 2026, transport Streamable HTTP, sans état) sur une route hors de `/api/`. Il est protégé par OAuth 2.1, Limbus étant son propre serveur d'autorisation :
  - code d'autorisation avec PKCE S256, et jeton de rafraîchissement renouvelé à chaque usage ;
  - inscription des assistants par Client ID Metadata Document, et par inscription dynamique tant que des assistants en ont besoin ;
  - métadonnées de la ressource protégée et du serveur d'autorisation, paramètre `iss` dans la réponse ;
  - un jeton n'est accepté que s'il a été émis pour ce serveur ;
  - il est lu dans l'en-tête `Authorization: Bearer`, jamais dans l'URL. La route MCP n'accepte jamais le cookie de connexion.
- **R2 Page d'autorisation.**
  - Elle nomme l'assistant et affiche l'hôte de l'adresse de retour, avec un avertissement quand cette adresse est locale à l'appareil.
  - Elle est protégée contre la falsification de requête et ne s'affiche pas dans un cadre.
  - L'adresse de retour doit être exactement l'une de celles déclarées par l'assistant.
- **R3 Comptes.** Seul un compte confirmé, actif et à jour de ses conditions d'utilisation peut autoriser un assistant, et chaque appel le vérifie de nouveau. Les droits d'administration ne passent jamais par un assistant.
- **R4 Droits.** Une autorisation est soit en lecture seule, soit en lecture et écriture. Une autorisation en lecture seule ne propose aucun outil d'écriture, et le serveur refuse quand même toute écriture à son jeton.
- **R5 Jeux.** À chaque appel, l'assistant ne voit que les jeux qui remplissent les trois conditions :
  - ils sont cochés dans l'autorisation ;
  - ils sont encore accessibles au compte (propriété ou partage, [ADR-0038](../adr/ADR-0038-un-seul-role-global.md)) ;
  - pour un jeu partagé, le réglage de sa propriétaire permet les assistants des co-organisatrices.

  Un jeu créé par l'assistant s'ajoute aux jeux de son autorisation.
- **R6 Fin d'une autorisation.** Une autorisation s'arrête :
  - quand l'organisatrice la retire ;
  - après 90 jours sans usage ;
  - quand toutes les sessions du compte sont coupées (`revokeUserSessions` : déconnexion partout, changement de mot de passe, désactivation) ;
  - quand le compte est effacé.

  L'assistant reçoit alors un refus, et l'organisatrice doit autoriser de nouveau.

### Ce que l'assistant lit

- **R7 Lecture.** Sur les jeux de son autorisation, l'assistant lit :
  - le jeu (sans ses réglages de page publique, de photos ni de contact) ;
  - les personnages, factions, intrigues, objets, documents (texte), lieux, la chronologie et les relations entre personnages ;
  - les sessions : détails, équipe, casting, déroulé ;
  - les participants : nom et notes d'organisation du jeu ;
  - les périodes d'inscription, le formulaire, la sélection et le journal des tirages ;
  - les réponses aux formulaires dans les limites de R8.
- **R8 Jamais lu.**
  - Les coordonnées : email, téléphone, contact d'urgence.
  - Les allergies et intolérances, ainsi que tout ce qui touche aux paiements.
  - Tout texte libre écrit par un participant : les questions à texte libre, et le texte tapé des affinités et des relations refusées.
  - Ce qui est lu à la place :
    - les réponses fermées (choix, échelles, relations refusées cochées) ;
    - les affinités déjà traitées par l'équipe : une ligne rattachée à une personne du jeu apparaît comme ce lien, une ligne marquée « personne du jeu » comme telle. Une ligne non traitée n'apparaît pas.
  - Les fichiers (photos, PDF, RIB) ne sont jamais rendus.
- **R9 Réponses courtes.** Les outils de liste rendent des résumés paginés, et chaque fiche se lit par un outil à part. L'assistant ne reçoit jamais toute la base d'un coup.

### Ce que l'assistant écrit

- **R10 Écriture.** Avec une autorisation en lecture et écriture, sur les jeux de son autorisation, l'assistant peut :
  - créer un jeu et modifier un jeu, sauf ses réglages de page publique, de photos et de contact ;
  - créer, modifier et supprimer personnages, factions, intrigues, objets, documents (texte), lieux, événements de la chronologie et relations entre personnages ;
  - créer et modifier une session (détails, équipe, casting, déroulé), sans l'annuler, la reporter ni la supprimer ;
  - lancer l'assistant de casting d'une session ;
  - créer et modifier une fiche participant (nom et notes d'organisation du jeu). Le nom d'une fiche rattachée à un compte reste celui du compte ([ADR-0042](../adr/ADR-0042-coordonnees-du-compte.md)) ;
  - préparer une période d'inscription, qui reste fermée, et rédiger le formulaire du jeu ;
  - décider d'une inscription (retenue, en attente, non retenue) sans l'annoncer, et lancer ou annuler un tirage au sort.

  Chaque écriture porte la version de l'élément que l'assistant a lu, et elle est refusée si l'élément a changé entre-temps (`assertUnmodifiedSince`).
- **R11 Jamais fait.**
  - Rien ne part par email : invitations, relances, annonces, envoi des documents, présence, emails de test.
  - Rien n'est publié ni partagé : page publique, ouverture d'une période, lien de diffusion, partage, transfert ou legs d'un jeu.
  - Rien n'est supprimé au-delà de R10 : ni un jeu, ni une session, ni un participant. Une session n'est pas non plus annulée ni reportée.
  - Les paiements et les tarifs restent hors de portée.
  - Aucun fichier n'est téléversé.
- **R12 Règles communes.** Un outil applique les mêmes contrôles que l'interface :
  - accès au jeu ;
  - schéma de validation ;
  - références du même jeu ;
  - un élément ne change pas de jeu.

  Il appelle les mêmes fonctions serveur, jamais l'API HTTP.

### Suivi

- **R13 Journal.** Chaque écriture d'un assistant est notée :
  - le compte, l'assistant et l'autorisation ;
  - l'outil et l'élément (type, identifiant et nom) ;
  - le jeu et la date.

  Les autorisations données, modifiées, retirées ou expirées sont notées aussi. Les lectures ne le sont pas. Le journal est gardé un an.
  - L'organisatrice voit les actions de ses assistants.
  - La propriétaire d'un jeu voit toutes les actions des assistants sur ce jeu.
- **R14 Limite de débit.** Les appels sont comptés par autorisation, et non par adresse IP : tous les appels d'un même assistant viennent des mêmes machines. Les seuils sont fixés dans l'ADR du lot 1.
- **R15 Indications.** Chaque outil déclare s'il est en lecture seule ou destructeur. L'assistant s'en sert pour demander confirmation à l'organisatrice. Ce n'est qu'une aide : la sécurité tient à R4, R5, R8, R11 et R12.

## Données

- **Assistants** : ceux qui se sont présentés (identifiant, nom, adresses de retour). Ce n'est pas une donnée personnelle.
- **Autorisations** : compte, assistant, droits, jeux, date, dernier usage, date de retrait. Les jetons sont gardés sous forme d'empreinte. Elles sont effacées 90 jours après leur fin.
- **Réglage du jeu** : « Les co-organisatrices peuvent y brancher une IA », désactivé par défaut.
- **Journal** : il est gardé un an.
  - L'export du compte (`exportAccountData`) contient les autorisations du compte et le journal de ses assistants.
  - L'effacement du compte (`deleteOwnAccount`) supprime ses autorisations. Les lignes du journal restent visibles de la propriétaire du jeu, sans le nom de la personne.
  - Le journal d'un jeu disparaît avec le jeu.
- **Données envoyées à l'assistant** : ce que R7 et R8 permettent, dont les noms des participants et les notes d'organisation. C'est l'organisatrice qui choisit de les transmettre à un nouveau destinataire, le fournisseur de son assistant.
  - La politique de confidentialité le dit.
  - Les conditions d'utilisation lui en confient la base légale et l'information de ses joueurs.
  - Ce changement de fond crée une nouvelle `TERMS_VERSION` : chaque compte accepte de nouveau ([ADR-0055](../adr/ADR-0055-pages-legales-et-acceptation.md)).

## Sécurité et droits

- La route MCP et les points d'accès OAuth ne sont pas sous `/api/`. Le contrôle d'origine des écritures ([ADR-0053](../adr/ADR-0053-durcissement-web.md)) ne s'y applique pas : un assistant n'envoie pas d'en-tête d'origine. La protection vient du jeton Bearer, seul accepté. La page d'autorisation, elle, est une page de Limbus protégée comme les autres.
- Le jeton mène au compte, puis aux mêmes contrôles que l'interface (`requireGameAccess`, `gameScopedWhere`…), restreints aux jeux de l'autorisation (R5).
- Tests d'isolation (`tests/integration/isolation.test.ts`), avec chaque fois un témoin positif :
  - un assistant autorisé par Alice n'atteint rien du jeu de Bob ;
  - il n'atteint aucun jeu d'Alice non coché ;
  - il n'atteint aucun jeu partagé dont la propriétaire n'a pas activé le réglage.
- Injection d'instructions : R8 tient hors de portée de l'assistant tout texte écrit par un participant, et R11 lui retire tout moyen de faire sortir une information de Limbus.

## Hors périmètre

- Clé d'accès personnelle à copier, et API REST documentée : pas pour l'instant.
- Fichiers : téléversement et lecture de photos, PDF, RIB.
- Espace « Je participe » et administration.
- Gemini, tant qu'il ne prend pas en charge les connecteurs MCP distants.

## Découpage

À préciser en epics et US :

1. **Connexion et lecture** :
   - avant de coder, un essai du serveur d'autorisation écrit pour Limbus et un essai avec `oidc-provider`, comparés dans un ADR (l'utilisatrice tranche) ;
   - serveur d'autorisation, page d'autorisation, « Assistants connectés », réglage de la propriétaire ;
   - journal, limite de débit, politique de confidentialité et conditions d'utilisation ;
   - outils de lecture (R7 à R9) ;
   - essai de bout en bout avec Claude, ChatGPT et Mistral, avec les comptes de l'utilisatrice.
2. **Écriture du contenu d'un jeu** : jeu, personnages, factions, intrigues, objets, documents, lieux, chronologie, relations.
3. **Sessions, casting et participants** : sessions, casting, déroulé, assistant de casting, fiches participant.
4. **Inscriptions** : périodes fermées, formulaire, décisions, tirage au sort.

## Historique

- 2026-11-02 : création, avec les choix de l'utilisatrice.
