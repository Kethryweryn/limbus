---
id: SPEC-001
titre: Inscriptions, sélection et aide au casting
statut: validée
date: 2026-10-27
origine: ../archive/todo/inscriptions.md
epics: []
adr: [ADR-0007, ADR-0008, ADR-0011]
---

# SPEC-001 : Inscriptions, sélection et aide au casting

## Objectif

Permettre aux organisateurs de recruter les joueurs d'une ou plusieurs sessions :

- par invitation directe ou par formulaire public ;
- avec une sélection au hasard, choisie ou mixte ;
- puis de répartir les joueurs retenus dans les sessions et les rôles, avec une aide fondée sur les affinités entre joueurs et avec les personnages.

## Vocabulaire

- **Campagne** : le recrutement des PJ d'une ou plusieurs sessions d'un même jeu, avec son paramétrage.
- **Formulaire** : les questions posées aux inscrits. Il est défini au niveau du jeu.
- **Inscription** : la candidature d'une personne à une campagne, avec ses réponses et son statut.
- **Lien personnel** : l'URL secrète par laquelle un inscrit, qui n'a pas de compte, consulte et modifie son inscription.

## Acteurs

- **Organisateurs du jeu** : la propriétaire et les co-organisateurs (`GameShare`). Ils ont tous les mêmes droits sur les campagnes, les inscriptions, les affinités et les réponses.
- **Inscrit** : une personne sans compte, qui agit uniquement par la page publique et son lien personnel.
- **Équipe cuisine** : elle reçoit la fiche allergies de sa session.

## Parcours

### Organisateur : préparer une campagne

1. Il crée la campagne depuis le jeu et y rattache une ou plusieurs sessions.
2. Il choisit le mode d'entrée, le mode de sélection, le calendrier, les places par session, le délai de confirmation et le traitement des rejoueurs.
3. Il choisit le formulaire du jeu, ou le crée.
4. Il ouvre la campagne. En mode formulaire, un lien d'inscription apparaît sur la page publique du jeu.

### Inscrit, mode formulaire

1. Depuis la page publique du jeu, il ouvre le formulaire. Il y lit la note d'intention, coche son adhésion, puis remplit les champs.
2. Il reçoit un email de confirmation. Le lien qu'il contient valide son adresse et lui sert ensuite de lien personnel.
3. Jusqu'à la clôture, il peut modifier son inscription ou la retirer par ce lien.

### Inscrit, mode invitation

1. L'organisateur ajoute la personne (participant existant, ou nom et email).
2. Elle reçoit un email avec son lien personnel. Elle y accepte ou décline l'invitation, puis remplit le formulaire.

### Sélection et confirmation

1. À la clôture, ou quand l'organisateur le décide, la sélection a lieu selon le mode choisi : invitations des orgas, tirage, ou les deux. Chaque inscription passe à **retenue**, **en attente** ou **non retenue**, et la personne est prévenue par email.
2. Une personne retenue confirme sa place par son lien personnel, dans le délai fixé.
3. Une fois confirmée, elle rejoint la session comme participant, et le circuit de paiement existant prend le relais.
4. Si une place se libère (désistement ou délai dépassé), l'outil propose la personne suivante de la liste d'attente, et l'organisateur valide avant que l'email parte.

### Organisateur : répartir

1. Dans une campagne à plusieurs sessions, il place chaque personne retenue dans une session où elle est disponible.
2. Il attribue les personnages, aidé par les scores et les alertes de l'assistant de casting.

## Règles métier

### Campagne

- **R1** Une campagne appartient à un jeu et regroupe une ou plusieurs de ses sessions. Une session appartient à au plus une campagne.
- **R2** Une campagne ne recrute que des PJ. Les PNJ et l'équipe cuisine restent ajoutés à la main dans la session.
- **R3** Mode d'entrée : `invitation` ou `formulaire`.
- **R4** Mode de sélection : `hasard`, `choix` ou `mixte`. En mode mixte :
  - la part choisie est soit **N invitations par organisateur**, soit **un quota global**, au choix pour chaque campagne ;
  - les invitations des orgas sont attribuées d'abord, puis le tirage porte sur les places restantes.
- **R5** Le nombre de places d'une session vaut par défaut le nombre de personnages PJ du jeu ; il est modifiable session par session.
- **R6** Le formulaire n'accepte d'inscriptions qu'entre l'ouverture et la clôture de la campagne.
- **R7** Rejoueurs : un participant qui a déjà joué le jeu (participant d'une session terminée de ce jeu) est, selon le réglage de la campagne :
  - `autorisé` ;
  - `signalé` aux orgas ;
  - `exclu` du tirage. Il reste alors sélectionnable par choix.

### Formulaire

- **R8** Le formulaire est défini au niveau du jeu et contient :
  - la note d'intention, suivie d'une case d'adhésion obligatoire ;
  - les champs standards, chacun activable et rendu obligatoire ou non : nom, prénom, email (toujours obligatoire), nom Facebook, téléphone, contact d'urgence (nom et téléphone), allergies et intolérances ;
  - les affinités : avec qui je veux jouer, avec qui je ne veux pas jouer, les relations que je ne veux pas jouer, les personnes que je ne veux pas croiser ;
  - des questions propres au jeu (texte libre, choix unique, choix multiple, échelle de 1 à 5), dont chaque option peut être reliée à des personnages, factions ou intrigues ;
  - une question d'équilibre facultative (R17).
- **R9** Une inscription garde la version du formulaire qui a été remplie : modifier le formulaire ne change pas les réponses déjà données.
- **R10** Dans une campagne à plusieurs sessions, l'inscrit indique les sessions où il est disponible (au moins une).

### Inscription et identité

- **R11** Une inscription par formulaire n'est **reçue** qu'une fois l'email confirmé par le lien envoyé. Une inscription non confirmée sous 7 jours est supprimée.
- **R12** L'inscrit est rapproché d'un participant existant par son email, sans tenir compte de la casse, mais seulement parmi les participants liés aux jeux de la même propriétaire. Sinon, un nouveau participant est créé et lié au jeu. Un même email chez une autre équipe donne une fiche distincte.
- **R13** Le lien personnel permet de consulter, modifier ou retirer l'inscription jusqu'à la clôture ; il permet ensuite seulement de confirmer sa place ou de se désister. Le jeton est aléatoire, stocké sous forme de hash, et propre à chaque inscription.
- **R14** Allergies, intolérances et contact d'urgence sont rattachés à l'inscription, pas au participant. La saisie des allergies demande un consentement explicite, car ce sont des données de santé.
- **R15** Chaque session dispose d'une fiche allergies (nom et allergies des participants confirmés), destinée à l'équipe cuisine.

### Sélection

- **R16** Statuts d'une inscription :
  - `en attente de confirmation d'email` → `reçue` ;
  - après la sélection : `retenue`, `en attente` ou `non retenue` ;
  - une inscription retenue devient `confirmée`, ou `désistée` ;
  - une inscription en attente peut à son tour devenir retenue.

  En mode invitation, une invitation acceptée est directement `retenue` ; une invitation déclinée est `désistée`.
- **R17** Le tirage au sort est équiprobable, sauf pondérations activées dans la campagne :
  - **non tirés avant** : priorité aux personnes non retenues lors d'une campagne précédente du même jeu ;
  - **équilibre** : les personnages peuvent porter un attribut d'équilibre (par exemple le genre du personnage) et la question d'équilibre du formulaire demande la préférence de l'inscrit. Le tirage réserve alors les places par valeur, au prorata des rôles.
- **R18** Le tirage est reproductible : la graine, les pondérations et le résultat sont journalisés avec l'auteur et la date, et consultables par les orgas.
- **R19** La liste d'attente suit l'ordre du tirage, ou l'ordre fixé par les orgas en mode choix.
- **R20** Une personne retenue doit confirmer dans le délai de la campagne (réglable, 7 jours par défaut). Passé ce délai, sa place est libérée.
- **R21** Quand une place se libère, l'outil propose la personne suivante de la liste d'attente ; l'organisateur valide avant tout email.
- **R22** Une inscription confirmée crée le `SessionParticipant` (rôle participant) de la session où la personne est placée, ce qui la fait entrer dans le circuit de paiement. Un désistement après confirmation retire le `SessionParticipant` ; le paiement éventuel est traité à la main.

### Affinités et casting

- **R23** Les affinités sont saisies en texte libre ; les orgas les rapprochent des inscrits ou des participants, avec des suggestions par similarité de nom.
- **R24** Affinités et réponses au questionnaire sont visibles par tous les organisateurs du jeu, jamais par les inscrits, et n'apparaissent dans aucun document envoyé.
- **R25** Alertes : deux personnes dont l'une ne veut pas croiser l'autre, retenues pour la même session, font apparaître une alerte dans la sélection et dans la répartition entre sessions.
- **R26** Les personnages peuvent être reliés entre eux par des relations typées (romance, famille, rivalité, alliance, hiérarchie, autre), avec une description.
- **R27** Pour chaque paire joueur ↔ personnage, l'assistant calcule un score dont chaque composante est affichée :
  - réponses au questionnaire reliées au personnage ;
  - affinités « veut jouer avec » satisfaites par des personnages liés (même faction, même intrigue, relation directe).
- **R28** Deux situations sont des contraintes bloquantes, signalées comme telles :
  - une relation que le joueur refuse de jouer ;
  - un personnage lié à celui d'une personne avec qui il ne veut pas jouer.
- **R29** Les attributions verrouillées par les orgas sont respectées. L'assistant propose une répartition, mais ne l'applique qu'à la demande explicite de l'organisateur.

## Données

À créer, en plus de l'existant :

- **Campagne** : jeu, sessions, modes, calendrier, places par session, délai de confirmation, traitement des rejoueurs, pondérations, quota, formulaire.
- **Formulaire** et ses versions : champs standards activés, questions, options, liens vers les personnages, factions et intrigues.
- **Inscription** :
  - campagne, participant, statut, source (formulaire ou invitation, et organisateur invitant) ;
  - identité saisie, contact d'urgence, allergies, consentement daté ;
  - réponses, disponibilités, session attribuée ;
  - jeton hashé, rang au tirage, dates de confirmation.
- **Affinité** : inscription, type, texte saisi, cible rapprochée.
- **Tirage** : campagne, graine, pondérations, résultat, auteur, date.
- **Relation entre personnages** : deux personnages, type, description.
- **Attribut d'équilibre** facultatif sur un personnage.

Données personnelles :

- inscriptions, affinités (dans les deux sens), réponses et consentements sont couverts par `eraseParticipant` et `exportParticipantData` ([ADR-0011](../adr/ADR-0011-donnees-des-participants.md)) ;
- effacer un participant supprime aussi les affinités qui le visent.

## Sécurité et droits

- Les routes d'organisation suivent [ADR-0007](../adr/ADR-0007-isolation-par-jeu.md) et sont ajoutées à `isolation.test.ts`. Les sessions rattachées à une campagne et les personnages ciblés doivent appartenir au jeu de la campagne.
- Les routes de l'inscrit sont sous `public/*`, et protégées ainsi :
  - formulaire : limitation de débit par IP, champ piège, période d'ouverture vérifiée côté serveur ;
  - lien personnel : jeton comparé à son hash, limitation de débit.
- Une réponse publique ne révèle jamais si un email est déjà inscrit : le message est identique, et l'email de confirmation part dans tous les cas.
- Les emails passent par `absoluteAppUrl()`.

## Découpage

Chaque lot devient un epic, livrable seul :

1. Campagne et mode invitation (R1 à R6, R12 à R14, R16, R20, R22).
2. Formulaire public (R8 à R11, R13, R15).
3. Sélection (R4, R7, R17 à R21).
4. Affinités (R23 à R25).
5. Relations entre personnages et questionnaire relié aux rôles (R8, R26).
6. Assistant de casting (R27 à R29).

## Hors périmètre

- Recrutement des PNJ et de l'équipe cuisine (R2).
- Comptes participants, et paiement en ligne.
- Resynchronisation des écritures hors ligne : les écrans d'inscription demandent une connexion.
