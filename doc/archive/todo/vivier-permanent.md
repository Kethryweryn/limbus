---
titre: Un seul mode d'inscription, le vivier permanent
statut: prête
date: 2026-11-06
spec: ../../specs/SPEC-018-vivier-permanent.md
---

# Un seul mode d'inscription, le vivier permanent

Origine : retour A4-4 du cahier de tests fonctionnels. Devenue [SPEC-018](../../specs/SPEC-018-vivier-permanent.md).

## Besoin

Un jeu peut avoir une inscription permanente et des périodes d'inscription par session. Une même personne peut donc se retrouver dans deux périodes du même jeu et remplir plusieurs fois le questionnaire. Cela n'a pas de sens pour les personnes qui s'inscrivent, ni pour l'équipe qui doit croiser ces listes.

## Proposition

Il n'y a plus qu'un seul mode : le vivier permanent du jeu. Le parcours d'une personne :

| Étape | Statut |
|---|---|
| Réponse au questionnaire du vivier | Intéressée |
| Disponibilité validée pour une date | Pré-inscrite |
| Après le casting | Castée |
| Présence validée après le casting | Inscrite |
| Premier versement | Inscrite validée |
| Présence annulée | Annulation |

Le questionnaire demande les disponibilités sur les sessions ouvertes. Quand une session s'ouvre, l'équipe peut écrire au vivier pour demander qui est intéressé et disponible, en rappelant que chacun peut revoir ses réponses.

## Découpage envisagé

Trois lots : le vivier unique avec un statut par session, la demande de disponibilités, puis le casting. Voir la spec.

## Points tranchés avec l'utilisatrice

- **Tirage au sort :** gardé, par session, parmi les pré-inscrits.
- **Invitation :** l'équipe invite à rejoindre le vivier ; il n'y a plus d'invitation directe sur une session.
- **Plusieurs sessions :** le statut se lit session par session ; une personne peut avancer sur plusieurs sessions du même jeu.
- **Castée :** retenue pour une session, avec ou sans personnage.
- **Inscrite validée :** dès le premier versement. Sans rien à payer (place offerte, session sans tarif), dès la présence confirmée.
- **Disponibilités :** question facultative, absente s'il n'y a aucune session ouverte.
- **Session listée :** seulement si l'équipe l'a ouverte à la pré-inscription.
- **Email de demande :** deux boutons « disponible » et « pas disponible » qui confirment sur une page, plus un lien vers ses réponses. Rien ne part sans clic de l'équipe ; une relance vise celles qui n'ont pas répondu ; les rejoueurs exclus ne le reçoivent pas.
- **Sans place :** la liste d'attente reste, par session. « Non retenue » disparaît. Après un tirage, les personnes au-delà de la liste d'attente restent pré-inscrites.
- **Ouverture du vivier :** à la main, un par jeu. Le fermer bloque les nouvelles entrées ; les personnes déjà dedans gardent leur accès.
- **Revenir sur ses réponses :** la dernière version du questionnaire, avec ses anciennes réponses reprises.
- **Personne castée qui change ses réponses :** c'est possible ; l'équipe reçoit un email et voit un repère jusqu'à ce qu'une organisatrice l'ait lu. Pas d'alerte avant le casting.
- **Annulation :** vaut pour une session. « Quitter le vivier » est un autre bouton, qui retire tout.
- **Annonces :** rien n'est automatique pour une personne castée. La première annonce écrit à toutes les personnes retenues ; ensuite, à chaque changement du cast, Limbus propose à l'organisatrice d'envoyer un email individuel. Prévenir la liste d'attente est au choix des organisatrices.
- **Assistant de casting :** il ne propose que des personnes pré-inscrites. Une autre personne du vivier s'ajoute à la main.
- **Bascule :** les périodes de chaque jeu sont regroupées en un vivier, avec les réponses les plus récentes d'une personne présente plusieurs fois ; les jeux de test sont ensuite rechargés.
