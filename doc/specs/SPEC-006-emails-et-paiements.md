---
id: SPEC-006
titre: Envois d'emails et suivi des paiements
statut: validée
date: 2026-10-29
origine: ../archive/todo/documentation-de-l-existant.md
epics: [EPIC-006]
adr: [ADR-0004, ADR-0008, ADR-0031, ADR-0032]
---

# SPEC-006 : Envois d'emails et suivi des paiements

Cette spec décrit un comportement déjà en production, avant la reprise du développement ([Documentation de l'existant](../archive/todo/documentation-de-l-existant.md)). Elle n'a ni epic ni US. Les écarts constatés entre le code et l'intention sont listés à la fin, sans être corrigés.

## Objectif

Remettre à chaque personne d'une session ce qui la concerne, par email : documents du jeu, fiche de personnage, trombinoscope, demande de paiement. Suivre qui a reçu quoi et qui a payé, pour savoir à qui il reste à écrire.

## Vocabulaire

- **Envoi** : un email parti à une personne pour une session, noté avec sa date. Un envoi est d'un des types suivants : document, fiche de personnage, trombinoscope, ou fiche et trombinoscope ensemble.
- **Destinataires manquants** : les personnes visées qui n'ont pas encore reçu l'envoi.
- **Email de test** : un aperçu envoyé à des adresses choisies par l'organisatrice. Il n'est pas noté comme un envoi.
- **Tableau des paiements** : la liste des personnes d'une session qui doivent payer, avec leur état.

## Acteurs

- **Administratrice** : configure le serveur d'envoi (SMTP) de toute l'application.
- **Organisatrice** : propriétaire ou co-organisatrice du jeu ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R16). Elle envoie les emails et suit les paiements des sessions du jeu.
- **Participant** : reçoit les emails. Il n'a pas de compte : tout ce qui lui est destiné part en pièce jointe.

## Parcours

### Configurer l'envoi

1. Dans l'administration, l'administratrice saisit le serveur SMTP, le port, le chiffrement, l'identifiant, le mot de passe et l'expéditeur, puis active l'envoi.
2. Elle s'envoie un email de test pour vérifier la configuration.

### Envoyer les documents d'une session

1. Dans l'onglet Documents de la session, l'organisatrice voit chaque document du jeu, avec ses destinataires dans cette session et ce qui leur a déjà été envoyé.
2. Elle peut s'envoyer un email de test pour un document ou une fiche.
3. Elle envoie un document, les fiches, les trombinoscopes, ou les fiches et trombinoscopes ensemble, aux destinataires manquants, après une confirmation.

### Suivre les paiements

1. Dans l'onglet Paiements, elle téléverse le RIB (un PDF) ou indique son lien, et le lien de paiement.
2. Elle envoie la demande de paiement aux personnes qui n'ont pas payé, toutes ou une seule. Un nouvel envoi à quelqu'un qui a déjà reçu la demande est une relance.
3. Elle valide le paiement de chaque personne à réception, ou annule cette validation.

## Règles métier

### Configuration et envoi

- **R1** Un seul serveur SMTP sert toute l'application, et seule l'administratrice le configure. Tant que l'envoi est désactivé, aucun email ne part : un envoi qui a des destinataires, et tout test, est refusé. Un envoi sans destinataire manquant répond simplement que rien n'est parti.
- **R2** Le mot de passe SMTP est chiffré en base, avec un secret lu à l'exécution ([ADR-0004](../adr/ADR-0004-secrets-a-l-execution.md)). Il n'est jamais renvoyé à l'interface, qui sait seulement s'il est renseigné. Le laisser vide conserve l'ancien.
- **R3** La connexion au serveur SMTP a des délais bornés. Un échec est noté dans le journal du serveur, sans destinataire ni contenu, et l'interface reçoit un message qui en donne la cause probable (authentification, connexion, refus du serveur). Pour les demandes de paiement, un échec à l'ouverture de la connexion (configuration incomplète, mot de passe indéchiffrable) ne donne que « SMTP désactivé ou mal configuré ».
- **R4** Une personne sans adresse email est ignorée par les envois, sans erreur.
- **R5** Un seul envoi à la fois par session : un deuxième, lancé pendant le premier (double clic, deuxième onglet), est refusé. Chaque type d'envoi est aussi limité à 10 par organisatrice et par session en 10 minutes, et les emails de test d'une session à 20 en 15 minutes. Le test SMTP de l'administration n'est pas limité.
- **R6** Un email de test part à 1 à 10 adresses, avec un contenu « [Test] » et les mêmes pièces jointes que le vrai. Il ne compte pas comme un envoi.

### Documents, fiches et trombinoscopes

- **R7** Les destinataires d'un document dans une session dépendent de son audience ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R11) :
  - tout le monde : les personnes castées, les organisateurs, les PNJ et la cuisine de la session, chacun une seule fois ;
  - organisateurs, PNJ ou cuisine : les membres de l'équipe qui ont ce rôle ;
  - ciblage manuel : les personnes qui jouent dans la session le personnage choisi, les personnages ciblés ou les membres des factions ciblées. Un personnage sans participant dans la session n'a pas de destinataire.
- **R8** Seul un document marqué « prêt à envoyer » peut être envoyé. Le test, lui, est toujours possible.
- **R9** L'email d'un document reprend son contenu et son lien externe, avec le PDF du document en pièce jointe ([SPEC-005](SPEC-005-trombinoscopes-et-pdf.md), R12).
- **R10** Les fiches partent aux personnes castées dont le personnage, PJ ou PNJ, est « prêt à envoyer », avec le PDF de la fiche ([SPEC-005](SPEC-005-trombinoscopes-et-pdf.md), R11). Les trombinoscopes partent aux personnes dont le trombinoscope a été généré, avec son PDF.
- **R11** L'envoi groupé « fiches et trombis » part aux personnes dont la fiche est prête et le trombinoscope généré, et qui n'ont pas déjà reçu les deux. Il note à la fois la fiche, le trombinoscope et l'ensemble comme envoyés. Une personne qui a reçu fiche et trombinoscope séparément compte comme ayant reçu l'ensemble.
- **R12** Chaque envoi ne part qu'aux destinataires manquants. Seule exception, l'envoi groupé (R11) : à une personne qui n'a reçu que la fiche ou que le trombinoscope, il renvoie les deux.
- **R12b** Un envoi garde l'empreinte de la version envoyée ([ADR-0031](../adr/ADR-0031-version-d-un-envoi.md)) : le tableau signale une version dépassée. « Renvoyer » renvoie la version actuelle à une personne qui l'a déjà reçue ; « Renvoyer la version à jour », par document, pour les fiches ou pour les trombinoscopes, la renvoie aux seules personnes dont la version est dépassée. L'email renvoyé a un objet préfixé « Mise à jour : » et dit qu'il remplace le précédent. Un trombinoscope périmé doit être généré à nouveau avant d'être renvoyé ([US-030](../epics/EPIC-006-ecarts-envois-et-paiements/US-030-renvoyer-la-version-a-jour.md)).
- **R13** Un échec d'envoi à une personne n'arrête pas les autres : les personnes qui n'ont rien reçu sont listées. Si aucun email n'est parti à cause d'échecs, l'envoi est en erreur ([US-029](../epics/EPIC-006-ecarts-envois-et-paiements/US-029-echecs-d-envoi-non-bloquants.md)).

### Paiements

- **R14** Sans tarif (mode simple), le tableau des paiements liste les personnes qui jouent un personnage PJ ou PNJ dans la session, les inscrits confirmés sans personnage (« personnage à attribuer ») et les membres de rôle PNJ, même sans personnage ([SPEC-001](SPEC-001-inscriptions.md), R22) ; la cuisine et les organisateurs sans personnage n'y sont pas. Dès qu'un tarif existe (mode tarifs), toute l'équipe de la session y est, orgas et cuisine compris ([US-031](../epics/EPIC-006-ecarts-envois-et-paiements/US-031-tarifs-d-une-session.md)).
- **R15** En mode simple, un paiement est « payé » avec sa date, ou « non payé » : l'organisatrice le valide ou annule la validation à la main ; seules les personnes du tableau peuvent l'être.
- **R15b** Une session a des tarifs nommés, en euros ([ADR-0032](../adr/ADR-0032-tarifs-et-versements.md)). Un tarif peut s'appliquer par défaut à un rôle (PJ, PNJ, orga, cuisine), un seul tarif par rôle ; chaque personne reçoit le tarif du premier de ses rôles qui en a un, dans cet ordre, et l'organisatrice peut lui en choisir un autre. Sans tarif, la personne n'a rien à payer.
- **R15c** En mode tarifs, l'organisatrice note chaque versement (montant, date) ; le reçu est leur somme. L'état est calculé : payé quand le reçu atteint le dû, partiel entre les deux, non payé à zéro, rien à payer quand le dû est nul. Un paiement validé en mode simple, sans versement, reste payé. Le tableau donne le dû, le reçu et le reste de chaque personne et de la session ([US-032](../epics/EPIC-006-ecarts-envois-et-paiements/US-032-versements-et-etat-calcule.md)). Il n'y a pas de moyen de paiement.
- **R15d** Places solidaires : un tarif peut désigner un tarif de base ; il est de soutien s'il est plus cher, réduit s'il l'est moins. Le tableau affiche l'apport des soutiens (attribué et encaissé, soit la part des versements au-delà de la base), le coût des réductions attribuées et les deux soldes. L'organisatrice attribue les réductions à la main ([US-033](../epics/EPIC-006-ecarts-envois-et-paiements/US-033-places-solidaires.md)).
- **R16** Un paiement reçu (case cochée ou versement) d'une personne qui n'est plus dans le tableau (désistement, rôle retiré) reste affiché à part, hors du décompte et des envois, pour être remboursé ou gardé à la main.
- **R17** La demande de paiement part aux personnes du tableau qui n'ont pas payé. Elle donne le nom de la session et du jeu, le lien de paiement et le lien du RIB s'ils existent ; un RIB téléversé est joint en PDF.
- **R18** La première demande est un « Paiement ». Tout envoi suivant à la même personne est une « Relance », avec une autre formule. Le tableau garde la date de la première demande et celle de la dernière relance.
- **R19** Un échec d'envoi à une personne n'arrête pas les autres : les personnes qui n'ont rien reçu sont listées. Si aucun email n'est parti, l'envoi est en erreur.
- **R20** Le RIB est un PDF (signature vérifiée, 10 Mo au plus) rattaché à la session, ou un lien http(s). Remplacé ou retiré, l'ancien fichier est supprimé ([ADR-0008](../adr/ADR-0008-fichiers-televerses.md)).

## Données

- `SmtpSettings` : une seule ligne pour toute l'application.
- `SessionDocumentDelivery` : le dernier envoi d'un type à une personne (session, participant, type, document ou personnage, date, empreinte de la version envoyée).
- `SessionPayment` : le paiement d'un participant pour une session (date de paiement en mode simple, tarif choisi, date de la première demande et de la dernière relance) ; `SessionPaymentInstalment` : ses versements.
- `SessionTariff` : un tarif de la session (nom, montant en centimes, rôle par défaut, tarif de base).
- `Session.paymentRibUrl` et `Session.paymentLinkUrl`.
- Envois et paiements sont des données personnelles du participant : ils sont couverts par l'export et la suppression RGPD (`participantPrivacy.ts`), décrits dans [SPEC-007](SPEC-007-participants-et-rgpd.md). Ils sont supprimés avec la session ([SPEC-004](SPEC-004-sessions.md), R3), sans proposer de remboursement, et avec le participant. Un envoi est aussi supprimé avec son document ou son personnage : leur historique d'envoi disparaît.
- Le contenu des emails n'est pas conservé.

## Sécurité et droits

- **R21** Envoyer, tester, suivre les paiements et téléverser le RIB demandent l'accès au jeu de la session. Le RIB n'est lu que par une route qui vérifie ces droits, jamais en statique ; il part aux participants en pièce jointe, jamais en lien vers l'API.
- **R22** Configurer et tester le serveur SMTP est réservé à l'administratrice.

## Hors périmètre

- Emails des inscriptions (invitation, confirmation, relance) : [SPEC-001](SPEC-001-inscriptions.md).
- Emails de legs : [SPEC-002](SPEC-002-copie-de-jeu.md).
- Invitations à co-organiser et comptes : [SPEC-008](SPEC-008-comptes-et-partage.md).
- Paiement en ligne : Limbus donne un lien, mais n'encaisse rien.
- Remboursement d'une session annulée ou reportée : [SPEC-004](SPEC-004-sessions.md), R16.

## Écarts constatés

Relevés le 29 octobre 2026 avec l'utilisatrice. Aucun n'est corrigé ici.

1. **Renvoi (R12)** : il faut pouvoir renvoyer la version à jour d'un document, d'une fiche ou d'un trombinoscope, par exemple après une correction ou après la régénération des trombinoscopes qui suit un désistement. Aujourd'hui, une personne qui a reçu un envoi n'est plus jamais destinataire de ce type d'envoi.
2. **Échecs d'envoi (R13)** : la règle voulue est celle des paiements (R19) : continuer avec les personnes suivantes, et lister celles qui n'ont rien reçu. Pour les documents, fiches et trombinoscopes, un échec arrête tout l'envoi, et l'interface ne dit pas qui a déjà reçu.
3. **Montant (R15)** : un tarif, par session ou par personne, et le montant reçu devraient apparaître, dans le tableau comme dans l'email. Il faut aussi pouvoir noter un paiement partiel, et relancer la personne pour le reste dû.

### Choix faits le 29 octobre 2026

Pour l'écart 1 (renvoi) :

- Deux façons de renvoyer : un bouton « Renvoyer » par personne, et un « Renvoyer la version à jour » groupé par document, pour les fiches et pour les trombinoscopes.
- Le renvoi groupé ne part qu'aux personnes dont la version reçue est plus ancienne que l'actuelle : document ou fiche modifié après l'envoi, trombinoscope généré à nouveau ou périmé.
- L'email renvoyé a un objet préfixé « Mise à jour : » et une phrase qui dit que cette version remplace la précédente.

Pour l'écart 2 (échecs d'envoi) : la règle des paiements (R19) s'applique à tous les envois.

Pour l'écart 3 (montant), d'après les usages des PAF (tarif PJ, tarif PNJ, gratuité de la cuisine et parfois des orgas, places solidaires) :

- **Tarifs nommés** : une session a une liste de tarifs (nom, montant en euros). Chaque tarif peut s'appliquer par défaut à un rôle (PJ, PNJ, orga, cuisine) ; chaque personne reçoit le tarif de son rôle, et l'organisatrice peut le changer (réduit, soutien…).
- **Tout le monde dans le tableau** : orgas et cuisine y figurent aussi. Un dû de 0 € s'affiche « rien à payer » et n'est jamais destinataire d'une demande ni d'une relance. Une PAF orga payante devient possible.
- **Places solidaires** : un tarif de soutien ou réduit désigne son tarif de base (par exemple PJ). Un soutien apporte (soutien − base) par personne, une place réduite coûte (base − réduit). Le tableau montre l'apport, le coût et le solde, à la fois pour les tarifs attribués et pour l'argent déjà encaissé ; l'organisatrice décide des places réduites. La demande d'une place réduite dans le formulaire d'inscription relève de la suite des inscriptions ([SPEC-001](SPEC-001-inscriptions.md), lot 2).
- **Versements** : chaque versement est noté (montant, date) ; le reçu est leur somme.
- **État calculé** : payé quand le reçu atteint le dû, partiel entre les deux, non payé à zéro. Il n'y a plus de case « payé » à cocher.
- **Relance** : elle rappelle le dû, le déjà reçu et le reste à payer. Demandes et relances partent à toute personne qui doit encore quelque chose.
- **Session sans tarif** : le tableau garde le mode simple d'aujourd'hui (case « payé ») ; dès qu'un tarif existe, on passe aux montants calculés.

