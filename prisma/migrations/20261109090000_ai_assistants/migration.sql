-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "aiForCoorganizers" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AiClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "dynamic" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAuthorizationRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "state" TEXT,
    "codeChallenge" TEXT NOT NULL,
    "codeHash" TEXT,
    "authorizationId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAuthorizationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAuthorization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,
    "sessionVersion" INTEGER NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAuthorizationGame" (
    "authorizationId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,

    CONSTRAINT "AiAuthorizationGame_pkey" PRIMARY KEY ("authorizationId","gameId")
);

-- CreateTable
CREATE TABLE "AiToken" (
    "hash" TEXT NOT NULL,
    "authorizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiToken_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "AiLogEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "gameId" TEXT,
    "clientName" TEXT NOT NULL,
    "authorizationId" TEXT,
    "action" TEXT NOT NULL,
    "tool" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiAuthorizationRequest_codeHash_key" ON "AiAuthorizationRequest"("codeHash");

-- CreateIndex
CREATE INDEX "AiAuthorizationRequest_expiresAt_idx" ON "AiAuthorizationRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "AiAuthorization_userId_idx" ON "AiAuthorization"("userId");

-- CreateIndex
CREATE INDEX "AiAuthorizationGame_gameId_idx" ON "AiAuthorizationGame"("gameId");

-- CreateIndex
CREATE INDEX "AiToken_authorizationId_idx" ON "AiToken"("authorizationId");

-- CreateIndex
CREATE INDEX "AiToken_expiresAt_idx" ON "AiToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AiLogEntry_userId_idx" ON "AiLogEntry"("userId");

-- CreateIndex
CREATE INDEX "AiLogEntry_gameId_idx" ON "AiLogEntry"("gameId");

-- CreateIndex
CREATE INDEX "AiLogEntry_createdAt_idx" ON "AiLogEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "AiAuthorizationRequest" ADD CONSTRAINT "AiAuthorizationRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "AiClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAuthorization" ADD CONSTRAINT "AiAuthorization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAuthorization" ADD CONSTRAINT "AiAuthorization_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "AiClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAuthorizationGame" ADD CONSTRAINT "AiAuthorizationGame_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "AiAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAuthorizationGame" ADD CONSTRAINT "AiAuthorizationGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiToken" ADD CONSTRAINT "AiToken_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "AiAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiLogEntry" ADD CONSTRAINT "AiLogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiLogEntry" ADD CONSTRAINT "AiLogEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

