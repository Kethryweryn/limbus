-- Un seul rôle global : administratrice ou compte simple (US-058, ADR-0038). Les comptes « organizer » existants
-- sont convertis plus tard, quand le build en service acceptera tout rôle
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'user';
