import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function GET() {
  const [row] = await db
    .select({ data: settings.logoData, mime: settings.logoMime, updatedAt: settings.logoUpdatedAt })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);

  if (!row?.data) return new Response("Sem logo.", { status: 404 });

  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime ?? "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  let form: FormData | null = null;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Envio inválido." }, { status: 400 });
  }

  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Selecione uma imagem." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "A imagem deve ter no máximo 2 MB." }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json({ error: "Formato inválido." }, { status: 415 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const sharp = (await import("sharp")).default;
    const output = await sharp(buffer, { limitInputPixels: 24_000_000 })
      .rotate()
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();

    await db
      .update(settings)
      .set({
        logoData: output,
        logoMime: "image/webp",
        logoUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(settings.id, 1));

    revalidatePath("/", "layout");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Não foi possível processar a imagem." }, { status: 422 });
  }
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  await db
    .update(settings)
    .set({ logoData: null, logoMime: null, logoUpdatedAt: null, updatedAt: new Date() })
    .where(eq(settings.id, 1));
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
