---
id: ADR-0080
titre: Le téléchargement d'un jeu garde le contact d'urgence et les allergies sur l'appareil
statut: accepté
date: 2026-11-10
liens: [../specs/SPEC-019-hors-ligne-dans-le-compte.md, ../specs/SPEC-007-participants-et-rgpd.md, ADR-0012-donnees-hors-ligne.md]
---

# ADR-0080 : Le téléchargement d'un jeu garde le contact d'urgence et les allergies sur l'appareil

## Contexte

Le contact d'urgence et les allergies d'une personne s'affichent sur sa fiche, mais ne sont jamais gardés sur l'appareil ([US-178](../archive/epics/EPIC-045-retours-du-cahier-de-tests/US-178-urgence-et-allergies-sur-la-fiche.md), [US-212](../archive/epics/EPIC-050-tests-par-ecran/US-212-fiches-hors-ligne.md)) : ce sont des données de santé, et une fiche consultée en passant ne devait pas les laisser sur un téléphone. Or c'est sur le lieu du GN, souvent sans réseau, que l'équipe en a besoin. [SPEC-019](../specs/SPEC-019-hors-ligne-dans-le-compte.md) ajoute un téléchargement volontaire de tout un jeu ; l'utilisatrice a choisi, le 2026-11-10, qu'il les inclue toujours.

## Décision

- Une fiche consultée ne garde toujours pas le contact d'urgence ni les allergies (US-178, US-212 inchangées).
- Le téléchargement d'un jeu (SPEC-019, R9, R10) les garde pour chaque participant du jeu, sans case à cocher. La section du compte le dit à côté du bouton.
- Ils partent de l'appareil avec le reste du jeu : effacement, désactivation, accès perdu au jeu (SPEC-019, R15), déconnexion et connexion d'un autre compte.

## Conséquences

- Hors ligne, la fiche d'un participant d'un jeu téléchargé montre son contact d'urgence et ses allergies.
- Un appareil perdu après un téléchargement expose ces données, non chiffrées ([ADR-0012](ADR-0012-donnees-hors-ligne.md)). La page de confidentialité le dit, dans la PR de l'US-226.
- La désactivation sur un appareil prêté (SPEC-019, R5) et l'effacement à l'accès perdu deviennent des garde-fous de données de santé, à tester comme tels.

## Options écartées

- **Une case « inclure le contact d'urgence et les allergies », décochée par défaut** : recommandée par la fiche, écartée par l'utilisatrice ; l'équipe sur le terrain en a toujours besoin.
- **Ne jamais les garder** : l'équipe resterait sans ces informations là où elles servent.
