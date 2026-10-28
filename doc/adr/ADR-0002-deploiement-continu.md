---
id: ADR-0002
titre: Déploiement continu de main après une CI verte
statut: accepté, en partie remplacé par ADR-0017 (travail par PR au lieu de pushs directs sur main) et ADR-0023 (build construit et testé dans la CI, déployé tel quel)
date: 2026-10-27
liens: [ADR-0015, ADR-0017, ADR-0022, ADR-0023]
---

# ADR-0002 : Déploiement continu de `main` après une CI verte

*Rédigé a posteriori, pour une décision prise et mise en place le 2026-10-27.*

## Contexte

Le projet a un seul développeur, une seule instance de production et pas de staging ; la production ne contient que des données de test. Les déploiements se faisaient à la main en SSH, sans vérification préalable.

## Décision

- On travaille directement sur `main`. Chaque push lance la CI (`.github/workflows/ci.yml`) : lint, typecheck, tests unitaires, `npm audit` (dépendances de production, niveau élevé), build, tests d'intégration et de bout en bout.
- Si elle passe, le job `deploy` se connecte au serveur en SSH avec une clé dédiée (secret `DEPLOY_SSH_KEY`). Côté serveur, cette clé est restreinte à une commande forcée (`restrict,command="/var/www/limbus/deploy.sh"`) ; la clé d'hôte est épinglée dans la CI.
- La CI transmet le SHA validé : `deploy.sh` vérifie qu'il est sur `origin/main` et avance exactement jusqu'à lui (`merge --ff-only`), jamais au-delà.
- `deploy.sh` construit dans `/tmp/limbus-build`, avec une seule installation des dépendances (`npm ci`), qui sert au build, aux migrations, puis remplace celle de `/var/www/limbus`. Le `.nuxt` de production n'est pas copié : il contient des chemins absolus qui cassent le prérendu.
- La bascule garde l'ancien build dans `.output-prev`, puis redémarre le service. Le job vérifie ensuite que `/api/auth/me` répond 200.
- Un seul déploiement à la fois : `flock` sur `/run/limbus-deploy.lock` côté serveur, groupe de concurrence `deploy-production` sans annulation côté CI. Les déploiements s'enchaînent dans l'ordre des pushs.
- Le build et les migrations utilisent le Node système (`/usr/bin/node`, Node 24), le même que le service, pas celui de nvm.

## Conséquences

- Un push sur `main` est une mise en production : rien ne part sans tests verts, mais tout ce qui est vert part.
- Une erreur passée entre les mailles des tests arrive en production ; le retour arrière se fait à la main à partir de `.output-prev`, ou par un commit correctif.
- Les migrations Prisma s'appliquent avant la bascule : une migration doit rester compatible avec le build précédent le temps du redémarrage.
- Un déploiement prend environ 3 minutes, plus le temps d'attente des déploiements précédents.

## Options écartées

- **Branches et PR systématiques** : lourdeur sans relecteur.
- **Staging** : pas d'environnement disponible, et la production ne contient que des données de test.
- **Déploiement par image Docker** : le serveur est partagé avec d'autres sites et ne fait pas tourner Docker.
