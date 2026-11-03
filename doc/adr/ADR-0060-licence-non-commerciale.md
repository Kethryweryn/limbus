---
id: ADR-0060
titre: Licence PolyForm Noncommercial à la place de MIT
statut: accepté
date: 2026-11-03
liens: [ADR-0001-documentation-du-projet.md]
---

# ADR-0060 : Licence PolyForm Noncommercial à la place de MIT

## Contexte

Le dépôt est public, sous licence MIT : tout le monde peut reprendre le code, y compris pour le vendre ou en faire un service payant. L'utilisatrice ne veut plus d'utilisation commerciale. Elle est la seule autrice du code (ses deux adresses ; Dependabot ne fait que monter des versions) : elle peut changer la licence seule.

Une licence qui interdit l'usage commercial n'est pas « open source » au sens de l'OSI : le code devient « source disponible ».

## Décision

Le code passe sous [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0) : texte officiel dans `LICENSE`, précédé de la ligne `Required Notice` qui doit accompagner toute copie, et identifiant SPDX `PolyForm-Noncommercial-1.0.0` dans `package.json`.

Elle permet l'usage personnel et de loisir, et celui des associations, de l'enseignement, de la recherche et des administrations, même financés. Elle interdit l'usage par une entreprise qui en tire un revenu. Les modifications n'ont pas à être republiées.

## Conséquences

- Une association de GN qui fait payer ses inscriptions peut utiliser le code ; une entreprise qui vend des GN ne le peut pas.
- Les versions publiées avant ce changement restent sous MIT pour qui les a déjà récupérées : une licence accordée ne se retire pas.
- La licence porte sur le code. L'usage du service limbuslarp.fr relève des conditions d'utilisation, qui ne changent pas.
- Les dépendances (MIT, Apache, ISC…) permettent d'être intégrées dans un projet sous une autre licence ; leurs propres licences restent celles de leurs paquets.
- GitHub ne reconnaît pas forcément cette licence et peut afficher « Other ».

## Options écartées

- **CC BY-NC-SA 4.0** : non commerciale aussi, mais Creative Commons déconseille ses licences pour du logiciel (pas de clause sur les brevets ni sur le code source).
- **AGPL-3.0** : oblige à publier les modifications d'un service en ligne, mais n'interdit pas l'usage commercial.
