import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

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
    const output = await sharp(buffer, { limitInputPixels: 24_000_000 })
      .rotate()
      .resize(256, 256, { fit: "cover", position: "attention" })
      .webp({ quality: 84 })
      .toBuffer();

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
    return Response.json(
      { error: "Não foi possível processar a imagem. Tente outro arquivo." },
      { status: 422 },
    );
  }
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
