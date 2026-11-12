---
id: US-250
titre: La page d'accueil et les icônes passent la CSP, et les tests le vérifient
statut: terminée
epic: EPIC-059
regles: []
adr: [ADR-0091]
---

# US-250 : La page d'accueil et les icônes passent la CSP, et les tests le vérifient

En tant qu'exploitante, je veux qu'aucun écran ne provoque de violation de CSP, et que les tests me le prouvent, afin de pouvoir la rendre bloquante sans casser de page.

## Critères d'acceptation

- [x] Les pages ont `script-src 'self' 'nonce-…'`, sans `'strict-dynamic'` ; la page d'accueil prérendue a `script-src 'self'` et les empreintes de ses scripts intégrés.
- [x] Les icônes de Limbus et de Nuxt UI sont servies par Limbus et embarquées dans le code de la page ; aucune n'est demandée à `api.iconify.design`.
- [x] La suite de bout en bout échoue si la CSP a signalé une violation pendant ses tests.
- [x] La CSP reste en mode rapport.

## Notes techniques

`nuxt.config.ts` (`security`, `icon`), dépendances `@iconify-json/heroicons` et `@iconify-json/lucide`, `tests/e2e/globalTeardown.ts`.

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) ; un axe qui ne s'applique pas dit pourquoi :

- Actions : toute la suite sert de test, par son `globalTeardown` : chaque écran qu'elle ouvre, la page d'accueil comprise, doit passer la CSP.
- Erreurs de saisie : sans objet, aucune saisie n'est ajoutée ni changée.
- Droits : sans objet, aucune route ni aucun écran ne change de droits.
- Hors ligne : sans objet pour un test dédié. La page d'accueil reste prérendue et gardée par le service worker comme avant ; les tests hors ligne existants la couvrent, et le garde-fou y relève aussi les violations.

Intégration (`webHardening.test.ts`) : la politique des pages et de la page d'accueil ; les icônes des deux collections servies par Limbus.

Vérifié : la suite complète passe (267 tests de bout en bout, 830 d'intégration) ; avec `'strict-dynamic'` remis, `auth.spec.ts` seul fait échouer la suite sur la page d'accueil.
