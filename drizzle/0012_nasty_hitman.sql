ALTER TABLE "payment_proofs" ALTER COLUMN "status" SET DEFAULT 'NEEDS_REVIEW';--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "reservation_expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "attendances" a SET "reservation_expires_at" = e."starts_at" - interval '1 hour' FROM "events" e WHERE a."event_id" = e."id" AND a."status" = 'PENDING_PAYMENT' AND a."reservation_expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN "image_data" "bytea";--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN "image_mime" text;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN "image_bytes" integer;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN "image_deleted_at" timestamp with time zone;