---
id: SPEC-023
titre: Valider les saisies partout
statut: en cours
date: 2026-11-17
origine: ../archive/todo/validation-des-saisies.md
epics: [EPIC-060]
adr: [ADR-0092]
---

# SPEC-023 : Valider les saisies partout

## Objectif

Limbus refuse une saisie qui ne peut pas être juste et dit pourquoi, sous le champ concerné. Les cas visés :

- un nom de personne avec des chiffres ;
- un téléphone qui n'en est pas un ;
- un contact d'urgence à moitié rempli ;
- un texte d'une longueur démesurée.

Cette spec répond aux retours A9-1, A9-2 et A10-1 du cahier de tests, et étend leurs règles à tous les champs saisis.

## Parcours

### Toute personne qui saisit des coordonnées

1. Elle écrit son nom « Jean-Pierre O'Neill » : il est accepté. Si elle écrit « Jean2 », le message « Le nom ne peut contenir que des lettres, des espaces, des traits d'union, des apostrophes et des points » s'affiche sous le champ.
2. Elle écrit son téléphone « 06 12 34 56 78 » : il est rangé sous la forme +33612345678, et c'est sous cette forme qu'elle le relit.
3. Elle écrit un numéro belge « +32 470 12 34 56 » : il est accepté et rangé sous la forme +32470123456.
4. Elle écrit « 12 » ou « bonjour » : le message « Numéro de téléphone invalide » s'affiche sous le champ.
5. Elle remplit le nom de son contact d'urgence sans son téléphone : le message « Le téléphone du contact d'urgence est obligatoire » s'affiche sous le champ du téléphone.

### Organisatrice

1. Sur la fiche d'un participant, son nom et son téléphone suivent les mêmes règles.
2. Elle colle dans l'historique d'un personnage un texte de plusieurs centaines de pages : il est accepté jusqu'à 1 000 000 de caractères.
3. Un texte trop long est refusé, avec son plafond dans le message, par exemple « Le nom : 200 caractères au plus ».

### Assistant d'IA

1. Les outils d'écriture (`creer_participant`, `modifier_participant`, `enregistrer_personnage`…) appliquent les mêmes règles, avec les mêmes messages.

## Règles métier

### Noms de personnes

- **R1 :** un nom de personne ne contient que des lettres, des espaces, des traits d'union, des apostrophes (' ou ’) et des points. Toutes les lettres sont acceptées, avec leurs accents et dans tous les alphabets. Il contient au moins une lettre. Les espaces en double ou aux extrémités sont retirés. Il fait 100 caractères au plus.
- **R2 :** R1 vaut pour :
  - le nom d'un compte : inscription, activation, Mon compte, administration, invitation dans une équipe ;
  - le nom d'une fiche participant : fiche, invitation au questionnaire ;
  - le prénom et le nom du questionnaire d'inscription ;
  - le nom du contact d'urgence, dans le compte comme dans le questionnaire.
- **R3 :** ne sont pas des noms de personnes au sens de R1 :
  - les noms de personnages ;
  - le nom affiché sur un trombinoscope ;
  - le nom Facebook ;
  - le nom d'expéditeur des emails ;
  - un nom que Limbus compose lui-même à partir de l'adresse email, faute de nom saisi.

  Ce sont des textes, soumis aux seules longueurs de R9.

### Téléphones

- **R4 :** un téléphone est vérifié selon son pays.
  - Un numéro écrit sans indicatif, commençant par 0, est un numéro français.
  - Un numéro étranger s'écrit avec son indicatif : +32…, ou 0032….
  - Un numéro que son pays ne reconnaît pas est refusé : « Numéro de téléphone invalide ».
- **R5 :** les espaces, points, tirets et parenthèses sont acceptés à la saisie, puis retirés. Le « (0) » d'un « +33 (0)6… » est retiré aussi.
- **R6 :** un téléphone est rangé, affiché et exporté sous une seule forme : le + et l'indicatif, puis les chiffres sans séparateur (+33612345678). Cela vaut aussi pour le lien « appeler ».
- **R7 :** R4 à R6 valent pour chaque téléphone saisi :
  - le téléphone du compte ;
  - celui de la fiche participant ;
  - celui du questionnaire ;
  - celui du contact d'urgence, dans le compte comme dans le questionnaire.

### Contact d'urgence

- **R8 :** le nom et le téléphone d'un contact d'urgence vont ensemble. Un nom sans téléphone est refusé, et un téléphone sans nom aussi. Le message s'affiche sous le champ vide. La règle vaut pour chaque écriture d'un contact d'urgence : compte, questionnaire, outils des assistants d'IA. Les deux vides restent acceptés là où le contact est facultatif, c'est-à-dire dans le compte.

### Longueurs

- **R9 :** chaque texte saisi a une longueur maximale, selon son type :

  | Type | Plafond | Exemples |
  |---|---|---|
  | Nom de personne | 100 | R2 |
  | Titre ou nom d'élément | 200 | titre d'un jeu ou d'un document, nom d'un personnage, d'un groupe, d'une intrigue, d'un lieu, d'un objet, d'un événement ; nom affiché d'un trombinoscope |
  | Texte court | 500 | adresse d'un lieu, emplacement d'un objet, note de trombinoscope, réglages d'envoi des emails |
  | Texte long | 50 000 | accroche, indications de costume, description d'une intrigue, d'un objet ou d'un événement, présentation d'un jeu, note d'intention, notes (fiche participant, lieu, casting) |
  | Texte de fond | 1 000 000 | historique d'un personnage ou d'un groupe, contenu d'un document |

  Les plafonds déjà en place ne changent pas : réponses et questions du questionnaire, allergies, relations, tarifs, emails d'annulation. Un texte qui dépasse est refusé avec son plafond : « Le nom : 200 caractères au plus ».
- **R10 :** une adresse email saisie est vérifiée de la même façon partout. Elle est mise en minuscules, fait 254 caractères au plus, et doit avoir la forme d'une adresse.

### Affichage et valeurs existantes

- **R11 :** un refus d'une règle de cette spec s'affiche sous le champ concerné, en français, sur chaque formulaire. Pour un champ qui n'est pas à l'écran (outil d'un assistant, écriture faite hors ligne et refusée au retour du réseau), il s'affiche comme les autres refus.
- **R12 :** une migration remet au format de R6 chaque téléphone déjà en base qu'elle reconnaît. Les autres valeurs ne bougent pas : un nom avec un chiffre, un téléphone non reconnu, un texte trop long. Elles restent affichées, et la règle s'applique à la prochaine modification du champ.

## Données

- Aucun champ ajouté. Les téléphones changent de forme (R6, R12) ; les colonnes restent des textes.
- Les jeux de test (`prisma/seed/`) suivent les nouvelles règles : noms, téléphones au format +33, contacts d'urgence complets.

## Sécurité et droits

- Toutes les règles sont vérifiées par le serveur. L'écran peut prévenir plus tôt, mais c'est le serveur qui décide.
- Les plafonds de R9 protègent aussi le serveur contre un envoi démesuré. Limbus n'a pas de limite générale de taille d'une requête (celle de nuxt-security est désactivée) : ce sont donc eux qui la posent, champ par champ.
- Aucun droit ne change.

## Hors périmètre

- Les mots de passe : leurs règles ne changent pas.
- Les liens, dont les règles sont déjà en place (https:// ou fichier téléversé).
- La vérification qu'un téléphone existe vraiment, par appel ou SMS.
