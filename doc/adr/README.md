# Décisions techniques (ADR)

Toute décision technique fait l'objet d'un ADR : choix de modèle de données, d'algorithme, de bibliothèque, de protocole, de sécurité. Modèle : [`../modeles/adr.md`](../modeles/adr.md).

| ADR | Décision | Statut | Date |
|---|---|---|---|
| [ADR-0001](ADR-0001-documentation-du-projet.md) | Documenter le projet dans `doc/` : fiches, specs, epics/US, ADR | accepté | 2026-10-27 |
| [ADR-0002](ADR-0002-deploiement-continu.md) | Déploiement continu de `main` après une CI verte | accepté | 2026-10-27 |
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
