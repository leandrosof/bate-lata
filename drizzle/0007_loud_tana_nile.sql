CREATE TYPE "public"."event_surface" AS ENUM('SAND', 'COURT');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "surface" "event_surface";