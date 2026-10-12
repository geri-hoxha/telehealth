-- New enum values get their own migration: Postgres can't use a value added in the same transaction.
ALTER TYPE "PushKind" ADD VALUE 'APNS';
ALTER TYPE "CallState" ADD VALUE 'QUEUED' BEFORE 'RINGING';
