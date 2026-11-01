ALTER TABLE "events" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "public_token" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cover_data" "bytea";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cover_mime" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cover_updated_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "events_public_token_unique" ON "events" USING btree ("public_token");
UPDATE "events" SET "ends_at" = "starts_at" + interval '2 hours' WHERE "ends_at" IS NULL;--> statement-breakpoint
UPDATE "events" SET "public_token" = substr(md5(random()::text || "id"::text), 1, 12) WHERE "public_token" IS NULL;
