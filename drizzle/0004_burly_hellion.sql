CREATE TYPE "public"."court_status" AS ENUM('EMPTY', 'WAITING', 'PLAYING');--> statement-breakpoint
CREATE TYPE "public"."queue_mode" AS ENUM('KEEP_TEAM', 'MIX');--> statement-breakpoint
CREATE TABLE "rotation_courts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"status" "court_status" DEFAULT 'EMPTY' NOT NULL,
	"team_a_id" uuid,
	"team_b_id" uuid,
	"player_a_ids" jsonb,
	"player_b_ids" jsonb,
	"current_game_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "is_organizer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "queue_team_id" uuid;--> statement-breakpoint
ALTER TABLE "draws" ADD COLUMN "court_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "draws" ADD COLUMN "queue_mode" "queue_mode" DEFAULT 'KEEP_TEAM' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_players" ADD COLUMN "is_organizer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "game_players" ADD COLUMN "queue_team_id" uuid;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "court" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_original_data" "bytea";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_original_mime" text;--> statement-breakpoint
ALTER TABLE "rotation_courts" ADD CONSTRAINT "rotation_courts_session_id_draws_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."draws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_courts" ADD CONSTRAINT "rotation_courts_team_a_id_draw_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."draw_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_courts" ADD CONSTRAINT "rotation_courts_team_b_id_draw_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."draw_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_courts" ADD CONSTRAINT "rotation_courts_current_game_id_games_id_fk" FOREIGN KEY ("current_game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rotation_courts_session_number_unique" ON "rotation_courts" USING btree ("session_id","number");--> statement-breakpoint
CREATE INDEX "rotation_courts_session_idx" ON "rotation_courts" USING btree ("session_id","status");