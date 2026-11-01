---
id: ADR-0048
titre: Tirage au sort reproductible, session par session, avec pondérations et places réservées par valeur d'équilibre
statut: accepté
date: 2026-11-01
liens: [../specs/SPEC-001-inscriptions.md, ADR-0045-questions-et-affinites-du-formulaire.md, ADR-0047-selection-des-inscriptions.md]
---

# ADR-0048 : Tirage au sort reproductible, session par session, avec pondérations et places réservées par valeur d'équilibre

## Contexte

[SPEC-001](../specs/SPEC-001-inscriptions.md), lot 3, seconde moitié (R4, R8, R17, R18) : une période ordinaire en mode formulaire peut sélectionner au hasard, ou en mode mixte (choix des orgas, puis tirage sur les places restantes). Deux pondérations : priorité aux personnes non retenues lors d'une période précédente du jeu, et équilibre selon un attribut des personnages.

Choix de l'utilisatrice : le tirage produit des décisions que l'équipe revoit avant d'annoncer ; il procède session par session ; les personnes sans place vont en liste d'attente dans la limite d'une taille réglée par période, les autres sont non retenues ; « non tirés avant » double les chances ; en mode mixte, chaque organisatrice retient jusqu'à N personnes par session ; un tirage s'annule et se refait tant que rien n'est annoncé ; l'attribut d'équilibre est défini par jeu ; « peu importe » comble la valeur qui a le plus de places libres ; une valeur sans assez de candidates laisse ses places libres.

## Décision

- **Réglages de la période** : `selectionMode` (`chosen`, `random`, `mixed`), `organizerPicks` (mode mixte : places que chaque organisatrice retient elle-même par session), `weightNotDrawnBefore`, `weightBalance`, `waitlistSize` (5 par défaut). Le tirage ne concerne pas l'inscription permanente, sélectionnée à la main (R30).
- **Retenir à la main** : `Registration.retainedById` garde qui a retenu. Avant tout tirage, le mode hasard refuse de retenir à la main, et le mode mixte refuse au-delà de `organizerPicks` par organisatrice et par session. Une fois un tirage fait, les corrections sont libres.
- **Tirage** (`RegistrationDraw` : période, graine, réglages, résultat, autrice, date, annulation) : candidates = inscriptions reçues, sans les rejoueurs exclus (R7). Les sessions sont tirées une par une, dans l'ordre des dates, parmi les personnes disponibles pas encore placées. L'ordre d'une session est un tirage pondéré sans remise (clé u^(1/poids), poids 2 pour une personne non retenue ou restée en attente lors d'une autre période du jeu, si la pondération est active), avec un générateur pseudo-aléatoire initialisé par la graine, sur les candidates triées par identifiant : la même graine et les mêmes entrées donnent le même résultat (R18). Le calcul est une fonction pure (`utils/registrationDraw.ts`) ; le journal garde ses entrées complètes (places, réserves, candidates avec poids et préférence). « Période précédente » : une période du jeu créée avant celle-ci. Les places sont recomptées sous le verrou des retenues à la main au moment d'enregistrer.
- **Places** : les places libres de la session (places moins retenues et confirmées). Avec l'équilibre, chaque valeur reçoit sa part des places au prorata des personnages PJ qui la portent (plus forts restes), moins les places déjà prises par des personnes de cette valeur. Dans l'ordre du tirage, une personne prend une place de sa valeur s'il en reste ; « peu importe » (ou pas de réponse) prend une place dans la valeur qui en a le plus de libres. Les places d'une valeur sans assez de candidates restent libres.
- **Liste d'attente** : après toutes les sessions, chaque session met en attente, dans son ordre, les `waitlistSize` premières personnes non placées ; une personne ni placée ni en attente est non retenue. Les décisions sont « à annoncer » (ADR-0047).
- **Annuler** : possible tant qu'aucune personne du tirage n'a reçu d'annonce depuis ; les inscriptions dont la décision est encore celle du tirage repartent à « reçue ». Un seul tirage actif par période ; le journal garde tous les tirages, annulés compris.
- **Attribut d'équilibre** : `Game.balanceAttribute` (nom) et `Game.balanceValues` (valeurs) ; `Character.balanceValue` sur chaque PJ. Seul un PJ porte une valeur ; une valeur retirée du jeu est retirée de ses personnages. La question d'équilibre du formulaire (`balance` : demandée, obligatoire) prend son libellé et ses valeurs dans le jeu à la lecture, plus « Peu importe » ; la réponse va dans `Registration.balancePreference` (vide : peu importe). Une valeur retirée du jeu compte comme « peu importe ».

## Conséquences

- La question d'équilibre suit l'attribut du jeu en vigueur, pas la version du formulaire (écart assumé à R9 pour cette seule question).
- Le journal d'un tirage garde des identifiants d'inscription : il se lit avec les inscriptions de la période ; une inscription effacée y apparaît comme inconnue.

## Options écartées

- **Un ordre unique pour toute la période** : écarté par l'utilisatrice, au profit du tirage session par session.
- **Priorité absolue aux non tirés avant** : écartée, chances doublées.
- **Ouvrir aux autres les places d'une valeur sans candidates** : écarté par l'utilisatrice.
