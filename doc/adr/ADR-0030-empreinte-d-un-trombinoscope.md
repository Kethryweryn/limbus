---
id: ADR-0030
titre: Une empreinte du contenu repère un trombinoscope périmé
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-005-trombinoscopes-et-pdf.md, ../epics/EPIC-005-ecarts-trombinoscopes/US-028-trombinoscopes-perimes.md]
---

# ADR-0030 : Une empreinte du contenu repère un trombinoscope périmé

## Contexte

Un trombinoscope généré est enregistré tel quel (HTML et PDF). Rien n'indique s'il correspond encore au casting, aux photos et aux réglages du moment ([SPEC-005](../specs/SPEC-005-trombinoscopes-et-pdf.md), écart 3). Ce qu'il contient dépend de nombreuses sources : les personnages du jeu, leurs réglages par défaut, la configuration du personnage qui regarde, les factions affichées, le casting et les photos de la session, le nom de la session et du jeu. Comparer des dates de modification demanderait une date fiable sur chacune, et une modification sans effet sur le contenu (une histoire réécrite) le déclarerait périmé à tort.

## Décision

- La génération calcule, pour chaque trombinoscope, une empreinte SHA-256 de ce qu'il affiche : titre du jeu, nom de la session, nom du personnage qui regarde et, pour chaque entrée, le personnage regardé, le nom affiché, la note, l'adresse de la photo retenue, le visage caché ou non et les factions affichées. Elle est enregistrée dans `SessionTrombinoscope.sourceHash`.
- À la lecture du tableau des documents, l'empreinte est recalculée avec les mêmes fonctions que la génération, sans charger les images. Un trombinoscope est périmé quand les deux diffèrent, ou quand il n'a pas d'empreinte (généré avant cette décision).
- L'adresse de la photo suffit : une photo téléversée reçoit un nouveau nom (UUID) à chaque envoi, donc un changement de photo change l'adresse.

## Conséquences

- Seul ce qui change le contenu le rend périmé ; une modification annulée le rend de nouveau à jour.
- Le calcul relit les personnages, les réglages et le casting de la session à chaque affichage du tableau des documents : quelques requêtes, sans image.
- Une image externe remplacée à la même adresse n'est pas détectée.
- Les trombinoscopes générés avant le déploiement apparaissent périmés : il faut les générer à nouveau une fois, ce qui applique aussi les nouvelles règles de photo et de soi-même.

## Options écartées

- **Comparer les dates de modification** des personnages, réglages et attributions à la date de génération : plusieurs tables n'ont pas de date de modification, et des changements sans effet sur le contenu le déclareraient périmé.
- **Marquer « périmé » à chaque écriture** concernée : il faudrait toucher chaque route qui modifie un personnage, une faction, un réglage ou le casting, avec le risque d'en oublier une.
- **Régénérer automatiquement** : choix écarté par l'utilisatrice, qui veut relire avant d'envoyer.
