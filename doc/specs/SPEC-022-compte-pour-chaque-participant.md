---
id: SPEC-022
titre: Un compte pour chaque participant, une seule fiche par personne
statut: implémentée
date: 2026-11-11
origine: ../archive/todo/compte-pour-chaque-participant.md
epics: [EPIC-056, EPIC-057, EPIC-058]
adr: [ADR-0086, ADR-0087, ADR-0088, ADR-0089, ADR-0090]
---

# SPEC-022 : Un compte pour chaque participant, une seule fiche par personne

## Objectif

Une fiche participant appartient à la personne qu'elle décrit, même si cette personne ne s'est jamais inscrite sur Limbus. Quand une équipe crée la fiche d'une adresse sans compte, Limbus pré-crée un compte inactif, que la personne activera si elle le veut. Une personne n'a qu'une fiche dans tout Limbus, et chaque équipe n'en voit que ce qui concerne ses jeux.

Aujourd'hui, la règle « une fiche par personne » ne vaut que dans les jeux d'une même propriétaire ([SPEC-007](SPEC-007-participants-et-rgpd.md), R5) : Paul, inscrit au jeu de Claire et à celui d'Anne, a deux fiches.

Dans cette spec, une **équipe** est la propriétaire d'un jeu et les co-organisatrices de ses jeux. C'est la portée de R5 aujourd'hui.

## Acteurs et parcours

### Organisatrice (Claire)

1. Claire crée la fiche de Paul avec son adresse. S'il n'a pas de compte, Limbus en pré-crée un, sans lui écrire. S'il a déjà une fiche, chez Claire ou chez Anne, la fiche de Claire est cette fiche : ses jeux et ses notes s'y ajoutent.
2. Claire voit le nom et le téléphone qu'elle a saisis, ses jeux, ses notes, ses casts et ses envois. Elle ne voit rien de ce qu'Anne a saisi.
3. Claire corrige l'adresse de Paul : seule Claire suit désormais la nouvelle adresse.
4. Claire retire Paul de ses jeux : elle ne le voit plus. La fiche reste pour Anne.

### Participant (Paul)

1. Paul reçoit un email de Claire (inscription, fiche, paiement…). Une ligne en bas lui dit qu'il peut retrouver tout cela dans son compte Limbus, avec un lien.
2. Il active son compte : par ce lien, par « Mot de passe oublié » ou par l'inscription quand elle est ouverte. Il confirme son adresse par le lien reçu, choisit son mot de passe et accepte les conditions.
3. Son compte part vide. Il voit dans « Je participe » les sessions de Claire et d'Anne, comme aujourd'hui pour une fiche rattachée.
4. Il remplit son téléphone : Claire et Anne voient ce téléphone. Tant qu'il n'a pas rempli ses allergies, chacune garde les allergies qu'elle avait notées.

### Administratrice

La liste des comptes montre les comptes pré-créés avec la mention « non activé », sans action possible. Par défaut, elle n'affiche que les comptes activés.

## Règles métier

### Compte pré-créé

- **R1** Toute fiche participant appartient à un compte : celui de son adresse. Créer une fiche, ou lui donner une adresse, pour une adresse sans compte pré-crée un compte inactif à cette adresse. Aucun email n'est envoyé à cette création.
- **R2** Un compte pré-créé n'a ni mot de passe ni conditions acceptées. On ne peut pas s'y connecter. Une invitation à co-organiser vers son adresse part comme vers une adresse sans compte ; l'accepter active le compte (R9).
- **R3** L'email est obligatoire sur une fiche, à la création comme à la modification, depuis l'interface comme depuis un assistant d'IA. Les fiches existantes sans email sont signalées à leur équipe dans la page Participants. Elles restent modifiables, mais leur enregistrement demande une adresse.

### Une fiche par personne

- **R4** Une adresse n'a qu'une fiche dans tout Limbus. Créer une fiche pour une adresse qui en a déjà une, dans n'importe quelle équipe, ajoute les jeux et les notes de l'équipe à cette fiche. Le message est celui d'une création, sauf si la fiche était déjà dans les jeux de l'équipe (il le dit alors, comme aujourd'hui) : rien ne révèle qu'une autre équipe suit la personne. Cela remplace R5 de SPEC-007, qui se limitait à une propriétaire.
- **R5** Chaque équipe ne voit de la fiche que ses jeux, ses notes, ses casts, ses inscriptions, ses envois et ses paiements, et ses propres valeurs de R6. Une fiche dont l'équipe n'a plus aucun jeu disparaît de sa page Participants.
- **R6** Tant que la personne n'a pas rempli un champ de ses coordonnées, chaque équipe garde sa propre valeur pour ce champ : nom, téléphone, et dans ses inscriptions le contact d'urgence et les allergies. Une valeur saisie par une équipe n'est jamais montrée à une autre.
- **R7** Corriger l'adresse d'une fiche ne vaut que pour l'équipe qui la corrige. Ses jeux, ses notes, ses valeurs de R6 et ses inscriptions passent à la fiche de la nouvelle adresse, créée si besoin (R1, R4). Les autres équipes gardent l'ancienne. La correction ne change jamais l'adresse d'un compte : elle déplace seulement ce qui appartient à l'équipe, y compris quand le compte de l'ancienne adresse est activé (adresse saisie par erreur). Seule la personne change l'adresse de son compte, depuis son compte.
- **R8** À la mise en service, la migration fusionne les fiches d'une même adresse, comparée sans la casse. Chaque équipe garde ses jeux, ses notes, ses casts et ses valeurs de R6. Une fiche fusionnée refuse la photo si l'une des fiches la refusait. Elle garde l'adresse de page (slug) de la plus ancienne ; les adresses de page des autres ne répondent plus.

### Activation

- **R9** Activer un compte, c'est confirmer son adresse puis choisir un mot de passe et accepter les conditions. L'activation passe par « Mot de passe oublié », par l'inscription quand elle est ouverte (une adresse au compte non activé ne répond pas « adresse déjà utilisée »), par le lien des emails (R10), ou par l'acceptation d'une invitation à co-organiser envoyée à cette adresse. Elle passe toujours par un lien envoyé à l'adresse : celle ou celui qui a l'email l'active.
- **R10** Les emails envoyés aux personnes par les équipes (inscription, fiche, trombinoscope, paiement, présence) se terminent par une ligne. Pour un compte non activé, elle invite à retrouver tout cela dans son compte Limbus. Son lien mène à une page qui demande l'adresse et envoie le lien d'activation. L'adresse ne figure jamais dans l'URL.
- **R11** Le compte activé part vide : nom, téléphone, contact d'urgence et allergies à remplir. La personne choisit son nom à l'activation.
- **R12** Un champ rempli par la personne remplace la valeur de toutes ses équipes (recopie de [ADR-0042](../adr/ADR-0042-coordonnees-du-compte.md), désormais champ par champ). Une équipe ne peut plus modifier ce champ. Un champ que la personne n'a pas rempli reste celui de chaque équipe, modifiable par elle. Rien ne se perd à l'activation, en particulier les allergies.

### Durées et effacement

- **R13** Un compte jamais activé échappe à l'effacement après 24 mois sans connexion ([ADR-0056](../adr/ADR-0056-durees-de-conservation.md)). Il est effacé, avec sa fiche, quand plus aucune équipe n'a de jeu sur elle. Une fois activé, il suit la règle des 24 mois.
- **R14** Une équipe qui efface une personne (`eraseParticipant`) n'efface que ce qui la concerne : ses jeux, notes, casts, inscriptions, envois, paiements, photos et ses valeurs de R6. La fiche et le compte restent pour les autres équipes, sinon R13 s'applique.
- **R15** L'export d'une équipe (`exportParticipantData`) ne contient que ce que voit l'équipe (R5, R6). L'export et l'effacement depuis le compte ([ADR-0043](../adr/ADR-0043-effacement-du-compte.md)) restent inchangés : l'effacement du compte efface la fiche pour toutes les équipes et les prévient.
- **R16** La politique de confidentialité dit qu'une équipe qui inscrit une personne lui crée un compte inactif, sans email. Elle dit aussi ce que ce compte contient et quand il est effacé (R13).

## Données

- Compte : un état « non activé » (pas de mot de passe ni de conditions acceptées). L'adresse est celle de la fiche.
- Fiche : une par compte, à l'adresse du compte. Le nom et le téléphone de la fiche deviennent des valeurs par jeu, sur le lien entre la fiche et chaque jeu ([ADR-0086](../adr/ADR-0086-fiche-unique-et-valeurs-par-jeu.md)) : une modification vaut pour les jeux que voit la personne qui modifie (R6). Les notes restent par jeu ([ADR-0040](../adr/ADR-0040-notes-par-jeu.md)), les coordonnées d'inscription restent sur chaque inscription.
- Le modèle de données, la fusion (R8) et la recopie champ par champ (R12) font l'objet d'ADR, avec les lots qui les introduisent.
- Données personnelles : le compte pré-créé est une donnée de plus sur la personne (adresse). Il est couvert par l'export et l'effacement du compte dès l'activation, et par R13 avant. Les valeurs par équipe sont couvertes par l'export et l'effacement de l'équipe (R14, R15).

## Sécurité et droits

- Une équipe ne voit jamais ce qu'une autre a saisi ou fait sur la fiche (R5, R6) : chaque lecture et écriture de fiche est filtrée par les jeux de l'équipe, comme aujourd'hui (`accessibleGameIds`). L'isolation est vérifiée par `tests/integration/isolation.test.ts`, avec une même fiche suivie par Alice et Bob.
- Un message de R4 ou de R7 ne dit pas qu'une autre équipe suit la personne.
- La page de R10 répond la même chose qu'une adresse ait un compte ou non, comme « Mot de passe oublié » aujourd'hui.
- Un compte pré-créé ne peut pas se connecter (R2) ; seul le lien envoyé à l'adresse l'active (R9).

## Lots

1. **Une fiche par personne** : données par équipe (R5, R6), email obligatoire (R3), fiche unique dans tout Limbus (R4), correction d'adresse par équipe (R7), fusion des fiches existantes (R8), effacement et export par équipe (R14, R15).
2. **Compte pré-créé et activation** : compte pré-créé (R1, R2), activation (R9, R11), recopie champ par champ (R12), ligne des emails et sa page (R10), politique de confidentialité (R16).
3. **Durées et administration** : effacement d'un compte jamais activé (R13), mention « non activé » dans l'administration.

## Hors périmètre

- Fusionner deux fiches d'adresses différentes (même personne, deux adresses) : non prévu, comme aujourd'hui.
- Un email à la création du compte pré-créé : écarté (fiche d'origine).
- Montrer à la personne ce que les équipes ont noté sur elle : le compte part vide (R11).

## Historique

- 2026-11-11 : spec rédigée à partir de la [fiche](../archive/todo/compte-pour-chaque-participant.md), avec les choix de l'utilisatrice du 2026-11-09 et du 2026-11-11 : nom par équipe avant l'activation, correction d'adresse pour la seule équipe qui la fait, ligne dans les emails, comptes « non activé » dans l'administration.
- 2026-11-11 : revue de la PR #226 : R2 et R9, une invitation à co-organiser active le compte ; R4, le message ne révèle pas une autre équipe ; R7, la correction d'adresse vaut aussi quand l'ancienne adresse a un compte activé ; R8, la fiche fusionnée garde l'adresse de page de la plus ancienne.
- 2026-11-11 : lot 1 découpé ([EPIC-056](../archive/epics/EPIC-056-une-fiche-par-personne/README.md), US-237 à US-242) ; nom et téléphone rangés par jeu, choix de l'utilisatrice (ADR-0086).
- 2026-11-12 : US-243 ajoutée au lot 1 : une adresse donnée en réponse, déjà celle d'une autre fiche, se prouve par un lien de 7 jours, puis tout passe sur la fiche de l'adresse prouvée (choix de l'utilisatrice, ADR-0087).
- 2026-11-12 : lot 1 terminé et déployé (PR #228 à #238) ; [EPIC-056](../archive/epics/EPIC-056-une-fiche-par-personne/README.md) archivé. Lots 2 et 3 à découper.
- 2026-11-12 : lot 2 découpé ([EPIC-057](../archive/epics/EPIC-057-compte-pre-cree-et-activation/README.md), US-244 à US-247), avec les choix de l'utilisatrice : un compte non activé est un compte sans mot de passe, des pages dédiées à l'activation, un champ vidé par la personne revient aux équipes, une ligne vers « Je participe » pour un compte activé ; R16 passe au lot 2, pour que la politique le dise dès la création des premiers comptes ([ADR-0088](../adr/ADR-0088-compte-pre-cree-sans-mot-de-passe.md), [ADR-0089](../adr/ADR-0089-recopie-champ-par-champ.md)).
- 2026-11-12 : lot 2 terminé et déployé (PR #241 à #244) ; [EPIC-057](../archive/epics/EPIC-057-compte-pre-cree-et-activation/README.md) archivé. Choix de l'utilisatrice pendant le lot : une personne activée peut prendre l'adresse d'un compte non activé, l'administratrice reprend un compte non activé en le créant. Lot 3 à découper.
- 2026-11-12 : lot 3 découpé ([EPIC-058](../archive/epics/EPIC-058-durees-et-administration/README.md), US-248 et US-249), avec les choix de l'utilisatrice : un compte non activé est effacé aussitôt avec sa dernière fiche ([ADR-0090](../adr/ADR-0090-effacement-du-compte-non-active.md)) ; l'administration masque les comptes non activés, inscriptions non confirmées comprises, derrière une case, en lecture seule.
- 2026-11-12 : lot 3 terminé et déployé (PR #247, #248) ; [EPIC-058](../archive/epics/EPIC-058-durees-et-administration/README.md) archivé. Spec implémentée.
