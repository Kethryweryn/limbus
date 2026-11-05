---
id: ADR-0066
titre: Jeux de test rechargeables en production, dates relatives et script vérifié en CI
statut: accepté
date: 2026-11-05
liens: [EPIC-044, ADR-0023, ADR-0039, ADR-0041, ADR-0058]
---

# ADR-0066 : Jeux de test rechargeables en production, dates relatives et script vérifié en CI

## Contexte

Limbus n'a qu'un environnement, la production, qui ne contient que des données de test. L'utilisatrice y essaie les fonctionnalités, avec de vrais emails. `prisma/seed.ts` crée trois jeux, mais :

- ses dates sont écrites en dur ;
- rien ne l'oblige à suivre le modèle de données, et il n'a pas suivi : aucune donnée d'inscription, de paiement ou de présence ;
- il efface sans confirmation, alors que `prisma migrate dev` peut le lancer tout seul ;
- il reconnaît ses jeux à leur adresse de page, tirée du titre, et supprime des fiches d'après leur seule adresse email ;
- il confie les jeux au premier compte trouvé ;
- il écrit une adresse réelle dans un dépôt public ;
- il supprime les jeux, ce qui retire par cascade leur accès aux autorisations d'assistants d'IA (`AiAuthorizationGame`).

## Décision

1. **Dates relatives.** Toute date du script se calcule à partir du jour du rechargement. Recharger suffit à remettre les jeux à jour.
2. **Effacement confirmé.** Le script refuse de démarrer sans `SEED_ALLOW_ERASE=1`, quelle que soit la base. Une exécution automatique n'efface donc rien.
3. **Effacement limité.** Les trois jeux portent un identifiant fixe, écrit dans le script : un jeu renommé reste reconnu, et le jeu d'une autre personne ne peut pas être pris pour eux. Le script ne supprime que ces jeux, leurs copies léguées encore en attente (`bequestPending`) et les fiches qui ne sont rattachées à aucun autre jeu. Il ne supprime aucun compte, et ne modifie que les comptes de sa propre liste. Une copie acceptée appartient à sa destinataire et reste. Si l'adresse de page d'un jeu de test est prise par un autre jeu, le script s'arrête avant toute écriture. Pour le premier rechargement, `SEED_REPLACE_BY_SLUG=1` remplace aussi les trois jeux actuels, reconnus à leur adresse. Tout le remplacement se fait dans une seule transaction : un échec laisse les jeux et leurs accès tels quels. Ensuite, `deleteUnusedUploads` retire du disque les fichiers qui ne servent plus.
4. **Rien de personnel dans le dépôt.** Ces valeurs viennent de l'environnement, au moment du lancement :
   - `SEED_EMAIL` : le compte propriétaire, et la base des adresses de test (`nom+camille@domaine`). Absente, les jeux vont au premier compte, comme aujourd'hui, et toutes les adresses sont en `example.test`. Présente sans compte correspondant, le script s'arrête avant toute écriture ;
   - `SEED_PASSWORD` : le mot de passe des comptes de test. Absent, aucun compte de test n'est créé ni modifié.
5. **Adresses.** Seuls les comptes de test et trois personnes sans compte reçoivent à l'adresse de `SEED_EMAIL`. Les autres restent en `example.test`.
6. **Pas d'envoi au rechargement.** Le script écrit en base et n'envoie aucun email. Il n'écrit aucun lien personnel, puisque seule l'empreinte d'un jeton est gardée : les liens viennent des envois lancés dans l'application.
7. **Accès conservés.** Comme les partages, les autorisations d'assistants qui visaient un jeu de test le retrouvent après le rechargement. Sans cela, recharger couperait l'assistant de l'utilisatrice.
8. **Vérifié en CI.** Un test d'intégration lance le script sur la base de test et lit ensuite les écrans des trois étapes avec les comptes de test. Le script casse donc la CI s'il ne suit plus le schéma.
9. **Règle pour la suite.** `CLAUDE.md` demande qu'une fonctionnalité qui ajoute une donnée à essayer complète le script et le guide `doc/jeux-de-test.md`.

## Conséquences

- Un rechargement remplace les trois jeux : ce qui y a été modifié à la main est perdu. Leurs identifiants et leurs adresses de page reviennent à l'identique.
- Un mot de passe de test connu donne accès aux jeux de test. Il reste hors du dépôt, et les comptes n'ont aucun droit d'administration.
- Les envois vers `example.test` n'arrivent nulle part. Selon le serveur d'envoi, ils sont refusés ou reviennent dans la boîte de l'expéditrice : `sendToEach` continue et les liste en échec. Un envoi groupé montre donc des échecs attendus, et le guide le dit. Les envois s'essaient surtout sur Les Cendres de Valombre, qui a moins de personnes que Station Meridian.
- Station Meridian a une page publique et un formulaire ouverts en production, pour un jeu qui n'existe pas : n'importe qui ayant le lien peut s'y inscrire et recevoir de vrais emails. Sa présentation dit donc clairement que c'est un jeu d'essai, et l'équipe n'est pas prévenue de chaque inscription (`notifyTeam` désactivé sur la période du formulaire).
- Les dates doivent rester dans les durées de conservation (photos, fiches), pour que les purges n'effacent pas ce qu'on veut montrer juste après un rechargement. Une session passée récente est donc préférée à une session très ancienne. Les copies d'envoi s'effacent le lendemain de la session (ADR-0044) : une session passée n'en a donc pas, et seules les sessions à venir en montrent.
- Le test d'intégration allonge un peu la CI.

## Options écartées

- **Un second environnement de test** : un serveur ou une base en plus à tenir pour une seule personne, sur un serveur partagé qu'on évite de charger.
- **Dates seulement, sans données nouvelles** : ne répond pas au besoin d'essayer tout ce qui existe.
- **Créer les données par l'API ou les outils d'assistant** : les règles seraient appliquées, mais il faudrait envoyer des emails et piloter des sessions pour atteindre des états passés (session terminée, tirage ancien). Le test d'intégration vérifie à la place que l'application lit bien ces données.
- **Mot de passe dans le dépôt** : le dépôt est public, et ces comptes existeraient en production.
