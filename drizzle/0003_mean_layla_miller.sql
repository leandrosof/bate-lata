ALTER TYPE "public"."game_source" ADD VALUE 'RACHA';--> statement-breakpoint
DROP TABLE "draw_reserves" CASCADE;--> statement-breakpoint
DROP TABLE "draw_team_players" CASCADE;--> statement-breakpoint
DROP TABLE "rotation_matches" CASCADE;--> statement-breakpoint
DROP TABLE "rotation_sessions" CASCADE;--> statement-breakpoint
DROP TABLE "rotation_slots" CASCADE;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "left_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "undo_state" jsonb;--> statement-breakpoint
ALTER TABLE "draw_teams" DROP COLUMN "streak";--> statement-breakpoint
DROP TYPE "public"."rotation_session_status";--> statement-breakpoint
DROP TYPE "public"."rotation_slot_status";