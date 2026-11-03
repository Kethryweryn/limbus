-- Responsables du déroulé qui ne sont plus orga ni PNJ de l'équipe de leur session (EPIC-035, US-128) : une modification
-- de l'équipe les laissait en place. Ils ne s'affichaient nulle part, et bloquaient l'enregistrement du déroulé par un
-- assistant d'IA. Aucune colonne ne change : compatible avec le build en service.
DELETE FROM "TimelineEventResponsible" r
WHERE NOT EXISTS (
  SELECT 1 FROM "SessionParticipant" p
  WHERE p."sessionId" = r."sessionId"
    AND p."participantId" = r."participantId"
    AND p."role" IN ('organizer', 'npc')
);
