import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

async function renderCropped(original: Buffer, x: number, y: number, zoom: number) {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(original).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error("Imagem inválida.");
  const safeZoom = clamp(Number.isFinite(zoom) ? zoom : 1, 1, 3);
  const size = Math.min(width, height) / safeZoom;
  const left = clamp(Math.round(clamp(x, 0, 1) * width - size / 2), 0, width - size);
  const top = clamp(Math.round(clamp(y, 0, 1) * height - size / 2), 0, height - size);
  return sharp(original)
    .extract({ left, top, width: Math.round(size), height: Math.round(size) })
    .resize(256, 256)
    .webp({ quality: 84 })
    .toBuffer();
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 401 });

  let form: FormData | null = null;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Envio inválido." }, { status: 400 });
  }

  const file = form.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Selecione uma imagem." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "A imagem deve ter no máximo 2 MB." }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json({ error: "Formato inválido. Use JPG, PNG, WebP ou AVIF." }, { status: 415 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const sharp = (await import("sharp")).default;
    const original = await sharp(buffer, { limitInputPixels: 24_000_000 })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
    const output = await renderCropped(original, 0.5, 0.5, 1);

    await db
      .update(users)
      .set({
        avatarData: output,
        avatarMime: "image/webp",
        avatarOriginalData: original,
        avatarOriginalMime: "image/webp",
        avatarUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    revalidatePath("/", "layout");
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Não foi possível processar a imagem. Tente outro arquivo." },
      { status: 422 },
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 401 });

  let body: { x?: number; y?: number; zoom?: number } | null = null;
  try {
    body = (await request.json()) as { x?: number; y?: number; zoom?: number };
  } catch {
    return Response.json({ error: "Envio inválido." }, { status: 400 });
  }

  const [row] = await db
    .select({ original: users.avatarOriginalData })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row?.original) {
    return Response.json(
      { error: "Reenvie a foto para poder reposicionar." },
      { status: 422 },
    );
  }

  try {
    const output = await renderCropped(
      Buffer.from(row.original),
      Number(body?.x ?? 0.5),
      Number(body?.y ?? 0.5),
      Number(body?.zoom ?? 1),
    );
    await db
      .update(users)
      .set({
        avatarData: output,
        avatarMime: "image/webp",
        avatarUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    revalidatePath("/", "layout");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Não foi possível reposicionar a foto." }, { status: 422 });
  }
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Não autorizado.", { status: 401 });

  const [row] = await db
    .select({ original: users.avatarOriginalData })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row?.original) return new Response("Sem imagem original.", { status: 404 });

  return new Response(new Uint8Array(row.original), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 401 });

  await db
    .update(users)
    .set({ avatarData: null, avatarMime: null, avatarUpdatedAt: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
