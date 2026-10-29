---
id: ADR-0036
titre: Protocole de resynchronisation : version lue sur toute écriture rejouée, retenue par élément
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-010-hors-ligne.md, ../archive/epics/EPIC-010-ecarts-hors-ligne/US-050-conflit-a-la-resynchronisation.md, ADR-0028-version-d-une-session.md]
---

# ADR-0036 : Protocole de resynchronisation : version lue sur toute écriture rejouée, retenue par élément

## Contexte

Les modifications faites hors ligne sont rejouées au retour du réseau. Le contrôle de conflit (`assertUnmodifiedSince`, en-tête `If-Unmodified-Since`) ne vaut que pour les modifications qui portent la date de la version lue : jamais pour les suppressions, ni pour les paiements, les réglages de paiement, les tarifs et le trombinoscope d'un personnage ([SPEC-010](../specs/SPEC-010-hors-ligne.md), écart 2 ; [revue](../revues/2026-10-29-architecture.md), R-13). Le cache de l'appareil date en outre une modification hors ligne de l'heure de l'appareil : la modification suivante du même élément passe alors le contrôle sans rien vérifier. Une modification refusée ne retient rien : les suivantes du même élément partent sur une base que le serveur n'a pas.

## Décision

- **Version** : la date de modification de ce qu'on a lu, envoyée dans `If-Unmodified-Since`. Le serveur refuse (409) si la version actuelle est plus récente. Toute écriture mise en file la porte :
  - modification d'un élément : son `updatedAt` (déjà le cas) ;
  - suppression : l'`updatedAt` de l'élément en cache ;
  - déroulé d'une session : `Session.updatedAt` ([ADR-0028](ADR-0028-version-d-une-session.md)) ;
  - paiement d'une personne (payé, offert, départ, remboursement, tarif) : `SessionPayment.updatedAt`, ou la date zéro si la ligne n'existait pas encore ;
  - réglages de paiement : nouvelle colonne `Session.paymentSettingsUpdatedAt` (date zéro si jamais réglés), qui ne touche pas la version de la session ;
  - tarif : `SessionTariff.updatedAt` ;
  - trombinoscope d'un personnage : la date de sa dernière entrée (date zéro sans entrée).
- **Cache** : une modification hors ligne garde dans le cache la version lue, jamais l'heure de l'appareil.
- **Chaînage** : quand une modification passe, les suivantes du même élément qui partaient de la même version prennent la version renvoyée par le serveur.
- **Élément** : la ressource et son identifiant (`sessions/<id>`), sous-routes comprises. Une modification en erreur retient les suivantes du même élément, et celles qui citent un élément créé hors ligne encore en attente ; celles des autres éléments partent.
- **Conflit** : le client relit la version du serveur, la garde avec la modification, et compare les champs envoyés. « Garder ma version » renvoie la modification sans version (elle remplace celle du serveur) ; « Garder celle du serveur » la retire de la file.
- **Dates d'action** : un paiement validé porte la date du clic (`paidAt`) ; le serveur la prend si elle n'est pas dans le futur.

## Conséquences

- Les mêmes contrôles valent en ligne quand une page envoie la version : le tableau des paiements et le trombinoscope l'envoient désormais, et se rechargent après chaque enregistrement.
- Une requête sans version n'est pas contrôlée : les autres clients gardent leur comportement.
- Une migration ajoute une colonne facultative : elle ne casse pas le build en service ([ADR-0024](ADR-0024-migrations-compatibles-avec-le-build-en-service.md)).

## Options écartées

- **Fusion automatique champ par champ** : l'utilisatrice préfère voir les champs qui diffèrent et choisir.
- **Comparer les valeurs lues plutôt que les dates** : aucun champ de date à ajouter, mais il faudrait garder et renvoyer toute la version lue, et la comparer route par route.
- **Une version unique par session pour tout son contenu** : enregistrer un paiement entrerait en conflit avec le casting ([ADR-0028](ADR-0028-version-d-une-session.md)).
