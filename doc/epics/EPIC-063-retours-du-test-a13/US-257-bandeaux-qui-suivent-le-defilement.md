---
id: US-257
titre: Garder les bandeaux sous les yeux quand la page défile
statut: terminée
epic: EPIC-063
regles: [R15, R14]
adr: [ADR-0093]
---

# US-257 : Garder les bandeaux sous les yeux quand la page défile

En tant qu'organisatrice ou participante, je veux que les bandeaux du haut restent visibles quand je fais défiler la page, afin de ne pas manquer ce qu'ils annoncent quand je suis au milieu ou en bas d'une page.

## Critères d'acceptation

- [x] Étant donné un bandeau affiché (« Une nouvelle version de Limbus est disponible », « Pas de connexion au serveur », « Modifications faites hors ligne »), quand la page défile, alors il reste collé en haut de l'écran.
- [x] Plusieurs bandeaux affichés restent empilés, dans le même ordre : la nouvelle version au-dessus.
- [x] En haut de la page, rien ne change : les bandeaux poussent la page vers le bas, la barre du logo est dessous, et défile avec la page.
- [x] Une fenêtre ouverte (confirmation, panneau des modifications) passe au-dessus des bandeaux.

## Notes techniques

- `app.vue` : les trois bandeaux sont dans un même bloc collé en haut de l'écran (`sticky top-0`), en premier dans `UApp`. Les bandeaux de connexion ne s'affichent, comme avant, que dans l'application ouverte par un compte.
- `nuxt.config.ts` : la racine de l'application isole son empilement (`isolate`), pour que les fenêtres de Nuxt UI, posées après elle dans la page, passent au-dessus du bloc collé.

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : `tests/e2e/pwaUpdate.spec.ts`, le bandeau de nouvelle version reste en haut de l'écran après un défilement ; `tests/e2e/offlineDevice.spec.ts`, une fenêtre ouverte recouvre le bandeau.
- Erreurs de saisie : sans objet, les bandeaux ne demandent aucune saisie.
- Droits : sans objet, les bandeaux sont les mêmes pour tout compte ; ils n'appellent aucune route de plus.
- Hors ligne : `tests/e2e/offlineDevice.spec.ts`, sans réseau et en bas de la page, les bandeaux « Modifications faites hors ligne » et « Pas de connexion au serveur » restent visibles en haut de l'écran.
