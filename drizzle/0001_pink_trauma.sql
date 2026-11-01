CREATE TYPE "public"."game_player_role" AS ENUM('STARTER', 'SUB');--> statement-breakpoint
CREATE TYPE "public"."rotation_rule" AS ENUM('HYBRID', 'WINNER_STAYS', 'ROTATE_ALL', 'ARRIVAL_QUEUE');--> statement-breakpoint
CREATE TYPE "public"."rotation_status" AS ENUM('IDLE', 'WAITING', 'PLAYING', 'LEFT', 'PAUSED');--> statement-breakpoint
CREATE TABLE "game_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "game_player_role" DEFAULT 'STARTER' NOT NULL,
	"replaced_user_id" uuid,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "game_substitutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"out_user_id" uuid NOT NULL,
	"in_user_id" uuid NOT NULL,
	"reason" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "checked_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "rotation_status" "rotation_status" DEFAULT 'IDLE' NOT NULL;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "queue_position" integer;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "games_played" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "last_played_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "draw_teams" ADD COLUMN "streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "rotation_rule" "rotation_rule" DEFAULT 'HYBRID' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "max_streak" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "sequence" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_team_id_draw_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."draw_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_replaced_user_id_users_id_fk" FOREIGN KEY ("replaced_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_substitutions" ADD CONSTRAINT "game_substitutions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_substitutions" ADD CONSTRAINT "game_substitutions_team_id_draw_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."draw_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_substitutions" ADD CONSTRAINT "game_substitutions_out_user_id_users_id_fk" FOREIGN KEY ("out_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_substitutions" ADD CONSTRAINT "game_substitutions_in_user_id_users_id_fk" FOREIGN KEY ("in_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_substitutions" ADD CONSTRAINT "game_substitutions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_game_user_unique" ON "game_players" USING btree ("game_id","user_id");--> statement-breakpoint
CREATE INDEX "game_players_game_idx" ON "game_players" USING btree ("game_id","team_id");--> statement-breakpoint
CREATE INDEX "game_players_user_idx" ON "game_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "game_substitutions_game_idx" ON "game_substitutions" USING btree ("game_id");--> statement-breakpoint
INSERT INTO "game_players" ("game_id", "team_id", "user_id", "role")
SELECT g."id", dtp."team_id", dtp."user_id", 'STARTER'
FROM "games" g
JOIN "draw_team_players" dtp
  ON dtp."draw_id" = g."draw_id"
  AND dtp."team_id" IN (g."team_a_id", g."team_b_id")
ON CONFLICT ("game_id", "user_id") DO NOTHING;--> statement-breakpoint
WITH ordered AS (
  SELECT "id", row_number() OVER (PARTITION BY "event_id" ORDER BY "created_at", "id") AS seq
  FROM "games"
)
UPDATE "games" g SET "sequence" = o.seq FROM ordered o WHERE g."id" = o."id";--> statement-breakpoint
UPDATE "attendances" a
SET "checked_in_at" = a."created_at",
    "rotation_status" = 'WAITING',
    "queue_position" = sub.rn
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "event_id" ORDER BY "created_at", "id") AS rn
  FROM "attendances"
  WHERE "status" = 'CONFIRMED'
) sub
WHERE a."id" = sub."id"
  AND EXISTS (SELECT 1 FROM "draws" d WHERE d."event_id" = a."event_id");--> statement-breakpoint
UPDATE "attendances" a
SET "games_played" = COALESCE(gp.total, 0)
FROM (
  SELECT g."event_id", p."user_id", count(*)::int AS total
  FROM "game_players" p
  JOIN "games" g ON g."id" = p."game_id"
  WHERE g."status" = 'FINISHED'
  GROUP BY g."event_id", p."user_id"
) gp
WHERE a."event_id" = gp."event_id" AND a."user_id" = gp."user_id";