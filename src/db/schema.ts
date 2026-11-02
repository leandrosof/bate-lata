import { customType, boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const userRole = pgEnum("user_role", ["ADMIN", "PLAYER"]);
export const eventStatus = pgEnum("event_status", ["SCHEDULED", "CANCELLED", "FINISHED"]);
export const eventSurface = pgEnum("event_surface", ["SAND", "COURT"]);
export const attendanceStatus = pgEnum("attendance_status", ["CONFIRMED", "WAITLIST", "CANCELLED"]);
export const drawStatus = pgEnum("draw_status", ["DRAFT", "IN_PROGRESS", "FINISHED", "CANCELLED"]);
export const gameStatus = pgEnum("game_status", ["NOT_STARTED", "IN_PROGRESS", "FINISHED", "CANCELLED"]);
export const teamSide = pgEnum("team_side", ["A", "B"]);
export const rotationRule = pgEnum("rotation_rule", [
  "HYBRID",
  "WINNER_STAYS",
  "ROTATE_ALL",
  "ARRIVAL_QUEUE",
]);
export const rotationStatus = pgEnum("rotation_status", [
  "IDLE",
  "WAITING",
  "PLAYING",
  "LEFT",
  "PAUSED",
]);
export const gamePlayerRole = pgEnum("game_player_role", ["STARTER", "SUB"]);
export const gameSource = pgEnum("game_source", ["MANUAL", "TEAM_ROTATION", "RACHA"]);
export const queueMode = pgEnum("queue_mode", ["KEEP_TEAM", "MIX"]);
export const courtStatus = pgEnum("court_status", ["EMPTY", "WAITING", "PLAYING"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("PLAYER"),
    nickname: text("nickname"),
    avatarMime: text("avatar_mime"),
    avatarData: bytea("avatar_data"),
    avatarOriginalData: bytea("avatar_original_data"),
    avatarOriginalMime: text("avatar_original_mime"),
    avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    emailNotifications: boolean("email_notifications").notNull().default(true),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    requestedIp: text("requested_ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("password_reset_token_hash_unique").on(table.tokenHash),
    index("password_reset_user_idx").on(table.userId),
  ],
);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    requestedIp: text("requested_ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_verification_token_hash_unique").on(table.tokenHash),
    index("email_verification_user_idx").on(table.userId),
  ],
);

export const seasons = pgTable("seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  startsOn: timestamp("starts_on", { withTimezone: true }).notNull(),
  endsOn: timestamp("ends_on", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    publicToken: text("public_token"),
    venueName: text("venue_name").notNull(),
    address: text("address"),
    surface: eventSurface("surface"),
    maxPlayers: integer("max_players").notNull(),
    notes: text("notes"),
    status: eventStatus("status").notNull().default("SCHEDULED"),
    rotationRule: rotationRule("rotation_rule").notNull().default("HYBRID"),
    maxStreak: integer("max_streak").notNull().default(2),
    coverData: bytea("cover_data"),
    coverMime: text("cover_mime"),
    coverUpdatedAt: timestamp("cover_updated_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("events_starts_at_idx").on(table.startsAt),
    uniqueIndex("events_public_token_unique").on(table.publicToken),
  ],
);

export const attendances = pgTable(
  "attendances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: attendanceStatus("status").notNull().default("CONFIRMED"),
    waitlistPosition: integer("waitlist_position"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    rotationStatus: rotationStatus("rotation_status").notNull().default("IDLE"),
    queuePosition: integer("queue_position"),
    gamesPlayed: integer("games_played").notNull().default(0),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
    isOrganizer: boolean("is_organizer").notNull().default(false),
    queueTeamId: uuid("queue_team_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("attendances_event_user_unique").on(table.eventId, table.userId),
    index("attendances_event_status_idx").on(table.eventId, table.status),
  ],
);

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("announcements_published_idx").on(table.publishedAt)],
);

export const draws = pgTable(
  "draws",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    teamSize: integer("team_size").notNull(),
    courtCount: integer("court_count").notNull().default(1),
    queueMode: queueMode("queue_mode").notNull().default("KEEP_TEAM"),
    status: drawStatus("status").notNull().default("DRAFT"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [index("draws_event_status_idx").on(table.eventId, table.status)],
);

export const drawTeams = pgTable(
  "draw_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    drawId: uuid("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("blue"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("draw_teams_draw_idx").on(table.drawId)],
);

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    drawId: uuid("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    teamAId: uuid("team_a_id")
      .notNull()
      .references(() => drawTeams.id, { onDelete: "cascade" }),
    teamBId: uuid("team_b_id")
      .notNull()
      .references(() => drawTeams.id, { onDelete: "cascade" }),
    status: gameStatus("status").notNull().default("NOT_STARTED"),
    source: gameSource("source").notNull().default("MANUAL"),
    court: integer("court").notNull().default(1),
    sequence: integer("sequence").notNull().default(1),
    scoreA: integer("score_a").notNull().default(0),
    scoreB: integer("score_b").notNull().default(0),
    winnerTeamId: uuid("winner_team_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    undoState: jsonb("undo_state"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("games_event_idx").on(table.eventId),
    index("games_draw_idx").on(table.drawId),
    index("games_status_idx").on(table.status),
  ],
);

export const rotationCourts = pgTable(
  "rotation_courts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    status: courtStatus("status").notNull().default("EMPTY"),
    teamAId: uuid("team_a_id").references(() => drawTeams.id, { onDelete: "set null" }),
    teamBId: uuid("team_b_id").references(() => drawTeams.id, { onDelete: "set null" }),
    playerAIds: jsonb("player_a_ids"),
    playerBIds: jsonb("player_b_ids"),
    currentGameId: uuid("current_game_id").references(() => games.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("rotation_courts_session_number_unique").on(table.sessionId, table.number),
    index("rotation_courts_session_idx").on(table.sessionId, table.status),
  ],
);

export const gamePlayers = pgTable(
  "game_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => drawTeams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: gamePlayerRole("role").notNull().default("STARTER"),
    replacedUserId: uuid("replaced_user_id").references(() => users.id, { onDelete: "set null" }),
    enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    isOrganizer: boolean("is_organizer").notNull().default(false),
    queueTeamId: uuid("queue_team_id"),
  },
  (table) => [
    uniqueIndex("game_players_game_user_unique").on(table.gameId, table.userId),
    index("game_players_game_idx").on(table.gameId, table.teamId),
    index("game_players_user_idx").on(table.userId),
  ],
);

export const gameSubstitutions = pgTable(
  "game_substitutions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => drawTeams.id, { onDelete: "cascade" }),
    outUserId: uuid("out_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inUserId: uuid("in_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("game_substitutions_game_idx").on(table.gameId)],
);


export const scoreEvents = pgTable(
  "score_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    side: teamSide("side").notNull(),
    delta: integer("delta").notNull(),
    scoreA: integer("score_a").notNull(),
    scoreB: integer("score_b").notNull(),
    note: text("note"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("score_events_game_idx").on(table.gameId)],
);

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  siteName: text("site_name").notNull().default("Arena do Vôlei"),
  tagline: text("tagline").notNull().default("Organize. Sorteie. Jogue."),
  logoUrl: text("logo_url"),
  logoData: bytea("logo_data"),
  logoMime: text("logo_mime"),
  logoUpdatedAt: timestamp("logo_updated_at", { withTimezone: true }),
  aboutText: text("about_text"),
  rulesText: text("rules_text"),
  contactText: text("contact_text"),
  rankingEnabled: boolean("ranking_enabled").notNull().default(true),
  pointsWin: integer("points_win").notNull().default(3),
  pointsLoss: integer("points_loss").notNull().default(1),
  defaultTeamSize: integer("default_team_size").notNull().default(6),
  allowWaitlist: boolean("allow_waitlist").notNull().default(true),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_created_idx").on(table.createdAt)],
);

export const usersRelations = relations(users, ({ many }) => ({
  attendances: many(attendances),
  sessions: many(sessions),
  emailVerificationTokens: many(emailVerificationTokens),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  attendances: many(attendances),
  draws: many(draws),
}));

export const drawsRelations = relations(draws, ({ many, one }) => ({
  teams: many(drawTeams),
  games: many(games),
  event: one(events, { fields: [draws.eventId], references: [events.id] }),
}));

export const drawTeamsRelations = relations(drawTeams, ({ one }) => ({
  draw: one(draws, { fields: [drawTeams.drawId], references: [draws.id] }),
}));

export const gamesRelations = relations(games, ({ many, one }) => ({
  players: many(gamePlayers),
  substitutions: many(gameSubstitutions),
  draw: one(draws, { fields: [games.drawId], references: [draws.id] }),
  event: one(events, { fields: [games.eventId], references: [events.id] }),
}));

export const gamePlayersRelations = relations(gamePlayers, ({ one }) => ({
  game: one(games, { fields: [gamePlayers.gameId], references: [games.id] }),
  team: one(drawTeams, { fields: [gamePlayers.teamId], references: [drawTeams.id] }),
  user: one(users, { fields: [gamePlayers.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type Attendance = typeof attendances.$inferSelect;
export type Draw = typeof draws.$inferSelect;
export type DrawTeam = typeof drawTeams.$inferSelect;
export type Game = typeof games.$inferSelect;
export type RotationCourt = typeof rotationCourts.$inferSelect;
export type GamePlayer = typeof gamePlayers.$inferSelect;
export type GameSubstitution = typeof gameSubstitutions.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;