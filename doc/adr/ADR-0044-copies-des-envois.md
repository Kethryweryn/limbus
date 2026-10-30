---
id: ADR-0044
titre: Une copie de chaque envoi, gardée jusqu'au lendemain de la session
statut: accepté
date: 2026-10-30
liens: [../specs/SPEC-011-un-compte-pour-tout-le-monde.md, ADR-0031-version-d-un-envoi.md, ADR-0041-fiches-rattachees-a-un-compte.md, ADR-0039-comptes-en-libre-service.md]
---

# ADR-0044 : Une copie de chaque envoi, gardée jusqu'au lendemain de la session

## Contexte

[SPEC-011](../specs/SPEC-011-un-compte-pour-tout-le-monde.md) (R14) : les documents envoyés gardent leur pièce jointe et sont aussi consultables dans le compte. Jusqu'ici, Limbus ne gardait rien de ce qu'il envoyait : le PDF d'un document ou d'une fiche est refait à chaque fois à partir du contenu actuel, et le trombinoscope généré est remplacé à la génération suivante. L'utilisatrice veut que la personne voie exactement ce qu'elle a reçu, puis, une fois la session passée, la dernière version validée.

## Décision

- **Copie à l'envoi.** Chaque envoi réussi d'un document, d'une fiche personnage ou d'un trombinoscope (envoi groupé fiche + trombinoscope compris) enregistre sur sa ligne `SessionDocumentDelivery` le PDF joint (`copyPdf`), ce qui se lit dans la page (`copyContent`) et leur taille (`copySize`). Pour toutes les personnes, avec ou sans compte : un compte créé plus tard retrouve ses envois. Un renvoi remplace la copie : seule la dernière version reçue est gardée. Les emails de test n'en gardent pas.
- **Lecture dans la page.** `copyContent` reprend les sections du PDF (titre, sous-titre, sections) pour un document ou une fiche. Pour un trombinoscope, il reprend ses cartes (nom affiché, groupes, note, photo cachée ou manquante) et les photos elles-mêmes, en base64 : la copie ne dépend d'aucun fichier qui pourrait changer ou disparaître. Le trombinoscope généré garde aussi ses cartes (`SessionTrombinoscope.contentJson`, photos par URL), pour la lecture sans copie.
- **Stockage.** Les copies comptent dans l'espace de la propriétaire du jeu (`storageUsedBytes`), mais ne bloquent jamais un envoi : le plafond peut être dépassé, et il bloque alors les téléversements de photos.
- **Nettoyage.** Les copies d'une session s'effacent le lendemain de sa date (date + 24 h). Une session reportée suit la session qui la remplace (la chaîne des reports jusqu'à la dernière). Une session annulée s'efface un mois après son annulation (`Session.cancelledAt`, posé quand elle passe « Annulée » et retiré si elle en sort ; les sessions déjà annulées reprennent leur date de modification). Une session sans date garde ses copies. Il n'y a pas de tâche planifiée : comme la purge des comptes non confirmés (ADR-0039), le nettoyage passe à chaque connexion et avant chaque envoi, et une copie expirée n'est jamais servie, même pas encore effacée.
- **Sans copie** (expirée, ou envoi d'avant cette décision), la personne lit la version actuelle, tant qu'elle reste validée : document toujours « prêt à envoyer », fiche toujours prête, trombinoscope toujours généré pour elle. Sinon, l'envoi reste listé (titre et date) sans contenu.
- **Espace « Je participe ».** Chaque session liste ce que la personne a reçu (`GET /api/me/participations`). `GET /api/me/documents/:id` (lecture), `/pdf` et `/photos/:index` partent de la ligne d'envoi et vérifient qu'elle appartient à une fiche rattachée au compte : sinon 404 (ADR-0041).
- **Données personnelles.** L'effacement d'une personne (`eraseParticipant`) efface, comme les trombinoscopes générés, les copies de trombinoscope des sessions où figurait sa photo. Ses propres envois partent avec sa fiche. L'export (`exportParticipantData`) donne le texte des copies de documents et de fiches, pas les trombinoscopes, qui montrent d'autres personnes.

## Conséquences

- La base grossit de la taille des PDF envoyés, jusqu'au lendemain de chaque session. C'est pour cela que le nettoyage existe, et que la copie se compte chez la propriétaire.
- La version reçue reste lisible même si l'équipe modifie ou retire le document avant la session ; ensuite seulement, la personne voit la version actuelle.
- Un trombinoscope copié peut montrer une photo remplacée depuis : c'est ce qu'elle a reçu.

## Options écartées

- **Toujours la version actuelle, sans copie** : écartée par l'utilisatrice ; une modification non renvoyée serait visible avant d'être envoyée.
- **Copies en fichiers téléversés (`UploadedFile`)** : le nettoyage et l'effacement devraient suivre les fichiers sur disque en plus des lignes ; en base, la ligne d'envoi porte sa copie et part avec elle.
- **Refuser l'envoi quand le stockage est plein** : écartée par l'utilisatrice ; l'envoi des documents passe avant.
- **Garder toutes les versions reçues** : écartée par l'utilisatrice.
