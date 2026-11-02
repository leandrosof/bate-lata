CREATE TYPE "public"."payment_proof_status" AS ENUM('PROCESSING', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "payment_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attendance_id" uuid NOT NULL,
	"e2e_id" text,
	"amount_cents" integer,
	"paid_at" timestamp with time zone,
	"recipient_name" text,
	"confidence" integer,
	"provider" text DEFAULT 'tesseract' NOT NULL,
	"status" "payment_proof_status" DEFAULT 'PROCESSING' NOT NULL,
	"review_reasons" jsonb,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_proofs_attendance_id_unique" UNIQUE("attendance_id")
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "auto_payment_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_attendance_id_attendances_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_proofs_e2e_unique" ON "payment_proofs" USING btree ("e2e_id");