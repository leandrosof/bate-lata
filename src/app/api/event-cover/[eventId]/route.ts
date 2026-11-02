import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const [row] = await db
    .select({ data: events.coverData, mime: events.coverMime })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!row?.data) return new Response("Sem capa.", { status: 404 });

  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime ?? "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  const { eventId } = await params;

  let form: FormData | null = null;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Envio inválido." }, { status: 400 });
  }

  const file = form.get("cover");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Selecione uma imagem." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "A imagem é muito grande. Envie um arquivo de até 20 MB." }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json({ error: "Formato inválido." }, { status: 415 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const sharp = (await import("sharp")).default;
    const output = await sharp(buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(1200, 675, { fit: "cover", position: "attention" })
      .webp({ quality: 80 })
      .toBuffer();

    await db
      .update(events)
      .set({
        coverData: output,
        coverMime: "image/webp",
        coverUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    revalidatePath("/", "layout");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Não foi possível processar a imagem." }, { status: 422 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  const { eventId } = await params;
  await db
    .update(events)
    .set({ coverData: null, coverMime: null, coverUpdatedAt: null, updatedAt: new Date() })
    .where(eq(events.id, eventId));
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
