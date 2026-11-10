---
titre: Gérer depuis son compte les données gardées pour le hors ligne
statut: archivée
date: 2026-11-10
spec: ../../specs/SPEC-019-hors-ligne-dans-le-compte.md
---

# Gérer depuis son compte les données gardées pour le hors ligne

## Besoin

Une organisatrice qui prépare un jeu sur un lieu sans réseau ne sait pas ce que son appareil a gardé : aujourd'hui, seule une page consultée avec le réseau se rouvre hors ligne (SPEC-010, R1 ; toutes les fiches depuis l'US-212, PR #193). Il lui faut tout préparer à l'avance, voir la place que cela prend, pouvoir l'effacer, et pouvoir ne rien garder sur un appareil prêté ou partagé. Demande de l'utilisatrice du 2026-11-10.

## Proposition

Dans « Mon compte », une section « Hors ligne sur cet appareil », visible pour qui organise ou co-organise au moins un jeu :

- **Tout télécharger pour le hors ligne** : un bouton qui lit et garde sur l'appareil les listes, les fiches, les sessions et leurs PDF, pour consultation sans réseau ; avec l'avancement, et la date du dernier téléchargement.
- **Place prise** : la taille des données gardées sur cet appareil (données, PDF, photos). La mesure du navigateur compte aussi l'application elle-même, gardée pour s'ouvrir sans réseau : à séparer ou à dire (point 8).
- **Effacer** : vide ce que l'appareil garde, sans déconnecter ; s'il reste des modifications faites hors ligne, Limbus le dit avant. Aujourd'hui, effacer l'appareil oublie aussi l'identité gardée pour s'ouvrir sans réseau (SPEC-010 R3) : à garder ou non (point 9).
- **Désactiver** : plus rien n'est gardé sur cet appareil, et ce qui l'était est effacé ; Limbus ne s'ouvre plus hors ligne tant que la case n'est pas recochée.

Ces réglages valent pour l'appareil, et non pour le compte : un autre appareil garde les siens.

## Découpage envisagé

1. Place prise et effacement (sans changement du cache lui-même).
2. Désactivation sur l'appareil.
3. Téléchargement de tout, avec son avancement.

## Points à trancher

1. **Périmètre du téléchargement** : tous ses jeux d'un coup, ou un jeu choisi ? Recommandation : un jeu choisi, avec un bouton par jeu actif, pour ne pas remplir un téléphone de jeux archivés.
2. **PDF et photos** : le téléchargement prend-il aussi les trombinoscopes, les fiches de personnage en PDF et les photos du cast ? Recommandation : oui pour les sessions à venir, non pour les passées.
3. **Contact d'urgence et allergies** : aujourd'hui jamais gardés sur l'appareil (SPEC-007 R1b, US-178). Un téléchargement volontaire les inclut-il, utiles sur le terrain ? Recommandation : non par défaut, avec une case « inclure le contact d'urgence et les allergies » qui le dit clairement.
4. **Effacer avec des modifications en attente** : refuser tant qu'elles ne sont pas parties, ou proposer de les abandonner ? Recommandation : proposer de les envoyer, sinon de les abandonner, comme la déconnexion (SPEC-010 R10).
5. **Désactivation** : les modifications faites sans réseau restent-elles possibles (file seule, sans copie des pages) ? Recommandation : non, plus rien n'est gardé, y compris la file : la page le dit.
6. **Données téléchargées qui vieillissent** : se mettent-elles à jour toutes seules quand le réseau revient, ou seulement au prochain clic ? Recommandation : les pages consultées se mettent à jour comme aujourd'hui, et le bouton affiche la date du dernier téléchargement complet.
7. **Participantes** : la section concerne-t-elle aussi l'espace « Je participe » (documents reçus, trombinoscope) ? Recommandation : plus tard, dans une autre fiche.
8. **Place prise** : afficher seulement les données (pages, PDF, photos), ou tout ce que le navigateur garde, application comprise ? Recommandation : les données seules, avec la place totale en petit.
9. **Identité hors ligne** : effacer garde-t-il de quoi rouvrir Limbus sans réseau pour ce compte (sans les données), ou l'oublie-t-il comme la déconnexion ? Recommandation : la garder, pour qu'un effacement sur le terrain ne bloque pas l'accès ; seule la désactivation l'oublie.

## Suite

Points tranchés par l'utilisatrice le 2026-11-10, avec des choix ajoutés (rythme de la mise à jour, accès perdu, participantes, réglage par défaut) : voir [SPEC-019](../../specs/SPEC-019-hors-ligne-dans-le-compte.md), [ADR-0080](../../adr/ADR-0080-urgence-et-allergies-dans-un-telechargement.md) et [ADR-0081](../../adr/ADR-0081-telechargement-par-le-navigateur.md). Écarts aux recommandations : contact d'urgence et allergies toujours inclus (point 3), mise à jour toute seule (point 6), participantes dans ce chantier (point 7).
