---
id: US-184
titre: Recevoir une nouvelle version sans perdre sa saisie
statut: terminée
epic: EPIC-045
regles: [R14]
adr: [ADR-0071]
---

# US-184 : Recevoir une nouvelle version sans perdre sa saisie

En tant que personne qui utilise Limbus, je veux que la nouvelle version se charge quand je change de page, afin de ne pas perdre ce que je suis en train de taper (retour A6-2 du cahier).

## Critères d'acceptation

- [x] Étant donné une nouvelle version déployée pendant que je remplis un formulaire, alors la page ne se recharge pas d'elle-même.
- [x] Étant donné une nouvelle version qui attend, quand je change de page en ligne, alors la page arrivée se recharge aussitôt dans la nouvelle version. Changer seulement d'onglet ou de filtre ne recharge rien.
- [x] Hors ligne, ou quand le serveur est indisponible, un changement de page ne recharge rien.

## Notes techniques

`nuxt.config.ts` (`registerType: 'prompt'`), `plugins/pwaUpdate.client.ts`, `utils/pwaUpdate.ts`, bandeau anglais retiré de `layouts/default.vue`. [SPEC-010](../../specs/SPEC-010-hors-ligne.md), R14 ; [ADR-0071](../../adr/ADR-0071-mise-a-jour-au-changement-de-page.md). Choix de l'utilisatrice le 2026-11-08 : au prochain changement de page, sans bandeau. Le rechargement pendant la saisie n'a pas été reproduit : la cause retenue est celle que décrit la documentation du module.

## Tests

`tests/utils/pwaUpdate.test.ts`. Le passage d'une version à l'autre ne se joue pas dans Playwright, qui ne déploie pas deux versions.
