CREATE TYPE "public"."game_source" AS ENUM('MANUAL', 'TEAM_ROTATION');--> statement-breakpoint
CREATE TYPE "public"."rotation_session_status" AS ENUM('ACTIVE', 'PAUSED', 'FINISHED');--> statement-breakpoint
CREATE TYPE "public"."rotation_slot_status" AS ENUM('COURT', 'QUEUE', 'OUT');--> statement-breakpoint
CREATE TABLE "rotation_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"team_a_id" uuid NOT NULL,
	"team_b_id" uuid NOT NULL,
	"winner_team_id" uuid NOT NULL,
	"loser_team_id" uuid NOT NULL,
	"state_before" jsonb,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rotation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_id" uuid NOT NULL,
	"status" "rotation_session_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rotation_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"status" "rotation_slot_status" DEFAULT 'QUEUE' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "source" "game_source" DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "rotation_matches" ADD CONSTRAINT "rotation_matches_session_id_rotation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."rotation_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_matches" ADD CONSTRAINT "rotation_matches_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_matches" ADD CONSTRAINT "rotation_matches_team_a_id_draw_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."draw_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_matches" ADD CONSTRAINT "rotation_matches_team_b_id_draw_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."draw_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_matches" ADD CONSTRAINT "rotation_matches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_sessions" ADD CONSTRAINT "rotation_sessions_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_sessions" ADD CONSTRAINT "rotation_sessions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_slots" ADD CONSTRAINT "rotation_slots_session_id_rotation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."rotation_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_slots" ADD CONSTRAINT "rotation_slots_team_id_draw_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."draw_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rotation_matches_game_unique" ON "rotation_matches" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "rotation_matches_session_idx" ON "rotation_matches" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "rotation_sessions_draw_status_idx" ON "rotation_sessions" USING btree ("draw_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "rotation_slots_session_team_unique" ON "rotation_slots" USING btree ("session_id","team_id");--> statement-breakpoint
CREATE INDEX "rotation_slots_session_idx" ON "rotation_slots" USING btree ("session_id","status");