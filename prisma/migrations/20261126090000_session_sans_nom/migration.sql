-- Une session n'a plus de nom (SPEC-021, ADR-0084) : la colonne devient facultative, et le code ne la lit ni ne l'écrit
-- plus. Elle sera supprimée par une migration suivante, une fois ce build en service (ADR-0024).
ALTER TABLE "Session" ALTER COLUMN "name" DROP NOT NULL;
