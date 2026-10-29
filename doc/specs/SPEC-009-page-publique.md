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

Cette spec décrit un comportement déjà en production, avant la reprise du développement ([Documentation de l'existant](../archive/todo/documentation-de-l-existant.md)). Elle n'a ni epic ni US. Les écarts constatés entre le code et l'intention sont listés à la fin, sans être corrigés.

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

- **R1** La page montre seulement la présentation du jeu : son titre, sa description, sa note d'intention et son teaser. Un teaser YouTube est intégré en vidéo ; tout autre lien http(s) est un bouton qui ouvre le lien ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R1).
- **R2** Rien d'autre n'en sort : ni contenu d'écriture, ni sessions, ni participants, ni organisatrices, ni crédit d'une copie (voir les écarts).
- **R3** La page n'existe que si le jeu a la marque « page publique » et qu'il est actif (non archivé). Archiver un jeu retire cette marque, et la restauration ne la remet pas ; sur un jeu archivé, la case du formulaire est sans effet ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R3). Une page absente répond « Jeu non publié » (404), que le jeu existe ou non.
- **R4** Un jeu est dépublié par défaut, à la création comme à la copie ([SPEC-002](SPEC-002-copie-de-jeu.md)).
- **R5** La propriétaire et les co-organisatrices publient et dépublient ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R16).
- **R6** L'adresse suit le slug du jeu : renommer le jeu change l'adresse, et l'ancienne ne répond plus (voir les écarts).
- **R7** La page s'affiche toujours en thème clair, sans le menu de l'application.

## Données

- `Game.publicPage` : la marque « page publique ».
- La page ne montre aucune donnée personnelle de participant. La note d'intention et la description sont des textes libres : ce que l'organisation y écrit est public.

## Sécurité et droits

- **R8** La route publique (`/api/public/games/:slug`) ne demande aucune connexion. Elle ne renvoie que les champs de R1, plus le slug et la date de dernière modification du jeu ([ADR-0007](../adr/ADR-0007-isolation-par-jeu.md)).
- **R9** Le teaser n'est intégré en iframe que pour YouTube, à partir d'un identifiant de vidéo vérifié ; un lien saisi n'est accepté qu'en http(s).
- **R10** La page est indexable par les moteurs de recherche (`robots.txt` autorise tout).

## Hors périmètre

- Lien de diffusion et formulaire d'inscription : [SPEC-001](SPEC-001-inscriptions.md), R32.
- En-têtes de sécurité des pages (CSP…) : fiche [Durcissement web](../todo/durcissement-web.md).

## Écarts constatés

Relevés le 29 octobre 2026 avec l'utilisatrice. Aucun n'est corrigé ici.

1. **Crédit d'une copie (R2)** : la page publique d'une copie léguée devrait afficher son crédit, comme sa fiche ([SPEC-002](SPEC-002-copie-de-jeu.md), R11). La route publique ne le renvoie pas.
2. **Lien stable (R6)** : l'adresse de la page devrait rester valable quand le jeu est renommé, par un lien qui ne dépend pas du titre ou par une redirection depuis l'ancien slug. Aujourd'hui, renommer un jeu casse les liens déjà diffusés.
3. **Contenu choisi par l'organisation (R1, R2)** : l'organisation devrait choisir ce que la page affiche en plus de la présentation : les sessions à venir (date et lieu), parmi celles marquées visibles sur la page publique ([SPEC-004](SPEC-004-sessions.md), R2b), et le lien d'inscription d'une période ouverte. Ce lien est déjà prévu en mode formulaire par [SPEC-001](SPEC-001-inscriptions.md) (parcours, R32), mais pas encore réalisé.
4. **Teaser YouTube et cookies (R1)** : la vidéo est intégrée depuis `youtube.com`, qui dépose des traceurs chez le visiteur dès l'affichage de la page, sans information ni consentement. Le domaine `youtube-nocookie.com`, ou une vignette qui ne charge la vidéo qu'au clic, l'éviterait. Relevé en lisant le code.

### Choix faits le 29 octobre 2026

- Écart 1 : la page publique d'une copie affiche son crédit.
- Écart 2 : l'adresse garde le slug du jeu ; chaque ancien slug redirige vers le nouveau après un renommage, et les adresses déjà diffusées continuent de marcher.
- Écart 3 : l'organisation choisit ce que la page affiche (sessions à venir, lien d'inscription) ; traité avec le formulaire public des inscriptions.
- Écart 4 : un teaser YouTube s'affiche en vignette ; rien n'est chargé depuis YouTube avant le clic.

