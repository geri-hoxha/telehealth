-- Add as nullable, fill in existing users from their email, then make it required.
ALTER TABLE "users" ADD COLUMN "username" TEXT;
UPDATE "users" SET "username" = lower(split_part("email", '@', 1)) WHERE "username" IS NULL;
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
