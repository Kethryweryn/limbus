CREATE TABLE "_TimelineEventFactions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TimelineEventFactions_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_TimelineEventFactions_B_index" ON "_TimelineEventFactions"("B");

ALTER TABLE "_TimelineEventFactions" ADD CONSTRAINT "_TimelineEventFactions_A_fkey" FOREIGN KEY ("A") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TimelineEventFactions" ADD CONSTRAINT "_TimelineEventFactions_B_fkey" FOREIGN KEY ("B") REFERENCES "TimelineEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
