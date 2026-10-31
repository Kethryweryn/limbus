---
id: SPEC-009
titre: Page publique d'un jeu
statut: validée
date: 2026-10-29
origine: ../archive/todo/documentation-de-l-existant.md
epics: [EPIC-009]
adr: [ADR-0007]
---

# SPEC-009 : Page publique d'un jeu

Cette spec décrit un comportement déjà en production, avant la reprise du développement ([Documentation de l'existant](../archive/todo/documentation-de-l-existant.md)). Les écarts 1, 2 et 4, listés à la fin, sont corrigés par [EPIC-009](../archive/epics/EPIC-009-ecarts-page-publique/README.md) ; l'écart 3 par [EPIC-020](../archive/epics/EPIC-020-formulaire-public/README.md).

## Objectif

Présenter un jeu à des personnes qui n'ont pas de compte, par un lien à diffuser dans les annonces, sans rien montrer de son écriture ni de ses participants.

## Vocabulaire

- **Page publique** : la page `/public/games/<slug>` d'un jeu, lisible sans connexion.
- **Publier** : rendre la page publique accessible. Dépublier la rend introuvable.

## Parcours

1. Sur la fiche d'un jeu actif, l'organisatrice clique « Publier » ; le bouton n'apparaît pas sur un jeu archivé. Elle peut aussi cocher « Publier la page publique » dans le formulaire du jeu, à la création comme à la modification.
2. Le bouton « Page publique » ouvre la page, dont elle copie l'adresse pour ses annonces.
3. « Dépublier » retire la page.

## Règles métier

- **R1** La page montre la présentation du jeu : son titre, sa description, sa note d'intention et son teaser. Au choix de l'équipe, par deux cases de la fiche du jeu décochées par défaut, elle montre aussi les sessions à venir marquées visibles ([SPEC-004](SPEC-004-sessions.md), R2b), avec leur date et leur lieu, et un bouton vers le formulaire de chaque période ouverte en mode formulaire ([SPEC-001](SPEC-001-inscriptions.md), R32 ; [US-086](../archive/epics/EPIC-020-formulaire-public/US-086-page-publique-sessions-et-inscription.md)). Un teaser YouTube s'affiche en vignette : rien n'est chargé depuis YouTube avant le clic sur « Lire la vidéo », qui charge le lecteur ([US-046](../archive/epics/EPIC-009-ecarts-page-publique/US-046-teaser-youtube-au-clic.md)) ; tout autre lien http(s) est un bouton qui ouvre le lien ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R1).
- **R2** Une copie léguée affiche aussi son crédit, comme sur sa fiche ([US-044](../archive/epics/EPIC-009-ecarts-page-publique/US-044-credit-sur-la-page-publique.md)). Rien d'autre n'en sort : ni contenu d'écriture, ni sessions non visibles, ni participants, ni organisatrices.
- **R3** La page n'existe que si le jeu a la marque « page publique » et qu'il est actif (non archivé). Archiver un jeu retire cette marque, et la restauration ne la remet pas ; sur un jeu archivé, la case du formulaire est sans effet ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R3). Une page absente répond « Jeu non publié » (404), que le jeu existe ou non.
- **R4** Un jeu est dépublié par défaut, à la création comme à la copie ([SPEC-002](SPEC-002-copie-de-jeu.md)).
- **R5** La propriétaire et les co-organisatrices publient et dépublient ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R16).
- **R6** L'adresse suit le slug du jeu. Après un renommage, l'ancienne adresse redirige (301) vers la nouvelle, tant qu'aucun autre jeu n'a repris l'ancien slug ([US-045](../archive/epics/EPIC-009-ecarts-page-publique/US-045-lien-stable-de-la-page-publique.md), [ADR-0035](../adr/ADR-0035-anciens-slugs-d-un-jeu.md)).
- **R7** La page s'affiche toujours en thème clair, sans le menu de l'application.

## Données

- `Game.publicPage` : la marque « page publique ».
- La page ne montre aucune donnée personnelle de participant. La note d'intention et la description sont des textes libres : ce que l'organisation y écrit est public.

## Sécurité et droits

- **R8** La route publique (`/api/public/games/:slug`) ne demande aucune connexion. Elle ne renvoie que les champs de R1 (sessions et liens d'inscription seulement si l'équipe les a cochés) et le crédit d'une copie, plus le slug et la date de dernière modification du jeu ([ADR-0007](../adr/ADR-0007-isolation-par-jeu.md)).
- **R9** Le teaser n'est intégré en iframe que pour YouTube, à partir d'un identifiant de vidéo vérifié ; un lien saisi n'est accepté qu'en http(s). La vignette est récupérée par le serveur (`fetchPublicImage`), pour un jeu publié seulement, et servie comme image JPEG vérifiée.
- **R10** La page est indexable par les moteurs de recherche (`robots.txt` autorise tout).

## Hors périmètre

- Lien de diffusion et formulaire d'inscription : [SPEC-001](SPEC-001-inscriptions.md), R32.
- En-têtes de sécurité des pages (CSP…) : fiche [Durcissement web](../todo/durcissement-web.md).

## Écarts constatés

Relevés le 29 octobre 2026 avec l'utilisatrice. Les écarts 1, 2 et 4 sont corrigés par [EPIC-009](../archive/epics/EPIC-009-ecarts-page-publique/README.md) (R2, R6, R1), l'écart 3 par [EPIC-020](../archive/epics/EPIC-020-formulaire-public/README.md) (R1) : il n'en reste aucun.

3. **Contenu choisi par l'organisation (R1, R2)** : l'organisation devrait choisir ce que la page affiche en plus de la présentation : les sessions à venir (date et lieu), parmi celles marquées visibles sur la page publique ([SPEC-004](SPEC-004-sessions.md), R2b), et le lien d'inscription d'une période ouverte. Ce lien est déjà prévu en mode formulaire par [SPEC-001](SPEC-001-inscriptions.md) (parcours, R32), mais pas encore réalisé.

### Choix faits le 29 octobre 2026

- Écart 1 : la page publique d'une copie affiche son crédit.
- Écart 2 : l'adresse garde le slug du jeu ; chaque ancien slug redirige vers le nouveau après un renommage, et les adresses déjà diffusées continuent de marcher.
- Écart 3 : l'organisation choisit ce que la page affiche (sessions à venir, lien d'inscription) ; le 31 octobre 2026, deux cases sur la fiche du jeu.
- Écart 4 : un teaser YouTube s'affiche en vignette ; rien n'est chargé depuis YouTube avant le clic.

