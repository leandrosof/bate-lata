ALTER TYPE "public"."attendance_status" ADD VALUE 'PENDING_PAYMENT' BEFORE 'CONFIRMED';--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "payment_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "payment_approved_by_id" uuid;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "payment_reference" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "price_cents" integer;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "pix_key" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "pix_recipient_name" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "pix_instructions" text;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_payment_approved_by_id_users_id_fk" FOREIGN KEY ("payment_approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;