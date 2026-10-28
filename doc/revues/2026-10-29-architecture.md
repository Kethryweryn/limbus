---
titre: Revue d'architecture comparée à l'état de l'art
date: 2026-10-29
origine: ../archive/todo/revue-d-architecture.md
statut: recommandations à trier
---

# Revue d'architecture, 29 octobre 2026

## En bref

Le projet est sain pour une application de cette taille : une seule base, un seul serveur, une seule personne qui l'utilise, et des données de test. Les choix les plus sensibles sont faits et documentés : sessions révocables, isolation par jeu vérifiée par des tests d'intégration sur chaque route, fichiers servis sous contrôle, secrets lus à l'exécution, build testé puis déployé tel quel.

Les écarts les plus nets avec l'état de l'art :

1. **Le secret SMTP a fuité publiquement le 27 octobre et n'a pas été changé**, et le répertoire `/files/` du domaine voisin est toujours listé publiquement sur le même serveur.
2. **L'authentification SSH par mot de passe est encore active** sur un serveur exposé, contrairement à la recommandation de l'ANSSI.
3. **Pas de Content-Security-Policy sur les pages** de l'application, alors que le module Nuxt Security la met en place par route, sans toucher aux autres sites du serveur.
4. **58 des 60 composants Vue sont en JavaScript** : `npm run typecheck` ne vérifie pas l'interface.
5. **Les photos des participants n'ont pas de durée de conservation**, ce que le RGPD demande (limitation de la conservation).
6. **Aucune supervision** : une panne de production n'est vue que lorsqu'on ouvre le site.

Les recommandations sont numérotées (R-01…) et récapitulées en fin de rapport, avec un effort estimé : **S** (moins d'une demi-journée), **M** (une à deux journées), **L** (plus). Elles sont à trier une par une : fiche todo, ADR, ou abandon motivé.

## Méthode

- Lecture du code au 29 octobre 2026 (`main` à `d64c4ec`) : `server/`, `utils/`, `composables/`, pages et composants, `prisma/schema.prisma`, CI, `deploy.sh`, ADR.
- En-têtes HTTP de production relevés avec `curl` sur `https://limbuslarp.fr`.
- Comparaison avec des sources publiques. Les sources primaires sont privilégiées ; quand seules des sources secondaires étaient disponibles, c'est indiqué.

## 1. Sécurité

### Conforme

- **Sessions** : JWT signé HS256 dans un cookie `HttpOnly`, `Secure`, `SameSite=Lax`, qui ne porte que l'identifiant et une version de session relue en base à chaque requête. Le rôle n'est jamais lu dans le jeton. C'est le point qui manque à la plupart des implémentations JWT : l'état est vérifié côté serveur, donc la révocation (déconnexion partout, changement de mot de passe) est immédiate. L'ASVS 5.0 (chapitre V7) demande surtout que le choix entre session avec ou sans état soit analysé et documenté : c'est fait dans ADR-0006.
- **Mots de passe** : bcrypt avec un coût de 10, comparaison à temps constant même pour un email inconnu, limites de débit par IP et par email à la connexion. L'OWASP considère un coût de 10 comme le minimum pour bcrypt et préfère Argon2id pour un nouveau système ; ce n'est pas un écart qui justifie une migration.
- **Autorisations** : toutes les routes sous `server/api` commencent par `requireOrganizer` ou `requireAdmin`, sauf les routes publiques prévues (`auth/*`, `invitations/*`, `public/*`), vérifié fichier par fichier. Les accès par jeu passent par des fonctions communes, et `tests/integration/isolation.test.ts` vérifie chaque route avec un témoin positif.
- **Validation** : tous les corps de requête passent par un schéma zod (`readZodBody`) ; aucun `readBody` brut dans les routes.
- **Fichiers téléversés** : type vérifié par signature, renommage en UUID, stockage hors de la racine web, service par une route qui vérifie les droits, référence limitée aux fichiers du même jeu. C'est ce que recommande l'aide-mémoire OWASP sur les téléversements.
- **En-têtes** : HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` et `Permissions-Policy` sont envoyés par Apache, avec les valeurs de l'aide-mémoire OWASP. L'API ajoute une CSP `script-src 'none'; frame-ancestors 'none'`, et la page d'inscription par lien personnel coupe le `Referer` et le cache.
- **Secrets** : lus à l'exécution, jamais figés dans le build (ADR-0004).

### Écarts

- **Pas de CSP sur les pages HTML.** L'API en a une, l'application non. Une CSP est la protection de second rang contre une injection de script, que recommandent l'aide-mémoire OWASP sur les en-têtes et l'ASVS. ADR-0003 écarte une CSP **globale à Apache**, parce qu'elle s'appliquerait aux autres sites du serveur, et ce point reste vrai. Mais le module Nuxt Security (référencé dans l'annuaire des modules Nuxt, compatible Nuxt 4) pose la CSP depuis l'application, avec un nonce par réponse en SSR et des règles par route : elle ne touche que Limbus. Point déjà écarté, **réexaminé : recommandé** (R-01).
- **Pas de vérification de l'origine sur les écritures.** `SameSite=Lax` empêche l'envoi du cookie sur un POST venu d'un autre site, ce qui couvre l'essentiel du risque CSRF. L'OWASP recommande d'y ajouter, en défense en profondeur, une vérification des en-têtes `Origin`/`Sec-Fetch-Site` sur les requêtes qui modifient des données. C'est un middleware serveur de quelques lignes (R-02).
- **Cookie sans préfixe `__Host-`.** Le préfixe garantit que le cookie a été posé par le site lui-même, en HTTPS, sans attribut `Domain`. Recommandé par l'OWASP, il ne coûte qu'un renommage, qui déconnecte tout le monde une fois (R-03).
- **`Cross-Origin-Opener-Policy` absent.** L'OWASP recommande `same-origin`. À ajouter avec la CSP (inclus dans R-01).
- **Limites de débit en mémoire.** Elles repartent de zéro à chaque redémarrage et ne seraient pas partagées entre plusieurs processus. Avec un seul processus et des déploiements rares, c'est acceptable ; à revoir seulement si l'application passe à plusieurs instances. Pas de recommandation.

### Serveur

Ces points concernent le serveur partagé plutôt que le code ; ils sont réexaminés parce qu'ils exposent Limbus.

- **Authentification SSH par mot de passe active.** L'ANSSI recommande l'authentification par clé pour l'administration à distance (note technique DAT-NT-007 sur OpenSSH). Sur le serveur, `sshd -T` donne `permitrootlogin without-password` et `passwordauthentication yes` : `root` n'entre que par clé, mais les autres comptes peuvent entrer par mot de passe, avec fail2ban comme seule protection. Pour la désactiver : `PasswordAuthentication no` et `KbdInteractiveAuthentication no`, après avoir vérifié que la connexion par clé de chaque compte fonctionne. Point déjà écarté, **réexaminé : recommandé** (R-04).
- **`SMTP_ENCRYPTION_SECRET` non changé après sa fuite.** Le 27 octobre, une archive contenant `.env` a été publiée dans un répertoire listé publiquement. `JWT_SECRET` et le mot de passe PostgreSQL ont été changés ; pas ce secret, jugé peu risqué parce que la base n'est pas exposée. Or il ne protège que le mot de passe SMTP stocké en base : quiconque obtient un jour une copie de la base (sauvegarde, export, incident) peut le déchiffrer avec ce secret, qui est public. Le changer oblige seulement à ressaisir le mot de passe SMTP. L'ASVS demande qu'un secret compromis soit remplacé. Point déjà écarté, **réexaminé : recommandé** (R-05).
- **`https://jdmottot.fr/files/` toujours listé publiquement.** Le listage n'expose plus de fichier de Limbus : on y trouve des PDF, des images, un exécutable et une base de jeu. Mais c'est par ce listage que `.env` a fuité, et tout fichier qui y serait déposé par erreur serait aussitôt visible et indexable. `Options -Indexes` sur ce répertoire suffit, et les liens directs continuent de marcher. Point déjà écarté, **réexaminé : recommandé**. C'est un choix qui concerne un autre site que Limbus, donc c'est à toi de trancher (R-06).

## 2. Accès aux données

### Conforme

- **Isolation par jeu dans l'application**, avec `gameScopedWhere`, `accessibleGameIds`, `requireGameAccess` et `requireSessionAccess`, et un test d'isolation pour chaque route. Les sources sur le multi-tenant PostgreSQL présentent la Row-Level Security comme un filet de sécurité en base contre un oubli de filtre. Elles rappellent aussi qu'elle ne remplace pas les autorisations applicatives, et qu'avec Prisma elle demande un rôle dédié et un contexte posé à chaque requête. Avec des tests d'isolation systématiques, le gain ne justifie pas ce coût aujourd'hui. Pas de recommandation, à revoir si l'application accueille de nombreuses équipes.
- **Transactions** là où plusieurs écritures doivent réussir ensemble (copie d'un jeu, attribution d'un legs, inscriptions…), et écritures conditionnelles contre les courses (`updateMany` avec condition d'état).
- **Index** : 25 `@@index` sur les clés étrangères et les champs de recherche ; pas de SQL brut.
- **Migrations** : la CI refuse celles qui casseraient le build encore en service (ADR-0024). C'est le motif « expand / contract » recommandé pour un déploiement sans interruption.

### Écarts

- **Quelques requêtes dans des boucles** (motif N+1, que la documentation Prisma recommande d'éviter avec `include` ou un filtre `in`) :
  - `server/utils/documents.ts:273` : une recherche par destinataire ;
  - `server/utils/trombinoscopes.ts:129` : un `upsert` par entrée.

  Les volumes sont petits (quelques dizaines de personnages), l'effet est donc négligeable aujourd'hui. Dans `gameCopy.ts`, les créations en boucle sont voulues : chaque identifiant créé sert au lien suivant. À corriger quand on touche ces fichiers (R-07).
- **Photos des participants sans durée de conservation.** Une photo où la personne est reconnaissable est une donnée personnelle. Le RGPD (article 5, 1, e) demande de ne la conserver que le temps nécessaire, et d'informer la personne (articles 13 et 14). Aujourd'hui, les photos de session restent tant que la session existe, et la base légale de leur usage interne (trombinoscope remis à l'équipe et aux joueurs) n'est écrite nulle part. Je n'ai pas trouvé de fiche CNIL propre aux photos de GN ; les sources disponibles (CNIL, CNPD luxembourgeoise) rappellent que publier la photo d'une personne reconnaissable demande en principe son consentement. Le trombinoscope n'est pas une publication, mais il est envoyé par email à toute la session.

  Deux points déjà écartés sont **réexaminés** :
  - **Purge automatique** : **recommandée sous une forme simple**, par exemple une suppression des photos N mois après la date de la session, évaluée à la lecture comme les autres échéances (ADR-0020), avec un réglage par jeu (R-08) ;
  - **Consentement explicite** : **pas recommandé tel quel**. Pour un trombinoscope interne, une information claire au moment de l'inscription (finalité, destinataires, durée) suffit probablement, sur la base de l'intérêt légitime ou de l'exécution de l'inscription. Une case de consentement ne s'impose que si les photos servent à autre chose, comme une page publique. À confirmer avec une source juridique avant de trancher (R-09).
- **Lien magique pour les participants** : point déjà écarté, **réexaminé : toujours pas recommandé**. Le droit d'accès est assuré par l'export JSON que fait l'organisatrice. Un accès direct des participants créerait une surface d'attaque nouvelle (lien envoyé par email, durée de vie, révocation) pour un besoin qui ne s'est pas présenté.

## 3. Structure du code

### Conforme

- Découpage classique d'une application Nuxt/Nitro : routes fines dans `server/api` (suffixes de méthode, 129 fichiers), logique métier dans `server/utils` (31 modules, 5 600 lignes), types et constantes partagés dans `utils/`. C'est la séparation entre « routes » et « services » que pratiquent la plupart des projets Nitro.
- Conventions écrites et suivies : identifiants stables dans l'API, slugs pour les pages, `assertUnmodifiedSince` pour les écritures concurrentes.

### Écarts

- **L'interface n'est pas typée.** 58 composants et pages sur 60 sont en `<script setup>` JavaScript. `npm run typecheck` (vue-tsc) ne vérifie donc que le serveur et les utilitaires. Une API qui change de forme ne casse pas la compilation de l'interface, seulement l'usage. La documentation Nuxt présente TypeScript comme la configuration par défaut. La migration peut être progressive : `lang="ts"` à chaque composant touché, en commençant par les plus gros (R-10).
- **Code répété en tête de chaque route.** 61 fichiers répètent la lecture du paramètre d'URL et son erreur 400, après `requireOrganizer`. Un utilitaire (`requireRouterParam(event, 'id')`) réduirait ce bruit sans changer le comportement. Ce n'est pas un risque, seulement de la lisibilité (R-11).
- **Composants volumineux** : `pages/timeline/index.vue` (670 lignes), `SessionDocumentsManager.vue` (541), `RegistrationPeriodsPanel.vue` (531), `pages/sessions/index.vue` (494). À découper quand on y travaille, plutôt qu'en chantier à part (inclus dans R-10).
- **Outils de build dans `dependencies`** : `eslint`, `@nuxt/eslint`, `typescript`, `nuxi`, `workbox-build` et `@vite-pwa/assets-generator` servent au développement et au build, pas à l'exécution. Le déploiement installe le build testé, donc l'effet est limité au poids de `node_modules` en production et au bruit des alertes de dépendances. À ranger en `devDependencies` en vérifiant que le build de la CI les installe toujours (R-12).

## 4. Hors ligne

### Conforme

- **Lecture d'abord, écritures en file**, rejouées dans l'ordre au retour du réseau. Les guides sur les PWA hors ligne décrivent cette stratégie.
- **Les conflits sont détectés et non écrasés** : la modification hors ligne envoie la date de la version lue, le serveur répond 409 si l'élément a changé, et la file s'arrête en montrant l'erreur. C'est la stratégie « le serveur gagne, le conflit est montré à la personne », recommandée quand les données comptent.
- **Les actions ne sont jamais mises en file** (envois d'emails, legs, partages), ni les téléversements.
- **Données effacées à la déconnexion** et au changement de compte.

### Écarts

- **Contrôle de conflit facultatif et partiel.** Il n'a lieu que si la requête porte la date de version, et seules 11 routes l'appliquent. Une suppression rejouée hors ligne n'est jamais contrôlée : on peut supprimer un élément modifié entre-temps par une co-organisatrice. Le cas reste rare tant qu'une seule personne travaille sur un jeu. À traiter avec le chantier de resynchronisation déjà prévu dans CLAUDE.md, pas avant (R-13).
- **Pas de Background Sync** : la file n'est rejouée que lorsque l'application est ouverte. L'API Background Sync n'existe que dans Chromium, et la solution actuelle (rejouer à l'ouverture et au retour du réseau) est le repli recommandé. Pas de recommandation.

## 5. Tests et CI

### Conforme

- Trois niveaux, conformes à ADR-0015 :
  - 162 tests unitaires ;
  - 304 tests d'intégration contre l'application compilée et une vraie base PostgreSQL ;
  - 9 scénarios Playwright.

  C'est la répartition « en trophée » souvent recommandée pour une application web : l'essentiel de la confiance vient des tests d'intégration, qui vérifient les droits route par route.
- La CI construit une fois dans un conteneur identique au serveur, teste ce build, et c'est lui qui est déployé (ADR-0023) : ce qui est testé est ce qui tourne.
- Les migrations incompatibles sont refusées automatiquement (ADR-0024).

### Écarts

- **Les tests de bout en bout couvrent peu de parcours** : connexion, déconnexion, 403, page publique, legs. Les parcours les plus utilisés en préparation d'un GN n'en ont pas : casting d'une session, génération des trombinoscopes, envoi des documents. Un scénario par parcours suffirait (R-14).
- Les 7 tests d'intégration « ignorés » sont voulus : ce sont les lectures par slug des ressources qui n'ont pas de slug (`it.runIf` dans `isolation.test.ts`). Pas de recommandation.

## 6. Exploitation

### Conforme

- Service systemd durci, utilisateur dédié, seul `.data` inscriptible, application derrière Apache en écoute locale (ADR-0003).
- Sauvegardes quotidiennes chiffrées avec une clé privée hors du serveur, et restauration testée (ADR-0005).
- Déploiement automatique du build testé, par une clé SSH à commande forcée.

### Écarts

- **Aucune supervision.** Une panne n'est découverte que lorsqu'on ouvre le site. L'état de l'art pour une petite application : une route de santé (`/api/health`, qui vérifie la base) interrogée toutes les quelques minutes par un service externe gratuit, qui prévient par email. Cela demande peu de travail et aucune infrastructure. La source qui recommande ce montage est un guide, pas une norme. Point déjà écarté, **réexaminé : recommandé** (R-15).
- **Journaux non structurés.** Le serveur n'écrit que quelques `console.warn`/`console.error`, lus avec `journalctl`. Des journaux JSON (Pino, recommandé par l'architecture de référence Node.js d'IBM et Red Hat) permettraient d'alerter sur les erreurs. Ce n'est utile qu'avec la supervision ; priorité basse (R-16).
- **Anciennes sauvegardes non chiffrées sur Dedibackup.** Elles sont déjà suivies par une tâche planifiée le 3 novembre. Pas de nouvelle recommandation.

## Points déjà écartés : bilan du réexamen

| Point | Verdict | Recommandation |
|---|---|---|
| Content-Security-Policy | Recommandé, par l'application et non par Apache | R-01 |
| Authentification SSH par mot de passe | Recommandé de la désactiver | R-04 |
| Rotation de `SMTP_ENCRYPTION_SECRET` | Recommandée : le secret est public depuis le 27 octobre | R-05 |
| Listage de `/files/` | Recommandé de le couper ; concerne un autre site | R-06 |
| Purge des photos | Recommandée sous forme d'échéance par jeu | R-08 |
| Consentement photos | Information plutôt que consentement, à confirmer | R-09 |
| Lien magique participants | Toujours pas recommandé | — |
| Supervision | Recommandée, sous forme minimale | R-15 |

## Récapitulatif des recommandations

Triées par priorité. Effort : S (moins d'une demi-journée), M (une à deux journées), L (plus).

| N° | Recommandation | Axe | Effort | Priorité |
|---|---|---|---|---|
| R-05 | Changer `SMTP_ENCRYPTION_SECRET`, puis ressaisir le mot de passe SMTP | Sécurité (serveur) | S | haute |
| R-04 | Désactiver l'authentification SSH par mot de passe | Sécurité (serveur) | S | haute |
| R-06 | Couper le listage de `https://jdmottot.fr/files/` | Sécurité (serveur) | S | haute |
| R-01 | CSP avec nonce et COOP sur les pages, par Nuxt Security | Sécurité | M | haute |
| R-15 | Route de santé et supervision externe avec alerte email | Exploitation | S | moyenne |
| R-02 | Vérifier `Origin`/`Sec-Fetch-Site` sur les écritures | Sécurité | S | moyenne |
| R-03 | Préfixe `__Host-` sur le cookie de session | Sécurité | S | moyenne |
| R-08 | Durée de conservation des photos, purge évaluée à la lecture | Données (RGPD) | M | moyenne |
| R-09 | Informer les participants sur l'usage de leur photo, à confirmer juridiquement | Données (RGPD) | S | moyenne |
| R-10 | Passer l'interface en TypeScript, composant par composant | Structure | L | moyenne |
| R-14 | Scénarios Playwright des parcours principaux | Tests | M | moyenne |
| R-13 | Contrôle de conflit sur toutes les écritures rejouées, y compris les suppressions | Hors ligne | M | basse |
| R-07 | Supprimer les deux requêtes en boucle | Données | S | basse |
| R-11 | Utilitaire pour lire les paramètres d'URL des routes | Structure | S | basse |
| R-12 | Ranger les outils de build en `devDependencies` | Structure | S | basse |
| R-16 | Journaux structurés (Pino) | Exploitation | M | basse |

## Sources

- OWASP Cheat Sheet Series : [HTTP Security Response Headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html), [File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
- OWASP ASVS (5.0, chapitre V7 « Session Management ») : [dépôt officiel](https://github.com/OWASP/ASVS). Les exigences citées l'ont été à partir de sources secondaires, qui reprennent le texte de la V7.1.
- Nuxt Security, module CSP avec nonce : [documentation](https://nuxt-security.vercel.app/), [aide-mémoire report-uri pour Nuxt](https://docs.report-uri.com/frameworks/nuxt/).
- Prisma : [Query optimization](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance).
- Row-Level Security et multi-tenant : [AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/rls.html), [Permit.io, limites de RLS](https://www.permit.io/blog/postgres-rls-implementation-guide).
- ANSSI, [Recommandations pour un usage sécurisé d'(Open)SSH](https://cyber.gouv.fr/sites/default/files/2014/01/NT_OpenSSH.pdf) ; [IT-Connect, durcissement SSH](https://www.it-connect.fr/durcissement-de-config-comment-securiser-son-serveur-ssh/) pour les directives d'OpenSSH 9.
- Droit à l'image : [CNIL, publication de photos](https://www.cnil.fr/fr/les-conseils-de-la-cnil-pour-mieux-maitriser-la-publication-de-photos-0), [CNPD, lignes directrices droit à l'image](https://cnpd.public.lu/content/dam/cnpd/fr/dossiers-thematiques/droit-image/CNPD-Lignes-directrices-droit-a-l-image-protection-donnees-personnelles.pdf).
- Hors ligne : [LogRocket, offline-first 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/), [stratégies de résolution de conflits](https://frontcore.vercel.app/docs/frontend/state-management-and-data-patterns/offline-conflict-resolution).
- Journaux : [IBM, Node.js reference architecture et Pino](https://developer.ibm.com/blogs/nodejs-reference-architectire-pino-for-logging).

## Suite

Chaque recommandation est triée avec l'utilisatrice (décision du 29 octobre 2026). Le résultat du tri est noté ici, recommandation par recommandation :

| N° | Décision | Suite |
|---|---|---|
| | | |
