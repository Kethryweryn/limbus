---
id: SPEC-013
titre: Mentions légales, confidentialité, conditions d'utilisation et durées de conservation
statut: implémentée
date: 2026-11-02
origine: ../archive/todo/comptes-participants.md
epics: [EPIC-029, EPIC-030]
adr: [ADR-0055, ADR-0056]
---

# SPEC-013 : Mentions légales, confidentialité, conditions d'utilisation et durées de conservation

## Objectif

Étape 5 de la [feuille de route](../feuille-de-route.md), chantier 4 : ce qu'il faut avant d'ouvrir l'inscription libre. Les personnes savent :

- qui édite Limbus ;
- ce qui est fait de leurs données ;
- à quelles règles elles s'engagent.

Aucune donnée n'est gardée indéfiniment. Ce chantier ferme aussi l'écart 3 de [SPEC-007](SPEC-007-participants-et-rgpd.md) : la durée de conservation des données des participants.

## Contexte juridique

Sources secondaires, sans fiche de la CNIL propre au cas. À confirmer avec un juriste si besoin.

- Les mentions légales sont obligatoires : éditeur, contact, hébergeur. Elles sont à l'article 1-1 de la LCEN depuis la loi SREN de 2024.
- La politique de confidentialité suit les articles 13 et 14 du RGPD.
- Les conditions d'utilisation ne sont pas obligatoires.
- Pour les comptes inactifs, la CNIL recommande, dans un cas voisin (contenus numériques), une désactivation après deux ans d'inactivité.

## Choix de l'utilisatrice

- **Éditeur et responsable du traitement** : Jean-Damien Mottot, à titre personnel. Contact : `limbus@limbuslarp.fr`. Hébergeur : Scaleway SAS (Dedibox).
- **Données des joueurs** : chaque équipe est responsable des données qu'elle saisit ou collecte pour ses jeux. Limbus les héberge pour elle, comme sous-traitant. Limbus est responsable des comptes.
- **Comptes** : effacés après deux ans sans connexion. Un email prévient un mois avant, et une connexion suffit à garder le compte.
- **Fiches participant sans compte** : effacées trois ans après leur dernière activité (dernière session ou dernière inscription).
- **Comptes existants** : ils acceptent les conditions à leur prochaine connexion, puis à chaque nouvelle version.

## Règles

- **L1 Pages.**
  - Trois pages publiques, lisibles sans compte : « Mentions légales » (`/mentions-legales`), « Confidentialité » (`/confidentialite`) et « Conditions d'utilisation » (`/conditions`).
  - Elles sont liées depuis :
    - l'écran de connexion et les pages d'accès ;
    - le pied du menu ;
    - le formulaire d'inscription à un jeu ;
    - le lien personnel.
- **L2 Mentions légales** :
  - l'éditeur et son contact ;
  - le directeur de la publication ;
  - l'hébergeur : nom, adresse, RCS.
- **L3 Confidentialité.** Pour les comptes, d'une part, et pour les données des joueurs saisies par les équipes, d'autre part :
  - le responsable ;
  - les données traitées, les finalités et les bases légales ;
  - les destinataires et les durées de conservation ;
  - les droits des personnes, l'export et l'effacement depuis le compte, et la réclamation à la CNIL ;
  - les cookies : seulement ceux de la connexion, sans mesure d'audience ;
  - les données gardées sur l'appareil pour le mode hors ligne.
- **L4 Conditions d'utilisation** :
  - l'objet et le service sans garantie de disponibilité ;
  - le compte ;
  - les obligations des équipes envers leurs joueurs (base légale, information, données de santé avec consentement) ;
  - les contenus interdits ;
  - la suspension et l'effacement ;
  - les changements de version ;
  - le droit français ;
  - le contact.
- **L5 Acceptation.**
  - Créer un compte (inscription libre ou lien reçu) demande de cocher « J'accepte les conditions d'utilisation ».
  - Un compte qui n'a pas accepté la version en cours voit, après connexion, un écran qui demande de les accepter avant de continuer. Les pages légales restent lisibles.
  - La version et la date d'acceptation sont gardées sur le compte.
- **L6 Durées.**
  - Comptes :
    - un compte confirmé sans connexion depuis 23 mois reçoit un email d'avertissement ;
    - il est effacé à 24 mois, comme un effacement demandé (ADR-0043).
  - Exceptions, signalées par email à l'administratrice : un compte qui possède encore des jeux, et la dernière administratrice.
  - Fiches participant sans compte : effacées par `eraseParticipant` trois ans après leur dernière activité, la plus récente de :
    - leur création ;
    - leur dernière inscription ;
    - la date de leur dernière session.
  - Les autres durées existent déjà, et la politique de confidentialité les reprend :
    - compte non confirmé : 7 jours ;
    - formulaire public non confirmé : 7 jours ;
    - copies des envois : après la session ;
    - photos : selon le jeu.

## Hors périmètre

- L'ouverture de l'inscription libre en production : c'est un réglage du serveur (`SIGNUP_OPEN=1`), fait par l'utilisatrice une fois les deux epics déployés.
- Les registres de traitement et les contrats de sous-traitance entre les équipes et Limbus : les conditions d'utilisation en tiennent lieu.

## Découpage

- [EPIC-029](../archive/epics/EPIC-029-pages-legales/README.md) : pages et acceptation (L1 à L5).
- [EPIC-030](../archive/epics/EPIC-030-durees-de-conservation/README.md) : durées (L6).

## Historique

- 2026-11-02 : création, avec les choix de l'utilisatrice.
- 2026-11-02 (revue de code) : les deux epics sont livrés ensemble, pour que la politique de confidentialité ne promette pas de durée que Limbus n'applique pas encore.
- 2026-11-02 : EPIC-029 et EPIC-030 terminés et archivés ; ADR-0055 et ADR-0056 acceptés.
