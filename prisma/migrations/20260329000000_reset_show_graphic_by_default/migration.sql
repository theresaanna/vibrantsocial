-- Reset showGraphicByDefault to false for all users.
-- The 20260308 migration renamed showNsfwByDefault to showGraphicByDefault,
-- carrying over old NSFW overlay preferences to the new, more severe
-- Graphic/Explicit category. Users must explicitly opt in to hiding
-- Graphic/Explicit overlays since the semantics are different.
UPDATE "User" SET "showGraphicByDefault" = false WHERE "showGraphicByDefault" = true;
