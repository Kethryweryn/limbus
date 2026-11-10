---
titre: Plusieurs tests de bout en bout par écran
statut: archivée
date: 2026-11-09
epic: ../epics/EPIC-050-tests-par-ecran/README.md
---

# Plusieurs tests de bout en bout par écran

## Besoin

En déroulant son cahier de tests, l'utilisatrice constate que beaucoup de fonctionnalités anciennes n'ont aucun test automatique, quand celles écrites depuis la reprise en ont plusieurs. Le 2026-11-09, la suite Playwright joue 94 tests (CI de la PR #187) pour 43 écrans. Un écran ancien en a un ou deux. Par exemple, Lieux, Groupes, Intrigues et Objets n'ont que « créer, renommer, supprimer » et « supprimer depuis la fiche ». La recherche, les filtres, les archives, la pagination, les liens entre éléments, les erreurs de saisie, les droits et le hors ligne n'y sont vérifiés par aucun test de bout en bout. Les routes, elles, sont couvertes par les tests d'intégration (`tests/integration/`), mais pas l'écran qui les appelle.

## Proposition

Chaque écran a plusieurs tests Playwright, tirés des règles de sa spec et de ce qu'on y voit, sur quatre axes (choix de l'utilisatrice, 2026-11-09) :

- **Actions** : chaque bouton, filtre, recherche, lien entre éléments, onglet et changement de page de la liste.
- **Erreurs de saisie** : champ obligatoire vide, valeur refusée ; le message attendu s'affiche, et rien n'est écrit.
- **Droits** : la co-organisatrice fait ce que la propriétaire fait, sauf ce qui lui est réservé. Une organisatrice sans accès voit « introuvable ». Une participante n'atteint pas l'espace d'organisation. L'administratrice n'a accès à tout qu'en mode administrateur.
- **Hors ligne** : l'écran se relit sans réseau. Une modification part au retour du réseau, pour les écrans dont les écritures sont mises en file (SPEC-010, R1 et R5).

Les tests suivent `.claude/rules/tests.md` : chaque test crée ses données, écrit à des adresses qui lui sont propres, et attend `networkidle` avant de remplir un formulaire. Après une navigation dans l'application, il attend le titre principal (`h1`) de la page arrivée, car la page quittée reste affichée tant que la suivante charge.

### Écriture d'un jeu (SPEC-002, SPEC-003, SPEC-009)

Existant : chaque élément se crée, se renomme et se supprime (`writing.spec.ts`), et se supprime aussi depuis sa fiche ; la PR #188 y ajoute l'ouverture depuis la carte, au clic et par Entrée. S'y ajoutent une introuvable pour documents et timeline, le jeu qui se crée, se renomme et se partage, et le legs (`bequest.spec.ts`).

| Écran | À ajouter |
|---|---|
| Listes (jeux, personnages, groupes, intrigues, objets, documents, lieux) | Recherche par nom et par champ secondaire ; filtre par jeu et barre du jeu actif ; « Afficher les archives » ; pagination (une page de plus que la taille de la liste : 5 jeux, 6 personnages, 9 pour les autres ; page 2, retour à la page 1 après une recherche) ; formulaire de création : nom vide refusé, jeu imposé quand un jeu est actif |
| Jeux | Archiver et restaurer (le contenu suit, R3) ; publier et dépublier la page publique (R1, R3, R4) ; jeu actif choisi depuis sa carte ; supprimer un jeu et tout son contenu (R4) ; teaser : lien non http(s) refusé, YouTube intégré (R1, R15) ; co-organisatrice : modifie, mais ne supprime pas, ne partage pas et ne lègue pas (R16, R17) ; quitter un jeu partagé (SPEC-011, R2) ; transfert de propriété proposé puis accepté (SPEC-011, R3) |
| Personnage | Type PJ ou PNJ ; histoire en texte ou en lien ; groupes et intrigues associés depuis la fiche ; relations (ajout, sens, suppression) ; réglages du trombinoscope (exclusion, visage caché, nom affiché) ; photo par défaut |
| Groupe | Membres et intrigues ; « afficher dans le trombinoscope » (SPEC-005, R2) ; suppression qui laisse les personnages (R14) |
| Intrigue | Niveaux et tri par niveau (R9) ; liens aux personnages, groupes et objets |
| Objet | Quantité (moins de 1 refusée, R10) ; emplacement en texte ou porté par un personnage ; badge « Non associé » |
| Document | Contenu ou lien, au moins l'un des deux (R11) ; public par rôles et par personnages ; « prêt à envoyer » ; retour à la liste à l'endroit quitté |
| Lieu | Adresse et notes affichées et cherchées ; un lieu utilisé par une session reste lié après renommage |
| Timeline | Jours et heures, tri ; personnages, intrigues et lieux liés ; nombre de responsables ; ouverture d'un événement depuis la liste du jour |
| Page publique | Sessions et liens d'inscription selon les deux cases (R1) ; crédit d'une copie léguée (R2) ; ancienne adresse redirigée après renommage (R6) ; jeu archivé ou dépublié : page introuvable (R3) |
| Droits, pour tous ces écrans | Organisatrice sans accès : liste vide et fiche introuvable ; co-organisatrice : lecture et écriture |
| Hors ligne, pour tous ces écrans | Liste et fiche relues sans réseau ; création et modification mises en attente, puis envoyées ; conflit affiché quand l'élément a changé entre-temps (SPEC-010, R8 et R9) |

### Sessions (SPEC-004, SPEC-005, SPEC-006)

Existant : création, détails et équipe (`sessions.spec.ts`), casting et assistant de casting, trombinoscopes, envoi des documents, paiements (un test chacun), présence, annulation et report, timeline de session.

| Écran | À ajouter |
|---|---|
| Liste des sessions | Recherche ; barre du jeu actif ; sessions à venir triées par date, sessions passées, annulées ou terminées à part, les plus récentes d'abord ; pagination |
| Détails | Date facultative ; lieu du même jeu seulement (R1) ; statut changé librement (R2) ; visible ou non sur la page publique (R2b) ; suppression refusée avec un paiement ou une inscription (R3) |
| Équipe et casting | Plusieurs rôles par personne (R5) ; un personnage à une seule personne (R6) ; plusieurs personnages pour une personne selon le réglage (R7) ; PNJ seulement à l'organisation ou aux PNJ (R8) ; rôle « participant » ajouté au casting d'un PJ (R9) ; photo d'attribution (R10) ; conflit avec un enregistrement concurrent (R11) |
| Déroulé | Responsables parmi l'organisation et les PNJ (R12) ; enregistrement qui remplace les affectations (R13) |
| Trombinoscopes et PDF | Réglage par personnage regardé (SPEC-005, R3 à R5) ; génération à nouveau qui remplace (R9) ; fiche de personnage et document en PDF (R11, R12) ; fiche allergies |
| Documents et envois | Destinataires selon le public (SPEC-006, R7) ; « prêt à envoyer » exigé sauf pour le test (R8) ; email de test à 1 à 10 adresses (R6) ; envoi aux seuls destinataires manquants (R12) ; échec d'une personne listé (R13) ; personne sans email ignorée (R4) |
| Paiements | Mode simple et mode tarifs ; versements ; place offerte ; tarif solidaire ; RIB en PDF ou en lien ; demande puis relance (R14 à R20) |
| Présence | Réponse « Je viens » ou « Je ne viens pas » ; délai dépassé ; place libérée à la main (R17 à R20) |
| Droits | Co-organisatrice : tout ; organisatrice sans accès : introuvable ; lien de présence : seulement la réponse de la personne (R14b) |
| Hors ligne | Session relue sans réseau ; modification des détails et de l'équipe mise en attente puis envoyée |

### Participants (SPEC-007, SPEC-011)

Existant : la fiche s'ouvre depuis sa carte, avec son contact d'urgence, ses allergies et ses sessions (`participants.spec.ts`, un test). Export et effacement du compte (`accountData.spec.ts`).

| Écran | À ajouter |
|---|---|
| Liste | Recherche ; filtre par jeu ; pagination ; création : nom obligatoire, un jeu au moins (R1, R3b) |
| Fiche | Liens aux jeux ajoutés et retirés, retrait du dernier jeu qui supprime la fiche (R3b, R4) ; notes propres à l'équipe (SPEC-011, R10) ; coordonnées en lecture seule quand la personne a un compte (SPEC-011, R12) ; export (R7, R8) ; suppression par une organisatrice qui a accès à tous les jeux, refus sinon (R9) |
| Droits | Fiche d'une autre équipe introuvable (R14) ; deux modifications simultanées : la seconde est refusée (R6) |
| Hors ligne | Liste et fiche relues ; modification mise en attente puis envoyée |

### Inscriptions (SPEC-001, SPEC-015, SPEC-016, SPEC-018)

Existant : le parcours de l'inscription (`registration.spec.ts`, 13 tests), les actions de l'équipe (3 tests), la qualité du questionnaire (5 tests). Plusieurs tests par écran sont déjà là : il reste à relever, règle par règle, ce que ces tests ne couvrent pas.

| Écran | À ajouter |
|---|---|
| Vivier et périodes | Une ligne par règle de SPEC-001 et de SPEC-018 qui n'a pas encore de test ; ce relevé fait partie du lot |
| Formulaire et questionnaire | Idem pour SPEC-015 et SPEC-016 |

### Compte, accès et administration (SPEC-008, SPEC-011, SPEC-013)

Existant : la connexion et la déconnexion (8 tests), l'accès au compte et ses données (7 tests), les pages légales et les nouveautés (2 tests chacune), l'administration (1 test).

| Écran | À ajouter |
|---|---|
| Inscription libre | Mot de passe de moins de 8 caractères refusé (SPEC-008, R1) ; adresse d'un compte confirmé : même réponse qu'une inscription, et un email « compte existant » avec le lien de mot de passe oublié ; champ invisible anti-robot (SPEC-011, R6) ; inscription fermée : pas de lien depuis la connexion (SPEC-011, R4) |
| Compte | Changement de nom et de coordonnées recopiés sur les fiches ; « Déconnecter tous mes appareils » (R4) |
| Invitation à co-organiser | Invitation expirée ou annulée ; compte d'une autre adresse refusé (R12) ; invitation de la propriétaire ou d'une personne qui a déjà accès refusée (R10) |
| Administration | Création d'un compte, avec un lien pour choisir le mot de passe (SPEC-011, R9) ; désactivation ; plafond de stockage ; réglage SMTP et email de test ; mode administrateur, activé puis désactivé (R7) |

### Espace « Je participe » et pages publiques

Existant : « Je participe » (7 tests), la page publique (4 tests), les assistants d'IA (2 tests).

| Écran | À ajouter |
|---|---|
| Je participe | Une inscription et un document reçu s'ouvrent ; une ressource d'une autre personne est introuvable |
| Lien public d'inscription (`/i/…`) | Formulaire complet, champ obligatoire vide refusé |
| Assistants d'IA | Retrait d'un assistant ; partage d'un jeu limité à l'autorisation |

### Fiabilité de la suite

- `writing.spec.ts`, partage d'un jeu : le test écrit à l'adresse commune `E2E_USERS.autre`. Rejoué en parallèle (`--repeat-each`), il lit l'email d'un autre test. Il doit écrire à une personne qui lui est propre (`parcoursPerson`).

## Découpage envisagé

Un epic, une US par lot, une PR par lot, dans cet ordre :

1. Écriture d'un jeu : listes, fiches, page publique, et la correction de fiabilité ci-dessus.
2. Sessions.
3. Participants.
4. Compte, accès et administration.
5. Espace « Je participe », lien public d'inscription et assistants d'IA.
6. Inscriptions : relevé des règles sans test, puis leurs tests.

Chaque lot ajoute, pour chacun de ses écrans, les quatre axes de la proposition. Un défaut trouvé en écrivant un test devient une US de l'epic, corrigée dans le même lot.

## Conséquences

La suite Playwright de la CI s'allonge (4 min 30 le 2026-11-09) : chaque lot dit son temps ajouté dans sa PR.

## Points à trancher

Aucun. Le 2026-11-09, l'utilisatrice a choisi : scénarios tirés des specs et des écrans, sur quatre axes (actions, erreurs de saisie, droits, hors ligne).
