-- Add tsvector columns for full-text search
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Create function to update Message search vector
CREATE OR REPLACE FUNCTION update_message_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" := 
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE((SELECT u.name FROM "User" u WHERE u.id = NEW."userId"), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE((SELECT u.email FROM "User" u WHERE u.id = NEW."userId"), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update Room search vector
CREATE OR REPLACE FUNCTION update_room_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update search vectors
DROP TRIGGER IF EXISTS message_search_vector_update ON "Message";
CREATE TRIGGER message_search_vector_update
  BEFORE INSERT OR UPDATE ON "Message"
  FOR EACH ROW
  EXECUTE FUNCTION update_message_search_vector();

DROP TRIGGER IF EXISTS room_search_vector_update ON "Room";
CREATE TRIGGER room_search_vector_update
  BEFORE INSERT OR UPDATE ON "Room"
  FOR EACH ROW
  EXECUTE FUNCTION update_room_search_vector();

-- Create GIN indexes for fast full-text search
CREATE INDEX IF NOT EXISTS "Message_searchVector_idx" ON "Message" USING GIN ("searchVector");
CREATE INDEX IF NOT EXISTS "Room_searchVector_idx" ON "Room" USING GIN ("searchVector");

-- Update existing rows
UPDATE "Message" SET "searchVector" = 
  setweight(to_tsvector('english', COALESCE(content, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE((SELECT u.name FROM "User" u WHERE u.id = "Message"."userId"), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE((SELECT u.email FROM "User" u WHERE u.id = "Message"."userId"), '')), 'C')
WHERE "searchVector" IS NULL;

UPDATE "Room" SET "searchVector" = 
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(tags, ' '), '')), 'C')
WHERE "searchVector" IS NULL;

