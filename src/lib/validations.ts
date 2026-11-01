import { z } from "zod";
import { MAX_PLAYERS_LIMIT, MIN_PLAYERS_LIMIT, TEAM_SIZE_OPTIONS } from "./teams";

const emailSchema = z.email("Informe um e-mail válido.").max(160, "E-mail muito longo.");
const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(200, "A senha é muito longa.");

export const formBoolean = z.preprocess(
  (value) => value === true || value === "on" || value === "true" || value === "1",
  z.boolean(),
);

export const uuidSchema = z.uuid("Registro inválido.");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome.").max(80, "Nome muito longo."),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe a senha."),
  next: z.string().optional(),
});

export const requestResetSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, "Link inválido."),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem.",
  });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80, "Nome muito longo."),
  nickname: z.string().trim().max(30, "Apelido muito longo.").optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem.",
  });

const localDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Informe data e hora válidas.");

export const eventSchema = z.object({
  title: z.string().trim().min(3, "Informe um título.").max(90, "Título muito longo."),
  startsAt: localDateTime,
  venueName: z.string().trim().min(2, "Informe o local.").max(90, "Local muito longo."),
  address: z.string().trim().max(160, "Endereço muito longo.").optional(),
  maxPlayers: z.coerce
    .number({ message: "Informe o limite de jogadores." })
    .int("Use um número inteiro.")
    .min(MIN_PLAYERS_LIMIT, `Mínimo de ${MIN_PLAYERS_LIMIT} jogadores.`)
    .max(MAX_PLAYERS_LIMIT, `Máximo de ${MAX_PLAYERS_LIMIT} jogadores.`),
  notes: z.string().trim().max(1000, "Observações muito longas.").optional(),
  rotationRule: z
    .enum(["HYBRID", "WINNER_STAYS", "ROTATE_ALL", "ARRIVAL_QUEUE"])
    .optional()
    .default("HYBRID"),
  maxStreak: z.coerce.number().int().min(1).max(10).optional().default(2),
});

export const eventIdSchema = z.object({ eventId: uuidSchema });

export const eventUserSchema = z.object({ eventId: uuidSchema, userId: uuidSchema });

export const attendanceIdSchema = z.object({ attendanceId: uuidSchema });

export const waitlistMoveSchema = z.object({
  attendanceId: uuidSchema,
  direction: z.enum(["up", "down"]),
});

export const drawSchema = z.object({
  eventId: uuidSchema,
  teamSize: z.coerce
    .number()
    .int()
    .refine((value) => (TEAM_SIZE_OPTIONS as readonly number[]).includes(value), "Escolha 4, 5 ou 6 jogadores por time."),
  prioritizeReserves: formBoolean.optional().default(false),
});

export const startGameSchema = z
  .object({
    drawId: uuidSchema,
    teamAId: uuidSchema,
    teamBId: uuidSchema,
  })
  .refine((data) => data.teamAId !== data.teamBId, {
    path: ["teamBId"],
    message: "Escolha dois times diferentes.",
  });

export const drawIdSchema = z.object({ drawId: uuidSchema });

export const scoreAdjustSchema = z.object({
  gameId: uuidSchema,
  side: z.enum(["A", "B"]),
  delta: z.coerce.number().int().min(-100).max(100),
});

export const scoreSetSchema = z.object({
  gameId: uuidSchema,
  scoreA: z.coerce.number().int().min(0).max(999),
  scoreB: z.coerce.number().int().min(0).max(999),
});

export const gameIdSchema = z.object({ gameId: uuidSchema });

export const rachaStartSchema = z.object({
  eventId: uuidSchema,
  courtCount: z.coerce.number().int().min(1).max(20).optional().default(1),
  teamSize: z.coerce
    .number()
    .int()
    .refine((value) => (TEAM_SIZE_OPTIONS as readonly number[]).includes(value), "Escolha 4, 5 ou 6."),
});

export const rachaSessionSchema = z.object({ drawId: uuidSchema });

export const rachaAttendanceSchema = z.object({ attendanceId: uuidSchema });

export const rachaQueueModeSchema = z.object({
  drawId: uuidSchema,
  mode: z.enum(["KEEP_TEAM", "MIX"]),
});

export const rachaQueueMoveSchema = z.object({
  attendanceId: uuidSchema,
  direction: z.enum(["up", "down"]),
});

export const rachaCourtSchema = z.object({
  drawId: uuidSchema,
  court: z.coerce.number().int().min(1).max(20),
});

export const rachaAddPlayerSchema = z.object({
  eventId: uuidSchema,
  userId: uuidSchema,
});

export const rachaSubstitutionSchema = z.object({
  gameId: uuidSchema,
  outUserId: uuidSchema,
  inUserId: z
    .union([z.literal(""), uuidSchema])
    .optional()
    .transform((value) => (value ? value : null)),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(3, "Informe um título.").max(90, "Título muito longo."),
  body: z.string().trim().min(3, "Escreva o aviso.").max(2000, "Aviso muito longo."),
  pinned: formBoolean.optional().default(false),
  eventId: z
    .union([z.literal(""), uuidSchema])
    .optional()
    .transform((value) => (value ? value : null)),
});

export const announcementIdSchema = z.object({ announcementId: uuidSchema });

export const settingsSchema = z.object({
  siteName: z.string().trim().min(2, "Informe o nome do site.").max(60, "Nome muito longo."),
  tagline: z.string().trim().max(80, "Slogan muito longo.").optional(),
  logoUrl: z
    .union([z.literal(""), z.url("Informe uma URL válida.")])
    .optional()
    .transform((value) => (value ? value : null)),
  rankingEnabled: formBoolean.optional().default(false),
  pointsWin: z.coerce.number().int().min(0, "Mínimo 0.").max(100, "Máximo 100."),
  pointsLoss: z.coerce.number().int().min(0, "Mínimo 0.").max(100, "Máximo 100."),
  defaultTeamSize: z.coerce
    .number()
    .int()
    .refine((value) => (TEAM_SIZE_OPTIONS as readonly number[]).includes(value), "Escolha 4, 5 ou 6."),
  allowWaitlist: formBoolean.optional().default(false),
  timezone: z.string().trim().min(3, "Informe o fuso horário.").max(60, "Fuso inválido."),
});

export const seasonSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome da temporada.").max(60, "Nome muito longo."),
    startsOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data inicial."),
    endsOn: z
      .union([z.literal(""), z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida.")])
      .optional()
      .transform((value) => (value ? value : null)),
    isActive: formBoolean.optional().default(false),
  })
  .refine((data) => !data.endsOn || data.endsOn >= data.startsOn, {
    path: ["endsOn"],
    message: "A data final deve ser depois da inicial.",
  });

export const seasonIdSchema = z.object({ seasonId: uuidSchema });

export const playerAdminSchema = z.object({
  userId: uuidSchema,
  action: z.enum(["promote", "demote", "activate", "deactivate", "reset-link"]),
});
