---
id: ADR-0091
titre: CSP sans strict-dynamic, icônes livrées avec Limbus, violations vérifiées par la suite de bout en bout
statut: accepté
date: 2026-11-12
liens: [ADR-0053-durcissement-web.md, ../todo/durcissement-web.md, ../epics/EPIC-059-csp-applicable/README.md]
---

# ADR-0091 : CSP sans strict-dynamic, icônes livrées avec Limbus, violations vérifiées par la suite de bout en bout

## Contexte

Après dix jours en mode rapport (ADR-0053), deux violations empêchent de rendre la CSP bloquante :

- **La page d'accueil** (641 rapports) : `/` est prérendue, et le service worker la garde pour ouvrir Limbus sans réseau (`start_url`). Elle n'a donc pas de nonce. Ses scripts intégrés passent par empreinte, mais son fichier d'entrée (`/_nuxt/….js`) ne passe que par `'self'`, que `'strict-dynamic'` fait ignorer. Autoriser ce fichier par empreinte demande l'attribut `integrity`, et un rapport de bogue indique que Safari refuse ce montage avec `'strict-dynamic'` ([bogue WebKit 270784](https://bugs.webkit.org/show_bug.cgi?id=270784)) ; ce n'a pas été essayé ici.
- **Les icônes** (2 rapports) : aucune collection d'icônes n'est installée. Le serveur les lit donc sur un CDN, et le navigateur se replie sur `api.iconify.design` quand une icône manque.

Le mode rapport ne signale que les pages ouvertes en production, encore peu utilisée : son silence sur un écran ne prouve rien.

## Décision

- `script-src 'self' 'nonce-…'`, sans `'strict-dynamic'`. La page prérendue reçoit `script-src 'self'` et les empreintes de ses scripts intégrés. Un script ne s'exécute que s'il est un fichier servi par Limbus, ou un script intégré qui porte le nonce ou une empreinte prévue. Le reste de la politique d'ADR-0053 ne change pas.
- Les collections `@iconify-json/heroicons` (icônes de Limbus) et `@iconify-json/lucide` (icônes de Nuxt UI) sont installées. Le serveur les sert depuis ses fichiers (`icon.serverBundle`). Le code de la page embarque les icônes écrites dans les `.vue` et `.ts` de Limbus (`icon.clientBundle.scan`) ; Nuxt UI y ajoute lui-même ses icônes par défaut. Une règle ESLint refuse un nom d'icône calculé (`` `i-heroicons-${…}` ``, `'i-heroicons-' + …`), que le scan ne verrait pas. Le repli sur l'API d'Iconify est coupé (`fallbackToApi: false`).
- La suite de bout en bout tourne avec la CSP de la production. Son `globalTeardown` lit les violations comptées dans la base de test et échoue s'il y en a une.
- La CSP reste en mode rapport. Elle passera en mode bloquant dans une PR à part, après une relecture des rapports, quand l'utilisatrice aura parcouru tous les écrans avec le cahier de tests.

## Conséquences

- Une nouvelle ressource externe, ou un nouveau script intégré sans nonce, fait échouer la CI avant d'atteindre la production.
- `'self'` autorise tout fichier JavaScript servi par Limbus. Un fichier téléversé ne peut pas en devenir un : son type réel est vérifié, il est servi avec son type (image, PDF), et `X-Content-Type-Options: nosniff` fait refuser au navigateur un script dont le type n'est pas JavaScript.
- Un nom d'icône s'écrit en entier dans le code ; un nom tiré d'une variable sans gabarit (une table de correspondance, par exemple) reste vu par le scan tant que la chaîne complète figure dans un `.vue` ou un `.ts`.
- Les icônes ne dépendent plus d'un CDN, ni côté serveur, ni côté navigateur.

## Options écartées

- **Rendre la page d'accueil à chaque visite**, pour lui donner un nonce : l'ouverture sans réseau demanderait alors de garder une page rendue avec le compte connecté, et de l'effacer à la déconnexion.
- **Empreintes des fichiers de script avec `integrity`**, en gardant `'strict-dynamic'` : Safari le refuserait, selon le bogue WebKit cité.
- **Autoriser `api.iconify.design`** : un service extérieur verrait passer les visites, et les icônes manqueraient sans réseau.
- **Rendre la CSP bloquante tout de suite** : peu d'écrans ont été ouverts en production pendant le mode rapport.
