ALTER TABLE "settings" ADD COLUMN "logo_data" "bytea";--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "logo_mime" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "logo_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "about_text" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "rules_text" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "contact_text" text;