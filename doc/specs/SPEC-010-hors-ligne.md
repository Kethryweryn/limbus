---
id: SPEC-010
titre: Mode hors ligne
statut: validée
date: 2026-10-29
origine: ../archive/todo/documentation-de-l-existant.md
epics: []
adr: [ADR-0006, ADR-0012]
---

# SPEC-010 : Mode hors ligne

Cette spec décrit un comportement déjà en production, avant la reprise du développement ([Documentation de l'existant](../archive/todo/documentation-de-l-existant.md)). Elle n'a ni epic ni US. Les écarts constatés entre le code et l'intention sont listés à la fin, sans être corrigés.

## Objectif

Continuer à consulter un jeu sur le lieu du GN, où le réseau manque souvent, et y noter des modifications qui partiront au retour du réseau. Ne rien laisser sur un appareil prêté une fois la session fermée ([ADR-0012](../adr/ADR-0012-donnees-hors-ligne.md)).

## Vocabulaire

- **Hors ligne** : le navigateur n'a plus de réseau, ou le serveur ne répond pas (pas de réponse, ou erreur 502, 503, 504).
- **Cache de l'appareil** : les données gardées dans le navigateur (base IndexedDB `limbus-db`, cache des photos, identité hors ligne).
- **File d'attente** : les modifications faites hors ligne, en attente d'envoi.
- **Resynchronisation** : l'envoi de la file d'attente au retour du réseau.

## Parcours

### Consulter hors ligne

1. Avec le réseau, l'organisatrice ouvre les pages qu'elle voudra consulter : chacune garde sa dernière version sur l'appareil.
2. Sans réseau, un bandeau signale que le serveur est indisponible. Les listes s'affichent depuis le cache de l'appareil.
3. Elle clique « Réessayer » pour revérifier la connexion.

### Modifier hors ligne

1. Elle crée, modifie ou supprime un élément. La modification s'affiche aussitôt et part dans la file d'attente ; un bandeau en donne le nombre.
2. Au retour du réseau, la file est envoyée (R7). Une fenêtre bloque l'écran pendant l'envoi, puis la page se recharge si tout est passé.
3. Si des modifications échouent, un bandeau en donne le nombre.

## Règles métier

### Consultation

- **R1** Le cache de l'appareil contient le tableau de bord et les listes des jeux, personnages, factions, intrigues, objets, documents, événements de chronologie, participants, lieux et sessions, telles qu'elles ont été chargées la dernière fois. Les pages de détail (une session, un personnage) ne sont pas en cache (voir les écarts).
- **R2** Les photos d'attribution déjà affichées sont gardées dans le cache du navigateur : 300 au plus, 30 jours au plus.
- **R3** Sans réseau, l'application reste ouverte pour le dernier compte connecté sur l'appareil pendant 7 jours après sa dernière connexion au serveur. Passé ce délai, elle demande de se connecter. Cette identité locale n'ouvre aucun droit sur le serveur.
- **R4** Un 401 du serveur (session expirée ou révoquée) oublie l'identité locale et ramène à l'écran de connexion, en gardant le cache : le même compte le retrouve en se reconnectant. Un 403 est un refus ponctuel, qui ne déconnecte pas.

### Modifications hors ligne

- **R5** Partent dans la file les créations, modifications et suppressions des jeux, du contenu d'un jeu, des participants, des lieux et des sessions. Une action (POST ou DELETE sur une sous-route : envoi d'emails, génération, legs, partage…) n'y part jamais : hors ligne, elle échoue. Un téléversement de fichier non plus. En revanche, une modification (PUT) sur une sous-route part dans la file : chronologie d'une session, statut ou réglages de paiement (voir les écarts).
- **R6** Une modification mise en file s'applique aussitôt au cache de l'appareil, marquée « en attente ». Un élément créé hors ligne reçoit un identifiant provisoire, remplacé par le vrai à l'envoi, y compris dans les modifications suivantes de la file.
- **R7** La file est envoyée dans l'ordre quand le réseau revient (événement du navigateur), quand le serveur répond de nouveau, sur « Réessayer », ou au changement de page si le serveur était marqué indisponible. Elle n'est pas envoyée à la simple ouverture de l'application (voir les écarts). Si le réseau retombe pendant l'envoi, l'envoi s'arrête et reprend plus tard.
- **R8** Une modification qui porte la date de la version lue est refusée si l'élément a été modifié entre-temps sur le serveur (409). Les suppressions ne sont pas contrôlées.
- **R9** Une modification refusée reste en erreur dans la file ; les suivantes sont envoyées quand même. Le bandeau donne le nombre d'erreurs, sans le détail (voir les écarts).

### Appareil partagé

- **R10** La déconnexion efface tout le cache de l'appareil : données, file d'attente, photos et identité locale. S'il reste des modifications en attente, elle demande d'abord de confirmer leur perte.
- **R11** À la connexion d'un autre compte, le cache laissé par le précédent est effacé, file d'attente comprise, pour que ses modifications ne partent pas sous le nouveau compte.

## Données

- Le cache de l'appareil contient des données personnelles : coordonnées des participants, photos. Il n'est pas chiffré ([ADR-0012](../adr/ADR-0012-donnees-hors-ligne.md), options écartées). Il reste sur l'appareil jusqu'à la déconnexion, ou jusqu'à la connexion d'un autre compte.
- Le serveur ne garde rien du mode hors ligne.

## Sécurité et droits

- **R12** Le serveur applique les mêmes contrôles à une modification rejouée qu'à une autre : session valide, accès au jeu, validation du corps de la requête.
- **R13** Les pages publiques et le lien personnel d'inscription ([SPEC-001](SPEC-001-inscriptions.md)) n'utilisent pas le cache de l'application.

## Hors périmètre

- Installation de l'application (PWA) et mise à jour du service worker : comportement standard de `@vite-pwa/nuxt`.
- Contrôle de conflit et traitement des erreurs de resynchronisation : fiche [Resynchronisation hors ligne](../todo/resynchronisation-hors-ligne.md).

## Écarts constatés

Relevés le 29 octobre 2026 avec l'utilisatrice. Aucun n'est corrigé ici.

1. **Page de session hors ligne (R1)** : sur le lieu du GN, il faut au moins la page de la session (casting, déroulé, fiche allergies, trombinoscopes) et les fiches des personnages. Aujourd'hui, elles ne s'ouvrent pas sans réseau.
2. **Erreurs de resynchronisation (R8, R9)** : une modification refusée reste en erreur sans qu'on puisse la voir, la corriger ou l'abandonner, sauf en se déconnectant, ce qui efface tout. Les suppressions rejouées ne sont pas contrôlées ([revue](../revues/2026-10-29-architecture.md), R-13). Repris dans la fiche [Resynchronisation hors ligne](../todo/resynchronisation-hors-ligne.md).
3. **Déconnexion sans réseau (R10)** : la page de déconnexion appelle le serveur avant d'effacer l'appareil. Sans réseau, cet appel échoue et l'effacement n'a sans doute pas lieu : les données resteraient sur l'appareil. Relevé en lisant le code, non vérifié sur un appareil.
4. **Modifications de sous-routes en file (R5)** : un PUT sur une sous-route d'une session (chronologie, statut ou réglages de paiement) part dans la file, et son corps est fusionné par erreur dans l'entrée de la session en cache. Un paiement validé hors ligne reçoit la date de la resynchronisation. Relevé par la revue de code, non vérifié sur un appareil.
5. **Envoi à l'ouverture (R7)** : des modifications laissées en attente ne partent pas quand on rouvre l'application avec le réseau. Elles attendent un changement de réseau ou « Réessayer », que rien ne propose tant que le serveur répond. Relevé par la revue de code, non vérifié sur un appareil.
