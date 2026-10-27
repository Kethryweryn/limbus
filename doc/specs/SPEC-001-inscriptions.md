---
id: SPEC-001
titre: Inscriptions, sélection et aide au casting
statut: validée
date: 2026-10-27
origine: ../archive/todo/inscriptions.md
epics: [EPIC-001]
adr: [ADR-0007, ADR-0008, ADR-0011]
---

# SPEC-001 : Inscriptions, sélection et aide au casting

## Objectif

Permettre aux organisateurs de recruter les joueurs d'une ou plusieurs sessions :

- par invitation directe ou par formulaire public ;
- avec une sélection au hasard, choisie ou mixte ;
- puis de répartir les joueurs retenus dans les sessions et les rôles, avec une aide fondée sur les affinités entre joueurs et avec les personnages.

## Vocabulaire

- **Période d'inscription** : le recrutement des PJ d'une ou plusieurs sessions d'un même jeu, avec son paramétrage.
- **Formulaire** : les questions posées aux inscrits. Il est défini au niveau du jeu.
- **Inscription** : la candidature d'une personne à une période d'inscription, avec ses réponses et son statut.
- **Lien personnel** : l'URL secrète par laquelle un inscrit, qui n'a pas de compte, consulte et modifie son inscription.

« Campagne » n'est pas employé ici : en GN, ce mot désigne une série de jeux dans un même continuum.

## Acteurs

- **Organisateurs du jeu** : la propriétaire et les co-organisateurs (`GameShare`). Ils ont tous les mêmes droits sur les périodes d'inscription, les inscriptions, les affinités et les réponses.
- **Inscrit** : une personne sans compte, qui agit uniquement par la page publique et son lien personnel.
- **Équipe cuisine** : elle reçoit la fiche allergies de sa session.

## Parcours

### Organisateur : préparer une période d'inscription

1. Depuis la page « Inscriptions » du menu Organisation (R33), il crée la période d'inscription d'un jeu : pour une ou plusieurs sessions précises, ou pour tout le jeu (inscription permanente).
2. Il choisit le mode d'entrée, le mode de sélection, le calendrier, les places par session, le délai de confirmation et le traitement des rejoueurs.
3. Il choisit le formulaire du jeu, ou le crée.
4. Il ouvre la période d'inscription. En mode formulaire, il copie le lien de diffusion pour ses annonces, et un lien d'inscription apparaît sur la page publique du jeu.

### Inscrit, mode formulaire

1. Il ouvre le formulaire depuis le lien de diffusion partagé par les orgas (annonce sur un réseau social, par exemple), ou depuis la page publique du jeu. Il y lit la note d'intention, coche son adhésion, puis remplit les champs.
2. Il reçoit un email de confirmation. Le lien qu'il contient valide son adresse et lui sert ensuite de lien personnel.
3. Jusqu'à la clôture, il peut modifier son inscription ou la retirer par ce lien.

### Inscrit, mode invitation

1. L'organisateur ajoute la personne (participant existant, ou nom et email).
2. Elle reçoit un email avec son lien personnel. Elle y remplit le formulaire et accepte l'invitation, ce qui confirme sa place, ou la décline. Elle a pour cela le délai de confirmation de la période d'inscription.

### Sélection et confirmation

1. À la clôture, ou quand l'organisateur le décide, la sélection a lieu selon le mode choisi : invitations des orgas, tirage, ou les deux. Chaque inscription passe à **retenue**, **en attente** ou **non retenue**, et la personne est prévenue par email.
2. Une personne retenue confirme sa place par son lien personnel, dans le délai fixé.
3. Une fois confirmée, elle rejoint la session comme participant, et le circuit de paiement existant prend le relais.
4. Si une place se libère (désistement ou délai dépassé), l'outil propose la personne suivante de la liste d'attente, et l'organisateur valide avant que l'email parte.

### Organisateur : répartir

1. Dans une période d'inscription à plusieurs sessions, il place chaque personne retenue dans une session où elle est disponible.
2. Il attribue les personnages, aidé par les scores et les alertes de l'assistant de casting.

## Règles métier

### Période d'inscription

- **R1** Une période d'inscription appartient à un jeu. Elle couvre :
  - soit **des sessions précises**, une ou plusieurs ;
  - soit **tout le jeu** : c'est l'inscription permanente (R30).

  Une session est couverte par au plus une période d'inscription : sa période dédiée si elle en a une, sinon l'inscription permanente du jeu si elle existe.
- **R2** Une période d'inscription ne recrute que des PJ. Les PNJ et l'équipe cuisine restent ajoutés à la main dans la session.
- **R3** Mode d'entrée : `invitation` ou `formulaire`.
- **R4** Mode de sélection : `hasard`, `choix` ou `mixte`. En mode mixte :
  - la part choisie est soit **N invitations par organisateur**, soit **un quota global**, au choix pour chaque période d'inscription ;
  - les invitations des orgas sont attribuées d'abord, puis le tirage porte sur les places restantes.
- **R5** Le nombre de places d'une session vaut par défaut le nombre de personnages PJ du jeu ; il est modifiable session par session.
- **R6** Le formulaire n'accepte d'inscriptions qu'entre l'ouverture et la clôture de la période d'inscription.
- **R7** Rejoueurs : un participant qui a déjà joué le jeu (participant d'une session terminée de ce jeu) est, selon le réglage de la période d'inscription :
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
- **R10** Dans une période d'inscription qui couvre plusieurs sessions précises, le formulaire liste ces sessions et l'inscrit indique celles où il est disponible (au moins une). L'inscription permanente ne demande pas de disponibilités.

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

  En mode invitation, une inscription commence au statut `invitée`. Accepter l'invitation, formulaire rempli, vaut confirmation : elle passe directement à `confirmée`. La décliner la fait passer à `désistée`.
- **R17** Le tirage au sort est équiprobable, sauf pondérations activées dans la période d'inscription :
  - **non tirés avant** : priorité aux personnes non retenues lors d'une période d'inscription précédente du même jeu ;
  - **équilibre** : les personnages peuvent porter un attribut d'équilibre (par exemple le genre du personnage) et la question d'équilibre du formulaire demande la préférence de l'inscrit. Le tirage réserve alors les places par valeur, au prorata des rôles.
- **R18** Le tirage est reproductible : la graine, les pondérations et le résultat sont journalisés avec l'auteur et la date, et consultables par les orgas.
- **R19** La liste d'attente suit l'ordre du tirage, ou l'ordre fixé par les orgas en mode choix.
- **R20** Une personne retenue doit confirmer dans le délai de la période d'inscription (réglable, 7 jours par défaut), de même qu'une personne invitée doit répondre dans ce délai. Passé ce délai, l'inscription est signalée « délai dépassé » aux orgas, qui libèrent la place (R21) ou prolongent le délai.
- **R21** Quand une place se libère, l'outil propose la personne suivante de la liste d'attente ; l'organisateur valide avant tout email.
- **R22** Une inscription confirmée crée le `SessionParticipant` (rôle participant) de la session où la personne est placée. Elle entre dans le circuit de paiement dès ce moment, même si aucun personnage ne lui est encore attribué. Aujourd'hui, le tableau des paiements ne liste que les participants ayant un personnage PJ : il doit lister aussi les inscrits confirmés.

  Un désistement après confirmation :
  - retire le `SessionParticipant` et libère le personnage éventuellement attribué dans cette session ;
  - laisse le paiement éventuel à traiter à la main.

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

### Inscription permanente et diffusion

- **R30** L'inscription permanente d'un jeu est une période d'inscription qui couvre toutes ses sessions, présentes et futures, sauf celles qui ont leur propre période d'inscription (R1). Elle se distingue d'une période ordinaire sur ces points :
  - un jeu en a au plus une ouverte à la fois ;
  - elle est toujours en mode formulaire et n'a pas de date de clôture : les orgas la clôturent à la main ;
  - les inscrits forment un vivier, sans disponibilités (R10). Pour chaque session, les orgas choisissent dans ce vivier les personnes à retenir (mode choix), qui confirment ensuite dans le délai (R20) ;
  - le réglage des rejoueurs (R7) s'applique au vivier : après avoir joué une session, un inscrit reste dans le vivier, y est signalé ou en est exclu, selon ce réglage.
- **R31** Rattacher une session à une période d'inscription dédiée la retire de l'inscription permanente. C'est refusé si des inscrits du vivier ont déjà été retenus pour cette session.
- **R32** Chaque période d'inscription en mode formulaire a un **lien de diffusion** : une URL publique, stable et courte, que les orgas copient pour leurs annonces (réseaux sociaux, email, site). Ce lien :
  - ouvre le formulaire, même si la page publique du jeu n'est pas activée ;
  - fournit un aperçu pour les réseaux sociaux (balises Open Graph : nom du jeu, sessions concernées et leurs dates, début de la note d'intention) ;
  - affiche « inscriptions closes » une fois la période clôturée, au lieu d'une erreur.

### Place dans l'application

- **R33** Les inscriptions relèvent de l'**organisation**, pas de l'écriture du jeu :
  - le menu de gauche a une entrée « Inscriptions » dans la section Organisation, juste au-dessus de « Participants » ;
  - elle mène à une page qui liste les périodes d'inscription, regroupées par jeu, avec pour chaque jeu l'accès à son formulaire d'inscription. Elle suit le jeu actif comme les autres pages d'organisation ; sans jeu actif, un filtre par jeu est proposé ;
  - les pages d'écriture (fiche du jeu, personnages…) n'affichent rien des inscriptions.

## Données

À créer, en plus de l'existant :

- **Période d'inscription** : jeu, portée (sessions précises ou tout le jeu), sessions, identifiant public du lien de diffusion, modes, calendrier, places par session, délai de confirmation, traitement des rejoueurs, pondérations, quota, formulaire.
- **Formulaire** et ses versions : champs standards activés, questions, options, liens vers les personnages, factions et intrigues.
- **Inscription** :
  - période d'inscription, participant, statut, source (formulaire ou invitation, et organisateur invitant) ;
  - identité saisie, contact d'urgence, allergies, consentement daté ;
  - réponses, disponibilités, session attribuée ;
  - jeton hashé, rang au tirage, dates de confirmation.
- **Affinité** : inscription, type, texte saisi, cible rapprochée.
- **Tirage** : période d'inscription, graine, pondérations, résultat, auteur, date.
- **Relation entre personnages** : deux personnages, type, description.
- **Attribut d'équilibre** facultatif sur un personnage.

Données personnelles :

- inscriptions, affinités (dans les deux sens), réponses et consentements sont couverts par `eraseParticipant` et `exportParticipantData` ([ADR-0011](../adr/ADR-0011-donnees-des-participants.md)) ;
- effacer un participant supprime aussi les affinités qui le visent.

## Sécurité et droits

- Les routes d'organisation suivent [ADR-0007](../adr/ADR-0007-isolation-par-jeu.md) et sont ajoutées à `isolation.test.ts`. Les sessions rattachées à une période d'inscription et les personnages ciblés doivent appartenir au jeu de la période d'inscription.
- Les routes de l'inscrit sont sous `public/*`, et protégées ainsi :
  - formulaire : limitation de débit par IP, champ piège, période d'ouverture vérifiée côté serveur ;
  - lien personnel : jeton comparé à son hash, limitation de débit.
- Une réponse publique ne révèle jamais si un email est déjà inscrit : le message est identique, et l'email de confirmation part dans tous les cas.
- Les emails passent par `absoluteAppUrl()`.

## Découpage

Chaque lot devient un epic, livrable seul :

1. Période d'inscription et mode invitation (R1 à R3, R5, R6, R8 pour la note d'intention et les champs standards, R12 à R16, R20, R22, R33). Voir [EPIC-001](../epics/EPIC-001-inscription-sur-invitation/README.md).
2. Formulaire public, inscription permanente et lien de diffusion (R8 au complet, R9 à R11, R13, R30 à R32). L'epic 1 prévoit déjà la portée dans le modèle.
3. Sélection (R4, R7, R17 à R21).
4. Affinités (R23 à R25).
5. Relations entre personnages et questionnaire relié aux rôles (R8, R26).
6. Assistant de casting (R27 à R29).

## Hors périmètre

- Recrutement des PNJ et de l'équipe cuisine (R2).
- Comptes participants, et paiement en ligne.
- Resynchronisation des écritures hors ligne : les écrans d'inscription demandent une connexion.

## Historique

- 2026-10-27 : création à partir de la fiche todo.
- 2026-10-27 : « campagne » renommé « période d'inscription » (le mot a un autre sens en GN). En mode invitation, accepter vaut confirmation (R16). Un délai dépassé est signalé, puis traité par les orgas (R20). Les inscrits confirmés sans personnage apparaissent dans les paiements (R22). La fiche allergies (R15) passe au lot 1, qui collecte les allergies.
- 2026-10-28 : les orgas annoncent leurs jeux et sessions avec un lien vers le formulaire, valable pour une session, quelques sessions, ou tout le jeu. Ajout de l'inscription permanente, qui couvre toutes les sessions présentes et futures (R1, R10, R30, R31), et du lien de diffusion avec aperçu pour les réseaux sociaux (R32).
- 2026-10-28 : les inscriptions quittent la fiche du jeu pour une page « Inscriptions » dans la section Organisation du menu (R33) ; la fiche du jeu sert à l'écriture.
