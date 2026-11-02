---
id: ADR-0055
titre: Pages légales dans l'application, version des conditions acceptée sur le compte
statut: accepté
date: 2026-11-02
liens: [../specs/SPEC-013-pages-legales-et-conservation.md, ADR-0039-inscription-libre.md]
---

# ADR-0055 : Pages légales dans l'application, version des conditions acceptée sur le compte

## Contexte

[SPEC-013](../specs/SPEC-013-pages-legales-et-conservation.md), règles L1 à L5. L'inscription libre doit présenter les conditions d'utilisation et les faire accepter, et les comptes existants doivent les accepter à leur tour.

## Décision

- **Textes** : les trois pages sont des pages Nuxt (`pages/mentions-legales.vue`, `pages/confidentialite.vue`, `pages/conditions.vue`). Les données qui reviennent d'une page à l'autre sont dans `utils/legal.ts` :
  - éditeur, contact, hébergeur ;
  - `TERMS_VERSION`, la date de la version en cours.

  Elles sont publiques, dans la liste des routes publiques de `app.vue`.
- **Acceptation** : `User.termsAcceptedVersion` et `User.termsAcceptedAt`.
  - `signup` et `register` exigent `termsAccepted: true`, puis enregistrent la version.
  - `auth/me` renvoie `termsAccepted`, vrai si la version enregistrée est la version en cours.
  - `POST /api/auth/accept-terms` enregistre la version en cours pour le compte connecté.
  - `app.vue` affiche `TermsAcceptanceScreen` à un compte connecté qui ne l'a pas acceptée, sauf sur les pages légales.
- **Nouvelle version** : on change `TERMS_VERSION`, et chacun accepte de nouveau à sa prochaine ouverture de l'application.
- **Export** : `exportAccountData` contient la version et la date.

## Conséquences

- L'API ne refuse pas les requêtes d'un compte qui n'a pas accepté : l'écran bloque l'application, pas l'API. Un outil qui appelle l'API directement n'est pas arrêté. C'est acceptable tant que l'acceptation sert à informer et à engager la personne, pas à protéger des données.
- Changer un texte sans changer `TERMS_VERSION` ne redemande rien : réservé aux corrections de forme.

## Options écartées

- **Refus côté API** : chaque route devrait laisser passer l'acceptation elle-même, les pages légales et la déconnexion, pour un gain nul face à un client qui a déjà accès.
- **Textes en base, modifiables par l'administratrice** : les changements de version deviendraient invisibles dans l'historique du dépôt.
