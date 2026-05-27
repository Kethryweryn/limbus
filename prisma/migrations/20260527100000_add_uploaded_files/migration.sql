CREATE TABLE "UploadedFile" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "gameId" TEXT,
  "sessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UploadedFile_filename_key" ON "UploadedFile"("filename");
CREATE UNIQUE INDEX "UploadedFile_url_key" ON "UploadedFile"("url");
CREATE INDEX "UploadedFile_kind_idx" ON "UploadedFile"("kind");
CREATE INDEX "UploadedFile_gameId_idx" ON "UploadedFile"("gameId");
CREATE INDEX "UploadedFile_sessionId_idx" ON "UploadedFile"("sessionId");

ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
