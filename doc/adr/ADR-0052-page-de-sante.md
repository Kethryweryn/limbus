---
id: ADR-0052
titre: Page de santé publique et surveillance par un service externe
statut: accepté
date: 2026-11-01
liens: [../todo/supervision.md, ../revues/2026-10-29-architecture.md, ADR-0023-deploiement-sans-ci-redondante.md]
---

# ADR-0052 : Page de santé publique et surveillance par un service externe

## Contexte

Une panne n'est découverte que quand quelqu'un ouvre le site (revue d'architecture, R-15). Le site professionnel, sur le même serveur, est resté en erreur une nuit sans que personne le sache. Choix de l'utilisatrice : Better Stack, la version déployée dans la réponse, et le site professionnel surveillé aussi.

## Décision

- `GET /api/public/health`, publique comme les autres routes de `public/`. Elle exécute `SELECT 1` sur la base, avec 3 secondes au plus.
  - Réussite : 200, `{ status: 'ok', version }`.
  - Échec : 503, `{ status: 'error' }`, sans détail de l'erreur.
  - Toujours `Cache-Control: no-store`.
- **Version** : `deploy.sh` écrit le commit déployé dans `.output/VERSION`. La route le lit une fois, à côté du point d'entrée du serveur (`process.argv[1]`, soit `.output/server/index.mjs`). Sans fichier, `version` vaut `null`.
- **Surveillance** : un service externe (Better Stack, offre gratuite) interroge la route et le site professionnel, et alerte par email. Il est configuré hors du dépôt : rien de sa configuration n'y figure.

## Conséquences

- Un déploiement se vérifie en lisant `version`.
- La route ne dit rien d'Apache ni du serveur : une page qui répond 200 derrière un Apache en panne n'existe pas, puisque la sonde passe par Apache.
- Pas de limite de débit : la requête est légère, et une limite ferait passer la sonde pour une panne.

## Options écartées

- **Uptime Kuma sur le serveur** : il tomberait avec lui.
- **UptimeRobot** : son offre gratuite exclut l'usage commercial, donc le site professionnel.
- **Version lue par `git` à l'exécution** : le service n'a pas à lancer de processus, et le dossier de l'application pourrait ne plus être un dépôt.
