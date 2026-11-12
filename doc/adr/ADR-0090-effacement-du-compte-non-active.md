---
id: ADR-0090
titre: Un compte non activé est effacé avec la dernière fiche qui porte son adresse
statut: accepté
date: 2026-11-12
liens: [SPEC-022, ADR-0056, ADR-0088]
---

# ADR-0090 : Un compte non activé est effacé avec la dernière fiche qui porte son adresse

## Contexte

[SPEC-022](../specs/SPEC-022-compte-pour-chaque-participant.md) (R13) demande deux choses pour un compte jamais activé :

- il échappe à l'effacement après 24 mois sans connexion ([ADR-0056](ADR-0056-durees-de-conservation.md)) ;
- il est effacé, avec sa fiche, quand plus aucune équipe n'a de jeu sur elle.

Depuis [ADR-0088](ADR-0088-compte-pre-cree-sans-mot-de-passe.md), la règle des 24 mois ne vise déjà que les comptes activés.

En revanche, un compte non activé sans fiche n'est effacé que par le nettoyage des inscriptions non confirmées. Ce nettoyage passe lors d'une connexion et ne vise que les comptes créés depuis plus de 7 jours. Un compte peut donc rester quelques jours sans aucune fiche.

L'utilisatrice a choisi, le 2026-11-12, de l'effacer aussitôt.

## Décision

1. Toute suppression de fiche efface, dans la même transaction, le compte non activé de son adresse s'il ne porte plus aucune fiche. Les suppressions concernées :
   - l'effacement par une équipe (`eraseParticipant`) ;
   - le retrait du dernier jeu de la fiche ;
   - l'effacement automatique des fiches inactives ;
   - la réunion de deux fiches.
2. Un compte activé n'est jamais effacé ainsi : il suit la règle des 24 mois.
3. Le nettoyage des inscriptions non confirmées continue d'effacer les comptes sans fiche qu'il trouve encore : une inscription jamais confirmée, ou un compte que rien n'a effacé.
4. La politique de confidentialité dit : « Compte non activé : tant qu'une fiche participant porte son adresse ».

## Conséquences

- Quand plus aucune équipe ne suit la fiche d'une personne, il ne reste rien sur elle : ni son adresse, ni son compte.
- Une équipe qui recrée la fiche plus tard recrée un compte non activé.

## Options écartées

- **Effacer au plus 7 jours après** : le nettoyage actuel suffisait, mais l'adresse restait quelques jours sans raison. Écarté par l'utilisatrice.
