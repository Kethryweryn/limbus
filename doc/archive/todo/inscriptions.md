---
titre: Inscriptions, sélection et aide au casting
statut: prête
spec: ../../specs/SPEC-001-inscriptions.md
date: 2026-10-27
---

# Inscriptions, sélection et aide au casting

## Besoin

Selon le jeu et la session, les organisateurs recrutent leurs joueurs de plusieurs façons :

- **Invitation** : tous les participants sont invités directement, par email ou message.
- **Inscription** : les joueurs remplissent un formulaire. Il rappelle la note d'intention du jeu et pose :
  - des questions d'organisation : nom, prénom, email, nom Facebook si besoin, téléphone, contact d'urgence avec téléphone, intolérances et allergies alimentaires ;
  - des questions d'affinités : avec qui je veux jouer, avec qui je ne veux pas jouer, quelles relations je ne veux pas jouer, qui je ne veux pas croiser sur l'événement ;
  - parfois un questionnaire propre au jeu, qui aide les organisateurs à faire le lien avec les personnages.

Les inscriptions mènent ensuite à un casting :

- **au hasard** ;
- **choisi par les organisateurs** : les inscriptions servent alors de vivier, dans lequel les organisateurs puisent pour composer des sessions cohérentes au niveau des rôles ;
- **mixte** : par exemple, une partie au hasard et N invitations par organisateur.

Tout doit être paramétrable. L'outil doit aider à gérer les inscriptions, à répartir les inscrits dans les rôles, et à faire le casting en tenant compte des affinités entre joueurs et avec les rôles.

Existant à réutiliser :

- les participants n'ont pas de compte et sont rattachés aux jeux par `ParticipantGame` ;
- une session a des rôles (`SessionParticipant` : participant, orga, PNJ, cuisine) et des attributions personnage ↔ participant (`SessionAssignment`) ;
- les paiements (`SessionPayment`) et les envois de documents fonctionnent déjà, ainsi que la page publique du jeu.

## Proposition

### Campagne d'inscription

Une campagne est rattachée à **une ou plusieurs sessions du même jeu** :

- Le cas courant est une seule session.
- Plusieurs sessions servent quand les inscriptions forment un vivier à répartir entre elles. Dans ce cas, chaque inscrit indique ses disponibilités par session.

La campagne porte le paramétrage :

| Réglage | Valeurs |
|---|---|
| Entrée | **Invitation** (l'orga ajoute les personnes) ou **formulaire** public |
| Sélection | **Hasard**, **choix des orgas**, ou **mixte** : N places au hasard et N invitations par orga, ou un quota global |
| Calendrier | Ouverture, clôture, date du tirage |
| Places | Par défaut le nombre de rôles PJ, modifiable ; liste d'attente activable |
| Formulaire | Celui du jeu à utiliser |

Même en mode invitation, chaque personne reçoit un **lien personnel** pour confirmer sa venue et remplir les informations d'organisation. Les deux modes aboutissent donc au même objet : l'inscription.

### Formulaire, défini au niveau du jeu

Un même formulaire sert pour toutes les sessions du jeu. Il contient :

- **la note d'intention** en ouverture, avec une case « j'ai lu et j'adhère » ;
- **les champs standards**, chacun activable et obligatoire ou non : nom, prénom, email, nom Facebook, téléphone, contact d'urgence (nom et téléphone), allergies et intolérances ;
- **les affinités** :
  - avec qui je veux jouer ;
  - avec qui je ne veux pas jouer ;
  - les relations que je ne veux pas jouer (romance, famille, violence…) ;
  - les personnes que je ne veux pas croiser sur l'événement ;
- **des questions propres au jeu**, en texte libre, choix unique ou multiple, ou échelle de 1 à 5. Chaque option de réponse peut être reliée à des personnages, factions ou intrigues : c'est ce qui alimente l'aide au casting.

Les réponses sont figées avec la version du formulaire qui a été remplie : modifier le formulaire après coup ne casse pas les inscriptions existantes.

### Inscription

Statuts successifs :

1. reçue, une fois l'email confirmé ;
2. retenue, en attente ou non retenue ;
3. confirmée ;
4. éventuellement désistée.

Une inscription confirmée devient un `SessionParticipant` et déclenche le circuit de paiement existant.

### Aide au casting

**1. Sélection des joueurs** (modes hasard et mixte)

- Le tirage au sort est reproductible : la graine et le résultat sont journalisés, si bien qu'un tirage peut être vérifié en cas de contestation.
- Des alertes signalent les incompatibilités entre personnes retenues, par exemple : « A ne veut pas croiser B ».

**2. Répartition dans les rôles**

Pour chaque paire joueur ↔ personnage, l'outil calcule un score **expliqué**, à partir de :

- les réponses au questionnaire reliées aux rôles ;
- les affinités entre joueurs, comparées aux liens entre personnages (même faction, même intrigue, relation directe) ;
- les relations refusées, qui sont des contraintes bloquantes.

Les attributions verrouillées par les orgas sont respectées. Le moteur propose une répartition, mais n'applique jamais rien seul. Exemple d'explication :

> Alice → la Comtesse : +3 (« intrigues politiques »), +2 (joue avec Bob, même faction) ; ⚠ relation romance avec le Baron, qu'elle refuse

Pour 20 à 80 joueurs, deux étapes suffisent et s'exécutent instantanément : une affectation optimale sur le score individuel (algorithme hongrois), puis des échanges successifs pour tenir compte des contraintes entre paires.

**Brique manquante** : des **relations typées entre personnages** (romance, famille, rivalité, alliance, hiérarchie…). Sans elles, on ne peut pas vérifier qu'un joueur n'hérite pas d'une relation qu'il refuse.

### Données personnelles

- Les allergies sont des données de santé (art. 9 du RGPD) : leur saisie demande un consentement explicite.
- Les nouvelles données doivent être couvertes par `eraseParticipant` et `exportParticipantData`, comme le prévoit CLAUDE.md.
- Les affinités sont strictement réservées aux organisateurs du jeu, et ne sont jamais montrées aux autres joueurs.
- Les routes publiques (formulaire, lien personnel) passent sous `public/*`. Elles sont protégées par un jeton, une limitation de débit et un champ piège, et toutes doivent figurer dans `isolation.test.ts`.

## Découpage envisagé

Chaque lot est livrable seul : après le lot 1, on peut organiser une session sur invitation ; après le lot 3, une session ouverte au public.

1. **Campagne et mode invitation**
   - Modèle de campagne rattaché aux sessions, avec les réglages ci-dessus.
   - L'orga ajoute des participants, qui reçoivent un email avec un lien personnel. Ils confirment ou déclinent, et remplissent les champs standards.
   - Liste des inscriptions côté orga, avec leurs statuts.
   - Le passage à « confirmée » alimente la session et les paiements.
   - Couverture par l'export et la suppression RGPD, et tests d'isolation.
2. **Formulaire public**
   - Construction du formulaire au niveau du jeu.
   - Page publique d'inscription, accessible depuis la page publique du jeu.
   - Confirmation de l'email par lien, et consentement explicite pour les allergies.
   - Protection contre les abus.
   - Modification de son inscription par le lien personnel, jusqu'à la clôture.
   - Export CSV.
3. **Sélection**
   - Tirage au sort journalisé, choix des orgas, et mode mixte avec quotas.
   - Liste d'attente, avec promotion automatique ou manuelle en cas de désistement.
   - Emails aux personnes retenues, en attente et non retenues.
4. **Affinités**
   - Les noms saisis librement sont rapprochés des inscrits, avec des suggestions.
   - Matrice des affinités, réservée aux orgas.
   - Alertes d'incompatibilité dans la sélection, et entre les sessions d'une même campagne.
5. **Relations entre personnages et questionnaire relié aux rôles**
   - Relations typées entre personnages, avec une vue graphique simple.
   - Liens entre les options du questionnaire et les personnages, factions ou intrigues.
6. **Assistant de casting**
   - Scores expliqués et proposition de répartition.
   - Verrous sur les attributions fixées par les orgas.
   - Application des choix aux attributions de session.

## Décisions (2026-10-27)

Fiche transformée en [SPEC-001](../../specs/SPEC-001-inscriptions.md). Réponses de l'utilisateur aux points ouverts :

1. Vivier sur plusieurs sessions : oui, prévu dans le modèle dès le lot 1.
2. Reconnaissance d'un joueur : par email, parmi les participants des jeux de la même propriétaire.
3. Mode mixte : invitations des orgas d'abord, puis tirage sur les places restantes ; quota par organisateur ou global, au choix pour chaque campagne.
4. Allergies et contact d'urgence : sur l'inscription, avec une fiche allergies pour la cuisine.
5. Recrutement : PJ seulement ; PNJ et cuisine restent ajoutés à la main.
6. Liste d'attente : l'outil propose la personne suivante, l'orga valide.
7. Confirmation : obligatoire pour une personne retenue, avec un délai réglable.
8. Visibilité des affinités et réponses : tous les organisateurs du jeu.
9. Rejoueurs : réglage par campagne (autorisé, signalé, exclu du tirage).
10. Tirage : pondérations possibles, « non tirés avant » et équilibre (parité) ; pas de priorité aux nouveaux joueurs, pas de groupes.
11. Modification par l'inscrit : oui, jusqu'à la clôture.
12. Pas d'autre ajustement de la proposition.
