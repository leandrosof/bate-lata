UPDATE "users" SET "email_verified_at" = COALESCE("email_verified_at", now()), "active" = true WHERE "email_verified_at" IS NULL;--> statement-breakpoint
