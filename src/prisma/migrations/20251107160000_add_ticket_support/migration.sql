-- Add TICKET to RoomType enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketStatus') THEN
    CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'WAITING', 'RESOLVED');
  END IF;
END$$;

-- Add TICKET to RoomType enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TICKET' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'RoomType')) THEN
    ALTER TYPE "RoomType" ADD VALUE 'TICKET';
  END IF;
END$$;

-- Add status column to Room
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "status" "TicketStatus";

-- Create index for ticket queries
CREATE INDEX IF NOT EXISTS "Room_type_status_idx" ON "Room"("type", "status");

