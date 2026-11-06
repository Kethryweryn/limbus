# Décisions techniques (ADR)

Toute décision technique fait l'objet d'un ADR : choix de modèle de données, d'algorithme, de bibliothèque, de protocole, de sécurité. Modèle : [`../modeles/adr.md`](../modeles/adr.md).

| ADR | Décision | Statut | Date |
|---|---|---|---|
| [ADR-0001](ADR-0001-documentation-du-projet.md) | Documenter le projet dans `doc/` : fiches, specs, epics/US, ADR | accepté | 2026-10-27 |
| [ADR-0002](ADR-0002-deploiement-continu.md) | Déploiement continu de `main` après une CI verte | accepté, en partie remplacé par ADR-0017 et ADR-0023 | 2026-10-27 |
| [ADR-0003](ADR-0003-service-de-production.md) | Service systemd durci derrière Apache | accepté | 2026-10-27 |
| [ADR-0004](ADR-0004-secrets-a-l-execution.md) | Secrets lus à l'exécution, jamais figés au build | accepté | 2026-10-27 |
| [ADR-0005](ADR-0005-sauvegardes-chiffrees.md) | Sauvegardes quotidiennes chiffrées, clé privée hors du serveur | accepté | 2026-10-27 |
| [ADR-0006](ADR-0006-sessions-et-revocation.md) | JWT de référence en cookie, révocation par version de session | accepté | 2026-10-27 |
| [ADR-0007](ADR-0007-isolation-par-jeu.md) | Isolation des données par jeu, vérifiée par des tests d'intégration | accepté | 2026-10-27 |
| [ADR-0008](ADR-0008-fichiers-televerses.md) | Fichiers téléversés servis sous contrôle, supprimés quand plus personne ne les référence | accepté | 2026-10-27 |
| [ADR-0009](ADR-0009-suppression-en-cascade.md) | Suppression en cascade du contenu d'un jeu par la base | accepté | 2026-10-27 |
| [ADR-0010](ADR-0010-url-saisies.md) | URL saisies limitées à http(s), YouTube seul intégré, téléchargement serveur borné | accepté | 2026-10-27 |
| [ADR-0011](ADR-0011-donnees-des-participants.md) | Effacement et export des données d'un participant centralisés | accepté | 2026-10-27 |
| [ADR-0012](ADR-0012-donnees-hors-ligne.md) | Hors ligne en lecture d'abord, données de l'appareil effacées à la déconnexion | accepté | 2026-10-27 |
| [ADR-0013](ADR-0013-un-seul-processus.md) | Concurrence gérée en mémoire, dans un seul processus Node | accepté | 2026-10-27 |
| [ADR-0014](ADR-0014-connexion.md) | Connexion sans énumération des comptes, emails en minuscules | accepté | 2026-10-27 |
| [ADR-0015](ADR-0015-strategie-de-tests.md) | Trois niveaux de tests, contre l'application compilée et une base jetable | accepté | 2026-10-27 |
| [ADR-0016](ADR-0016-mises-a-jour-des-dependances.md) | Mises à jour des dépendances par Dependabot, avec délai et majeures bloquées ignorées | accepté | 2026-10-27 |
| [ADR-0017](ADR-0017-branches-et-pull-requests.md) | Travail par branches et pull requests, fusion dans `main` pour déployer | accepté | 2026-10-27 |
| [ADR-0018](ADR-0018-jetons-des-liens-personnels.md) | Liens personnels des inscrits par jeton aléatoire stocké hashé | remplacé en partie par ADR-0070 | 2026-10-27 |
| [ADR-0019](ADR-0019-modele-des-inscriptions.md) | Modèle des inscriptions, champs standards en colonnes, formulaire versionné | accepté | 2026-10-27 |
| [ADR-0020](ADR-0020-echeances-evaluees-a-la-lecture.md) | Échéances évaluées à la lecture, sans tâche planifiée | accepté | 2026-10-27 |
| [ADR-0021](ADR-0021-inscription-et-participation-de-session.md) | L'inscription crée la participation de session, la session reste la référence | accepté | 2026-10-27 |
| [ADR-0022](ADR-0022-pas-de-ci-pour-la-documentation.md) | Pas de CI ni de déploiement quand seule la documentation change | accepté, en partie remplacé par ADR-0023 | 2026-10-28 |
| [ADR-0023](ADR-0023-deploiement-sans-ci-redondante.md) | Construire une fois dans la CI, tester ce build, le déployer tel quel | accepté | 2026-10-28 |
| [ADR-0024](ADR-0024-migrations-compatibles-avec-le-build-en-service.md) | Migrations compatibles avec le build en service, vérifiées par la CI | accepté | 2026-10-28 |
| [ADR-0025](ADR-0025-legs-de-jeu.md) | Legs d'un jeu par copie en une transaction, copie en attente sans propriétaire | accepté | 2026-10-28 |
| [ADR-0026](ADR-0026-acces-ssh-au-serveur.md) | Accès SSH au serveur par clé uniquement, clé root sans phrase de passe acceptée | accepté | 2026-10-29 |
| [ADR-0027](ADR-0027-archivage-porte-par-le-jeu.md) | L'état archivé du contenu est celui de son jeu | accepté | 2026-10-29 |
| [ADR-0028](ADR-0028-version-d-une-session.md) | La date de modification de la session sert de version à son équipe, son casting et son déroulé | accepté | 2026-10-29 |
| [ADR-0029](ADR-0029-cycle-de-vie-d-une-session.md) | Cycle de vie d'une session : report lié, présence par lien personnel, remboursements suivis par paiement | accepté | 2026-10-29 |
| [ADR-0030](ADR-0030-empreinte-d-un-trombinoscope.md) | Une empreinte du contenu repère un trombinoscope périmé | accepté | 2026-10-29 |
| [ADR-0031](ADR-0031-version-d-un-envoi.md) | Un envoi garde l'empreinte de la version envoyée | accepté | 2026-10-29 |
| [ADR-0032](ADR-0032-tarifs-et-versements.md) | Tarifs de session, versements et état de paiement calculé | accepté | 2026-10-29 |
| [ADR-0033](ADR-0033-paiement-d-une-personne-qui-part.md) | Paiement d'une personne qui part : décision sur le paiement, transfert par versement, proposition à la lecture | accepté | 2026-10-29 |
| [ADR-0034](ADR-0034-jeton-d-invitation-hache.md) | Le jeton d'une invitation est gardé haché, comme les liens personnels | accepté | 2026-10-29 |
| [ADR-0035](ADR-0035-anciens-slugs-d-un-jeu.md) | Les anciens slugs d'un jeu redirigent vers sa page publique | accepté | 2026-10-29 |
| [ADR-0036](ADR-0036-protocole-de-resynchronisation.md) | Protocole de resynchronisation : version lue sur toute écriture rejouée, retenue par élément | accepté | 2026-10-29 |
| [ADR-0037](ADR-0037-jeu-commun-des-tests-de-bout-en-bout.md) | Un jeu commun pour les tests de bout en bout | accepté | 2026-10-29 |
| [ADR-0038](ADR-0038-un-seul-role-global.md) | Un seul rôle global ; les droits viennent des jeux | accepté | 2026-10-29 |
| [ADR-0039](ADR-0039-comptes-en-libre-service.md) | Comptes en libre-service : liens de compte hachés, adresse confirmée, stockage compté par propriétaire | accepté | 2026-10-29 |
| [ADR-0040](ADR-0040-notes-par-jeu.md) | Les notes sur une personne sont portées par son lien à chaque jeu | accepté | 2026-10-29 |
| [ADR-0041](ADR-0041-fiches-rattachees-a-un-compte.md) | Fiches participant rattachées à un compte par l'adresse confirmée | accepté | 2026-10-29 |
| [ADR-0042](ADR-0042-coordonnees-du-compte.md) | Les coordonnées d'une personne qui a un compte vivent sur le compte et sont recopiées sur ses fiches | accepté | 2026-10-29 |
| [ADR-0043](ADR-0043-effacement-du-compte.md) | Effacer son compte efface ses fiches participant, après avoir prévenu les équipes | accepté | 2026-10-29 |
| [ADR-0044](ADR-0044-copies-des-envois.md) | Une copie de chaque envoi, gardée jusqu'au lendemain de la session | accepté | 2026-10-30 |
| [ADR-0045](ADR-0045-questions-et-affinites-du-formulaire.md) | Questions propres au jeu et affinités dans la définition du formulaire | accepté | 2026-10-31 |
| [ADR-0046](ADR-0046-formulaire-public-des-inscriptions.md) | Formulaire public des inscriptions : demande à confirmer, inscription reçue, inscription permanente | accepté | 2026-10-31 |
| [ADR-0047](ADR-0047-selection-des-inscriptions.md) | Sélection des inscriptions : décisions préparées puis annoncées, liste d'attente par session, vivier calculé | accepté | 2026-10-31 |
| [ADR-0048](ADR-0048-tirage-au-sort.md) | Tirage au sort reproductible, session par session, avec pondérations et places réservées par valeur d'équilibre | accepté | 2026-11-01 |
| [ADR-0049](ADR-0049-rattachement-des-affinites.md) | Affinités rattachées à une fiche participant, suggestions et alertes calculées à la lecture | accepté | 2026-11-01 |
| [ADR-0050](ADR-0050-relations-et-questionnaire-relie.md) | Relations orientées entre personnages, liens du questionnaire hors des versions du formulaire, relations refusées en lignes d'affinité | accepté | 2026-11-01 |
| [ADR-0051](ADR-0051-assistant-de-casting.md) | Assistant de casting calculé à la demande, cadenas et réservation sur l'attribution | accepté | 2026-11-01 |
| [ADR-0052](ADR-0052-page-de-sante.md) | Page de santé publique et surveillance par un service externe | accepté | 2026-11-01 |
| [ADR-0053](ADR-0053-durcissement-web.md) | Origine vérifiée sur les écritures, cookies __Host-, CSP par Nuxt Security en mode rapport | accepté | 2026-11-01 |
| [ADR-0054](ADR-0054-photos-des-participants.md) | Photos des participants, information sans accord préalable, purge à l'échéance et refus bloquant | accepté | 2026-11-01 |
| [ADR-0055](ADR-0055-pages-legales-et-acceptation.md) | Pages légales dans l'application, version des conditions acceptée sur le compte | accepté | 2026-11-02 |
| [ADR-0056](ADR-0056-durees-de-conservation.md) | Comptes inactifs et fiches sans compte effacés à la connexion, en tâche de fond | accepté | 2026-11-02 |
| [ADR-0057](ADR-0057-interface-en-typescript.md) | Interface en TypeScript strict, réponses déduites des routes Nitro, règle de lint étendue lot par lot | accepté | 2026-11-02 |
| [ADR-0058](ADR-0058-serveur-d-autorisation-pour-les-ia.md) | Serveur MCP et serveur d'autorisation OAuth écrit pour Limbus, pour brancher une IA | accepté | 2026-11-02 |
| [ADR-0059](ADR-0059-ci-en-jobs-paralleles.md) | CI en jobs parallèles, dépendances en cache, Playwright sur trois navigateurs | accepté | 2026-11-03 |
| [ADR-0060](ADR-0060-licence-non-commerciale.md) | Licence PolyForm Noncommercial à la place de MIT | accepté | 2026-11-03 |
| [ADR-0061](ADR-0061-indicateurs-du-questionnaire.md) | Indicateurs statistiques de la qualité du questionnaire de casting (entropie, Wilson, Cramér, Spearman, HTMT) | accepté | 2026-11-03 |
| [ADR-0062](ADR-0062-aide-a-la-conception-du-questionnaire.md) | Aide à la conception du questionnaire : information maximale, simulation de répondants, règles de relecture, consigne MCP, mélange des options | accepté | 2026-11-03 |
| [ADR-0063](ADR-0063-reperes-sur-les-reponses.md) | Repères sur les réponses : extrémité d'une échelle comparée à 20 %, test du V de Cramér, risque d'erreur | accepté | 2026-11-04 |
| [ADR-0064](ADR-0064-estimation-generale-du-questionnaire.md) | Estimation générale du questionnaire : seuils, intervalle de la note moyenne, ordre des repères | accepté | 2026-11-04 |
| [ADR-0065](ADR-0065-nouveautes-et-numero-de-deploiement.md) | Nouveautés datées, une note par pull request, numéro de la pull request déployée | accepté | 2026-11-05 |
| [ADR-0066](ADR-0066-jeux-de-test-rechargeables-en-production.md) | Jeux de test rechargeables en production, dates relatives et script vérifié en CI | accepté | 2026-11-05 |
| [ADR-0067](ADR-0067-tests-lies-avant-chaque-push.md) | Tests liés au changement joués en local avant chaque push de code | accepté | 2026-11-06 |
| [ADR-0068](ADR-0068-organisation-des-instructions-de-claude.md) | Instructions de Claude Code par thème, hook avant push et skill de documentation | accepté | 2026-11-06 |
| [ADR-0069](ADR-0069-vivier-unique-et-statut-par-session.md) | Vivier unique par jeu et statut d'inscription par session | accepté | 2026-11-06 |
| [ADR-0070](ADR-0070-liens-personnels-durables.md) | Plusieurs liens personnels valides pour une personne du vivier | accepté | 2026-11-06 |
