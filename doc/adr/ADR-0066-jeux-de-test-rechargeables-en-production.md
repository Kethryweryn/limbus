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
- il supprime des fiches d'après leur seule adresse, et confie les jeux au premier compte trouvé ;
- il écrit une adresse réelle dans un dépôt public ;
- il supprime les jeux, ce qui retire par cascade leur accès aux autorisations d'assistants d'IA (`AiAuthorizationGame`).

## Décision

1. **Dates relatives.** Toute date du script se calcule à partir du jour du rechargement. Recharger suffit à remettre les jeux à jour.
2. **Effacement confirmé.** Le script refuse de démarrer sans `SEED_ALLOW_ERASE=1`, quelle que soit la base. Une exécution automatique n'efface donc rien.
3. **Effacement limité.** Il ne supprime que les trois jeux de test, leurs copies léguées, et les fiches qui ne sont rattachées à aucun autre jeu. Il ne supprime aucun compte, et ne modifie que les comptes de sa propre liste.
4. **Rien de personnel dans le dépôt.** Ces valeurs viennent de l'environnement, au moment du lancement :
   - `SEED_EMAIL` : le compte propriétaire, et la base des adresses de test (`nom+camille@domaine`). Absente, les jeux vont au premier compte, comme aujourd'hui, et toutes les adresses sont en `example.test` ;
   - `SEED_PASSWORD` : le mot de passe des comptes de test. Absent, aucun compte de test n'est créé ni modifié.
5. **Adresses.** Seuls les comptes de test et trois personnes sans compte reçoivent à l'adresse de `SEED_EMAIL`. Les autres restent en `example.test`.
6. **Pas d'envoi au rechargement.** Le script écrit en base et n'envoie aucun email. Il n'écrit aucun lien personnel, puisque seule l'empreinte d'un jeton est gardée : les liens viennent des envois lancés dans l'application.
7. **Accès conservés.** Comme les partages, les autorisations d'assistants qui visaient un jeu de test le retrouvent après le rechargement. Sans cela, recharger couperait l'assistant de l'utilisatrice.
8. **Vérifié en CI.** Un test d'intégration lance le script sur la base de test et lit ensuite les écrans des trois étapes avec les comptes de test. Le script casse donc la CI s'il ne suit plus le schéma.
9. **Règle pour la suite.** `CLAUDE.md` demande qu'une fonctionnalité qui ajoute une donnée à essayer complète le script et le guide `doc/jeux-de-test.md`.

## Conséquences

- Un rechargement remplace les trois jeux : ce qui y a été modifié à la main est perdu, et leurs identifiants internes changent. Les adresses de page, tirées des titres, restent les mêmes.
- Un mot de passe de test connu donne accès aux jeux de test. Il reste hors du dépôt, et les comptes n'ont aucun droit d'administration.
- Les envois vers `example.test` n'arrivent nulle part, et le serveur d'envoi peut les refuser. Essayer un envoi se fait avec les personnes dont l'adresse arrive dans la boîte de l'utilisatrice.
- Les dates doivent rester dans les durées de conservation (photos, copies d'envoi, fiches), pour que les purges n'effacent pas ce qu'on veut montrer juste après un rechargement. Une session passée récente est donc préférée à une session très ancienne.
- Le test d'intégration allonge un peu la CI.

## Options écartées

- **Un second environnement de test** : un serveur ou une base en plus à tenir pour une seule personne, sur un serveur partagé qu'on évite de charger.
- **Dates seulement, sans données nouvelles** : ne répond pas au besoin d'essayer tout ce qui existe.
- **Créer les données par l'API ou les outils d'assistant** : les règles seraient appliquées, mais il faudrait envoyer des emails et piloter des sessions pour atteindre des états passés (session terminée, tirage ancien). Le test d'intégration vérifie à la place que l'application lit bien ces données.
- **Mot de passe dans le dépôt** : le dépôt est public, et ces comptes existeraient en production.
