-- Fix accountId for credential accounts - better-auth expects accountId to be the email
-- This fixes the login issue for doctors and recepcionistas created before this migration

UPDATE "account"
SET "account_id" = u.email
FROM "user" u
WHERE "account"."user_id" = u.id
  AND "account"."provider_id" = 'credential'
  AND "account"."account_id" = "account"."user_id";