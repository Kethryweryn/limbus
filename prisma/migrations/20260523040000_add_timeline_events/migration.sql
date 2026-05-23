CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "day" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "requiredResponsibles" INTEGER NOT NULL DEFAULT 0,
    "gameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimelineEventResponsible" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timelineEventId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,

    CONSTRAINT "TimelineEventResponsible_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_TimelineEventCharacters" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TimelineEventCharacters_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE TABLE "_TimelineEventIntrigues" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TimelineEventIntrigues_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE TABLE "_TimelineEventItems" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TimelineEventItems_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "TimelineEvent_gameId_day_time_idx" ON "TimelineEvent"("gameId", "day", "time");
CREATE INDEX "TimelineEventResponsible_participantId_idx" ON "TimelineEventResponsible"("participantId");
CREATE INDEX "TimelineEventResponsible_timelineEventId_idx" ON "TimelineEventResponsible"("timelineEventId");
CREATE UNIQUE INDEX "TimelineEventResponsible_sessionId_timelineEventId_participantId_key" ON "TimelineEventResponsible"("sessionId", "timelineEventId", "participantId");
CREATE INDEX "_TimelineEventCharacters_B_index" ON "_TimelineEventCharacters"("B");
CREATE INDEX "_TimelineEventIntrigues_B_index" ON "_TimelineEventIntrigues"("B");
CREATE INDEX "_TimelineEventItems_B_index" ON "_TimelineEventItems"("B");

ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimelineEventResponsible" ADD CONSTRAINT "TimelineEventResponsible_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimelineEventResponsible" ADD CONSTRAINT "TimelineEventResponsible_timelineEventId_fkey" FOREIGN KEY ("timelineEventId") REFERENCES "TimelineEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimelineEventResponsible" ADD CONSTRAINT "TimelineEventResponsible_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TimelineEventCharacters" ADD CONSTRAINT "_TimelineEventCharacters_A_fkey" FOREIGN KEY ("A") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TimelineEventCharacters" ADD CONSTRAINT "_TimelineEventCharacters_B_fkey" FOREIGN KEY ("B") REFERENCES "TimelineEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TimelineEventIntrigues" ADD CONSTRAINT "_TimelineEventIntrigues_A_fkey" FOREIGN KEY ("A") REFERENCES "Intrigue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TimelineEventIntrigues" ADD CONSTRAINT "_TimelineEventIntrigues_B_fkey" FOREIGN KEY ("B") REFERENCES "TimelineEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TimelineEventItems" ADD CONSTRAINT "_TimelineEventItems_A_fkey" FOREIGN KEY ("A") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TimelineEventItems" ADD CONSTRAINT "_TimelineEventItems_B_fkey" FOREIGN KEY ("B") REFERENCES "TimelineEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
