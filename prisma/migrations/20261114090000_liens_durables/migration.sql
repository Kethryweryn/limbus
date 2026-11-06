-- deploiement-incompatible : le lien personnel passe de Registration.tokenHash à RegistrationLink (ADR-0070), et requestedAt, jamais écrit, disparaît. Le client Prisma du build en service nomme encore ces colonnes : ses lectures échouent jusqu'à la bascule, très courte. Accepté tant que la production n'a que des données de test.
CREATE TABLE "RegistrationLink" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationLink_tokenHash_key" ON "RegistrationLink"("tokenHash");
CREATE INDEX "RegistrationLink_registrationId_idx" ON "RegistrationLink"("registrationId");

ALTER TABLE "RegistrationLink" ADD CONSTRAINT "RegistrationLink_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Les liens déjà envoyés continuent de marcher
INSERT INTO "RegistrationLink" ("id", "registrationId", "tokenHash")
SELECT 'lien-' || "id", "id", "tokenHash" FROM "Registration" WHERE "tokenHash" IS NOT NULL;

DROP INDEX "Registration_tokenHash_key";
ALTER TABLE "Registration" DROP COLUMN "tokenHash";

ALTER TABLE "RegistrationSession" DROP COLUMN "requestedAt";

ALTER TABLE "RegistrationPeriodSession" ADD COLUMN "lastRequestedAt" TIMESTAMP(3);
