import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attendances, events, paymentProofs } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attendanceId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const limit = rateLimit(`payment-proof:${user.id}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json(
      { error: "Muitos envios. Aguarde alguns minutos." },
      { status: 429 },
    );
  }

  const { attendanceId } = await params;

  const [row] = await db
    .select({ attendance: attendances, event: events })
    .from(attendances)
    .innerJoin(events, eq(events.id, attendances.eventId))
    .where(eq(attendances.id, attendanceId))
    .limit(1);

  if (!row || row.attendance.userId !== user.id) {
    return Response.json({ error: "Vaga não encontrada." }, { status: 404 });
  }

  if (row.event.paymentMode !== "PAID") {
    return Response.json(
      { error: "Este evento não possui pagamento via Pix." },
      { status: 400 },
    );
  }

  if (!row.event.paymentProofUpload) {
    return Response.json(
      { error: "Este evento não aceita envio de comprovante pelo site." },
      { status: 400 },
    );
  }

  if (row.attendance.status !== "PENDING_PAYMENT") {
    return Response.json(
      { error: "Esta vaga não está aguardando pagamento." },
      { status: 409 },
    );
  }

  const [existing] = await db
    .select({ id: paymentProofs.id, status: paymentProofs.status })
    .from(paymentProofs)
    .where(eq(paymentProofs.attendanceId, attendanceId))
    .limit(1);

  if (existing && existing.status !== "NEEDS_REVIEW") {
    return Response.json(
      { error: "Este comprovante já foi analisado pelo administrador." },
      { status: 409 },
    );
  }

  let form: FormData | null = null;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Envio inválido." }, { status: 400 });
  }

  const file = form.get("proof");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Selecione a imagem do comprovante." }, { status: 400 });
  }

  const note = String(form.get("note") ?? "").trim().slice(0, 500);

  try {
    const sharp = (await import("sharp")).default;
    const image = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 80_000_000,
    })
      .rotate()
      .resize({
        width: 1200,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 70 })
      .toBuffer();

    await db.transaction(async (tx) => {
      if (existing) {
        await tx
          .update(paymentProofs)
          .set({
            imageData: image,
            imageMime: "image/webp",
            imageBytes: image.length,
            note: note || null,
            status: "NEEDS_REVIEW",
            reviewedAt: null,
            reviewedById: null,
            imageDeletedAt: null,
          })
          .where(eq(paymentProofs.id, existing.id));
      } else {
        await tx.insert(paymentProofs).values({
          attendanceId,
          imageData: image,
          imageMime: "image/webp",
          imageBytes: image.length,
          note: note || null,
          status: "NEEDS_REVIEW",
        });
      }
    });

    return Response.json({
      ok: true,
      needsReview: true,
      imageBytes: image.length,
    });
  } catch (error) {
    console.error("[payment-proof] falha ao processar comprovante", error);
    return Response.json(
      { error: "Não foi possível processar a imagem. Tente novamente." },
      { status: 422 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attendanceId: string }> },
) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { attendanceId } = await params;
  const [proof] = await db
    .select({
      imageData: paymentProofs.imageData,
      imageMime: paymentProofs.imageMime,
    })
    .from(paymentProofs)
    .where(eq(paymentProofs.attendanceId, attendanceId))
    .limit(1);

  if (!proof?.imageData) {
    return new Response("Sem comprovante.", { status: 404 });
  }

  return new Response(new Uint8Array(proof.imageData), {
    headers: {
      "Content-Type": proof.imageMime ?? "image/webp",
      "Cache-Control": "private, no-store",
    },
  });
}
