CREATE TYPE "public"."event_payment_mode" AS ENUM('FREE', 'PAID');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "payment_mode" "event_payment_mode" DEFAULT 'FREE' NOT NULL;--> statement-breakpoint
UPDATE "events" SET "payment_mode" = 'PAID' WHERE "price_cents" IS NOT NULL AND "price_cents" > 0;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_payment_mode_price_check" CHECK (("payment_mode" = 'FREE' AND "price_cents" IS NULL) OR ("payment_mode" = 'PAID' AND "price_cents" > 0));