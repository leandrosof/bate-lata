import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54364/arena";
}

const DEMO_PASSWORD = "Arena@2026";

async function run() {
  const { db, closeDatabase } = await import("../src/db/client");
  const { hashPassword } = await import("../src/lib/password");
  const { sql } = await import("drizzle-orm");
  const schema = await import("../src/db/schema");
  const { TZDate } = await import("@date-fns/tz");

  const tz = "America/Sao_Paulo";

  const tables = [
    "audit_logs",
    "game_substitutions",
    "game_players",
    "score_events",
    "games",
    "draw_teams",
    "draws",
    "announcements",
    "attendances",
    "password_reset_tokens",
    "email_verification_tokens",
    "sessions",
    "events",
    "seasons",
    "settings",
    "users",
  ];

  try {
    await db.execute(sql.raw(`truncate table ${tables.join(", ")} restart identity cascade`));

    await db.insert(schema.settings).values({ id: 1, siteName: "Arena do Vôlei" });

    const now = new TZDate(new Date(), tz);
    await db.insert(schema.seasons).values({
      name: `Temporada ${now.getFullYear()}`,
      startsOn: new Date(`${now.getFullYear()}-01-01T00:00:00-03:00`),
      endsOn: new Date(`${now.getFullYear()}-12-31T23:59:59-03:00`),
      isActive: true,
    });

    const passwordHash = await hashPassword(DEMO_PASSWORD);

    const people = [
      { name: "Rafael Moreira", email: "admin@arena.local", role: "ADMIN" as const, nickname: "Rafa" },
      { name: "Ana Souza", email: "ana@arena.local", role: "PLAYER" as const, nickname: "Aninha" },
      { name: "Bruno Lima", email: "bruno@arena.local", role: "PLAYER" as const, nickname: "Brunão" },
      { name: "Carla Dias", email: "carla@arena.local", role: "PLAYER" as const, nickname: "Cacá" },
      { name: "Diego Alves", email: "diego@arena.local", role: "PLAYER" as const, nickname: "Dieguito" },
      { name: "Eduarda Rocha", email: "eduarda@arena.local", role: "PLAYER" as const, nickname: "Duda" },
      { name: "Felipe Nunes", email: "felipe@arena.local", role: "PLAYER" as const, nickname: "Felipão" },
      { name: "Gabriela Martins", email: "gabriela@arena.local", role: "PLAYER" as const, nickname: "Gabi" },
      { name: "Hugo Reis", email: "hugo@arena.local", role: "PLAYER" as const, nickname: "Hugão" },
      { name: "Isabela Freitas", email: "isabela@arena.local", role: "PLAYER" as const, nickname: "Isa" },
      { name: "João Pedro", email: "joao@arena.local", role: "PLAYER" as const, nickname: "JP" },
      { name: "Larissa Melo", email: "larissa@arena.local", role: "PLAYER" as const, nickname: "Lari" },
      { name: "Marcos Silva", email: "marcos@arena.local", role: "PLAYER" as const, nickname: "Marcão" },
      { name: "Natália Costa", email: "natalia@arena.local", role: "PLAYER" as const, nickname: "Naty" },
    ];

    const insertedUsers = await db
      .insert(schema.users)
      .values(
        people.map((person) => ({
          ...person,
          passwordHash,
          emailVerifiedAt: new Date(),
          emailNotifications: true,
        })),
      )
      .returning({ id: schema.users.id, name: schema.users.name, email: schema.users.email });

    const byEmail = new Map(insertedUsers.map((user) => [user.email, user]));
    const admin = byEmail.get("admin@arena.local")!;

    const nextSaturday = new TZDate(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + ((6 - now.getDay() + 7) % 7 || 7),
      19,
      0,
      0,
      0,
      tz,
    );
    const pastSaturday = new TZDate(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (now.getDay() === 0 ? 1 : now.getDay() + 1),
      19,
      0,
      0,
      0,
      tz,
    );

    const [upcomingEvent] = await db
      .insert(schema.events)
      .values({
        title: "Vôlei de sábado",
        startsAt: new Date(nextSaturday.getTime()),
        venueName: "Arena Praia Clube",
        address: "Rua das Palmeiras, 240 · Quadra 2",
        maxPlayers: 12,
        notes: "Chegar 15 minutos antes para aquecer. Levem colete claro e escuro.",
        createdById: admin.id,
      })
      .returning({ id: schema.events.id });

    const [pastEvent] = await db
      .insert(schema.events)
      .values({
        title: "Treino da semana passada",
        startsAt: new Date(pastSaturday.getTime()),
        venueName: "Arena Praia Clube",
        address: "Rua das Palmeiras, 240 · Quadra 2",
        maxPlayers: 12,
        notes: "Treino livre com dois times mistos.",
        status: "FINISHED",
        createdById: admin.id,
      })
      .returning({ id: schema.events.id });

    const upcomingConfirmed = insertedUsers.slice(0, 12);
    const upcomingWaitlist = [insertedUsers[12]];

    await db.insert(schema.attendances).values([
      ...upcomingConfirmed.map((user, index) => ({
        eventId: upcomingEvent.id,
        userId: user.id,
        status: "CONFIRMED" as const,
        createdAt: new Date(Date.now() - (20 - index) * 60 * 1000),
      })),
      ...upcomingWaitlist.map((user, index) => ({
        eventId: upcomingEvent.id,
        userId: user.id,
        status: "WAITLIST" as const,
        waitlistPosition: index + 1,
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      })),
    ]);

    const pastPlayers = insertedUsers.slice(0, 8);
    await db.insert(schema.attendances).values(
      pastPlayers.map((user) => ({
        eventId: pastEvent.id,
        userId: user.id,
        status: "CONFIRMED" as const,
        checkedInAt: new Date(pastSaturday.getTime()),
        rotationStatus: "LEFT" as const,
      })),
    );

    const [pastDraw] = await db
      .insert(schema.draws)
      .values({
        eventId: pastEvent.id,
        teamSize: 4,
        status: "FINISHED",
        createdById: admin.id,
        lockedAt: new Date(pastSaturday.getTime()),
        finishedAt: new Date(pastSaturday.getTime() + 1000 * 60 * 90),
      })
      .returning({ id: schema.draws.id });

    const teamVisuals = [
      { name: "Azul", color: "blue" },
      { name: "Vermelho", color: "red" },
    ];
    const pastTeams: { id: string }[] = [];
    for (let index = 0; index < 2; index += 1) {
      const [team] = await db
        .insert(schema.drawTeams)
        .values({
          drawId: pastDraw.id,
          name: teamVisuals[index].name,
          color: teamVisuals[index].color,
          sortOrder: index,
        })
        .returning({ id: schema.drawTeams.id });
      pastTeams.push(team);
    }

    const pastGames = await db
      .insert(schema.games)
      .values([
        {
          drawId: pastDraw.id,
          eventId: pastEvent.id,
          teamAId: pastTeams[0].id,
          teamBId: pastTeams[1].id,
          status: "FINISHED",
          source: "RACHA",
          sequence: 1,
          scoreA: 25,
          scoreB: 21,
          winnerTeamId: pastTeams[0].id,
          startedAt: new Date(pastSaturday.getTime()),
          finishedAt: new Date(pastSaturday.getTime() + 1000 * 60 * 35),
          createdById: admin.id,
        },
        {
          drawId: pastDraw.id,
          eventId: pastEvent.id,
          teamAId: pastTeams[0].id,
          teamBId: pastTeams[1].id,
          status: "FINISHED",
          source: "RACHA",
          sequence: 2,
          scoreA: 23,
          scoreB: 25,
          winnerTeamId: pastTeams[1].id,
          startedAt: new Date(pastSaturday.getTime() + 1000 * 60 * 40),
          finishedAt: new Date(pastSaturday.getTime() + 1000 * 60 * 80),
          createdById: admin.id,
        },
      ])
      .returning({ id: schema.games.id });

    await db.insert(schema.gamePlayers).values(
      pastGames.flatMap((game) =>
        pastPlayers.map((user, index) => ({
          gameId: game.id,
          teamId: index < 4 ? pastTeams[0].id : pastTeams[1].id,
          userId: user.id,
        })),
      ),
    );

    await db.insert(schema.announcements).values([
      {
        title: "Regras da nossa pelada",
        body:
          "Times montados pelo sistema. O vencedor fica na quadra e o perdedor vai para o fim da fila. " +
          "Quem chegar depois entra no fim da fila. Sem discussão com a arbitragem — o placar é registrado no app.",
        pinned: true,
        authorId: admin.id,
      },
      {
        title: "Novo horário a partir deste sábado",
        body: "A quadra 2 está liberada às 19h. Cheguem com 15 minutos de antecedência para o aquecimento.",
        authorId: admin.id,
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
      },
    ]);

    console.log("Dados de demonstração criados.");
    console.log("Admin: admin@arena.local / Arena@2026");
    console.log("Jogadores: ana@arena.local ... natalia@arena.local / Arena@2026");
  } finally {
    await closeDatabase();
  }
}

run().catch((error) => {
  console.error("Falha no seed de demonstração:", error);
  process.exit(1);
});
