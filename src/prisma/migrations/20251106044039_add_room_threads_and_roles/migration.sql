-- 1) Create enum (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoomType') THEN
    CREATE TYPE "RoomType" AS ENUM ('PUBLIC', 'PRIVATE', 'DM');
  END IF;
END$$;

-- 2) Add columns as nullable or with safe defaults
ALTER TABLE "Room"
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS "type" "RoomType" DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "creatorId" TEXT;

-- 3) Backfill existing rows
-- Title: use existing name column
UPDATE "Room" SET "title" = "name" WHERE "title" IS NULL;

-- Type: align existing rooms as PUBLIC by default
UPDATE "Room" SET "type" = 'PUBLIC'::"RoomType" WHERE "type" IS NULL;

-- Tags default empty
UPDATE "Room" SET "tags" = COALESCE("tags", '{}'::text[]);

-- Creator: pick an admin as default owner; fallback to any user if needed
WITH admin AS (
  SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "id" LIMIT 1
),
any_user AS (
  SELECT "id" FROM "User" ORDER BY "id" LIMIT 1
)
UPDATE "Room" r
SET "creatorId" = COALESCE(
  (SELECT "id" FROM admin),
  (SELECT "id" FROM any_user),
  r."creatorId"
)
WHERE r."creatorId" IS NULL;

-- 4) Add the FK with error handling
DO $$
BEGIN
  ALTER TABLE "Room"
    ADD CONSTRAINT "Room_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  -- constraint already exists
  NULL;
END$$;

-- 5) Make required columns NOT NULL (after backfill)
ALTER TABLE "Room"
  ALTER COLUMN "title" SET NOT NULL,
  ALTER COLUMN "type" SET NOT NULL;

-- 6) Create index for RoomMember.roomId (for DM queries)
CREATE INDEX IF NOT EXISTS "RoomMember_roomId_idx" ON "RoomMember"("roomId");
