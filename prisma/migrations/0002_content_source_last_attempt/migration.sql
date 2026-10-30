-- Track the most recent attempt separately from the last successful fetch.
ALTER TABLE "ContentSource" ADD COLUMN "lastAttemptAt" TIMESTAMP(3);
