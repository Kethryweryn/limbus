---
id: US-048
titre: Modifier une session hors ligne
statut: à faire
epic: EPIC-010
regles: [R5, R6]
adr: [ADR-0036]
---

# US-048 : Modifier une session hors ligne

En tant qu'organisatrice sur le lieu du GN, je veux modifier une session sans réseau et voir aussitôt mes modifications, sans que l'affichage soit faussé.

## Critères d'acceptation

- [ ] Hors ligne, les détails, l'équipe, le casting et le déroulé d'une session se modifient ; la page les affiche aussitôt, et les garde si on la rouvre.
- [ ] Les modifications sur une sous-route (déroulé, paiement d'une personne, réglages de paiement, tarif, trombinoscope d'un personnage) partent en file sans être fusionnées dans l'élément parent en cache.
- [ ] Les modifications des paiements et du trombinoscope faites hors ligne sont signalées « enregistrée hors ligne » ; le tableau se met à jour à l'envoi.
- [ ] Un paiement validé hors ligne garde la date du clic, et non celle de l'envoi.
- [ ] Une modification hors ligne garde, dans le cache, la version lue de l'élément, et non l'heure de l'appareil : le contrôle de conflit reste possible.

## Notes techniques

- `offlineSync.ts` : seules les écritures sur `/api/<ressource>` et `/api/<ressource>/:id` touchent la liste en cache ; une modification d'un élément met aussi à jour ses champs simples dans les réponses en cache.
- Page de session : projection locale du casting, de l'équipe, des détails et du déroulé à partir des listes en cache (`utils/sessionOffline.ts`).
- `sessionPaymentStatusSchema` accepte `paidAt`, refusé s'il est dans le futur.

## Tests

- Unitaires : sous-route en file sans toucher la liste ; projection de la session ; version gardée dans le cache ; `paidAt` du client.
