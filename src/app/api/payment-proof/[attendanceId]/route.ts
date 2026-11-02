import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attendances, events, paymentProofs, users } from "@/db/schema";
import { createOcrProvider } from "@/lib/ocr/factory";
import { parsePixReceipt } from "@/lib/ocr/parser";
import { validatePixProof } from "@/lib/ocr/validate";
import { paymentApprovedEmail } from "@/lib/email";
import { queueEmail } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { formatDateLong, formatTime } from "@/lib/time";
import { absoluteUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attendanceId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const limit = rateLimit(`payment-proof:${user.id}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json(
      { error: "Muitos envios. Aguarde alguns minutos." },
      { status: 429 },
    );
  }

  const { attendanceId } = await params;

  const [row] = await db
    .select({
      attendance: attendances,
      event: events,
      userName: users.name,
    })
    .from(attendances)
    .innerJoin(events, eq(events.id, attendances.eventId))
    .innerJoin(users, eq(users.id, attendances.userId))
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

  if (!row.event.autoPaymentReview) {
    return Response.json(
      { error: "Este evento não aceita reconhecimento automático." },
      { status: 400 },
    );
  }

  if (!row.event.priceCents || row.event.priceCents <= 0) {
    return Response.json(
      { error: "O valor deste evento ainda não foi configurado." },
      { status: 400 },
    );
  }

  if (row.attendance.status !== "PENDING_PAYMENT") {
    return Response.json(
      { error: "Esta vaga não está aguardando pagamento." },
      { status: 409 },
    );
  }

  const [existingProof] = await db
    .select({ id: paymentProofs.id })
    .from(paymentProofs)
    .where(eq(paymentProofs.attendanceId, attendanceId))
    .limit(1);

  if (existingProof) {
    return Response.json(
      { error: "Já existe um comprovante para esta vaga. Aguarde a análise do administrador." },
      { status: 409 },
    );
  }

  const form = await request.formData();
  const file = form.get("proof");

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Envie o comprovante." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "Comprovante muito grande. Envie até 10 MB." },
      { status: 413 },
    );
  }

  if (!ALLOWED.has(file.type)) {
    return Response.json(
      { error: "Formato inválido. Envie JPG, PNG, WebP ou AVIF." },
      { status: 415 },
    );
  }

  const settings = await getSettings();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const ocr = createOcrProvider();
    const ocrResult = await ocr.recognize({ buffer, mimeType: file.type });
    const parsed = parsePixReceipt(ocrResult.text, settings.timezone);
    const reasons = validatePixProof({
      parsed,
      confidence: ocrResult.confidence,
      eventPriceCents: row.event.priceCents,
      eventCreatedAt: row.event.createdAt,
      expectedRecipient: settings.pixRecipientName,
      timeZone: settings.timezone,
    });

    if (parsed.e2eId) {
      const [duplicate] = await db
        .select({ id: paymentProofs.id })
        .from(paymentProofs)
        .where(eq(paymentProofs.e2eId, parsed.e2eId))
        .limit(1);

      if (duplicate) {
        return Response.json(
          { error: "Este comprovante já foi utilizado." },
          { status: 409 },
        );
      }
    }

    const autoApproved = reasons.length === 0;

    await db.transaction(async (tx) => {
      await tx.insert(paymentProofs).values({
        attendanceId,
        e2eId: parsed.e2eId,
        amountCents: parsed.amountCents,
        paidAt: parsed.paidAt,
        recipientName: parsed.recipientName,
        confidence: ocrResult.confidence,
        provider: ocrResult.provider,
        status: autoApproved ? "APPROVED" : "NEEDS_REVIEW",
        reviewReasons: reasons,
        reviewedAt: autoApproved ? new Date() : null,
      });

      if (autoApproved) {
        await tx
          .update(attendances)
          .set({
            status: "CONFIRMED",
            paymentApprovedAt: new Date(),
            paymentApprovedById: null,
            updatedAt: new Date(),
          })
          .where(eq(attendances.id, attendanceId));
      }
    });

    if (autoApproved) {
      const startsAtLabel = `${formatDateLong(
        row.event.startsAt,
        settings.timezone,
      )} às ${formatTime(row.event.startsAt, settings.timezone)}`;
      queueEmail({
        to: user.email,
        ...paymentApprovedEmail({
          name: user.name,
          siteName: settings.siteName,
          eventTitle: row.event.title,
          startsAtLabel,
          venueName: row.event.venueName,
          link: absoluteUrl(
            row.event.publicToken ? `/e/${row.event.publicToken}` : "/inicio",
          ),
        }),
      });
    }

    return Response.json({
      ok: true,
      autoApproved,
      needsReview: !autoApproved,
      parsed: {
        e2eId: parsed.e2eId,
        amountCents: parsed.amountCents,
        paidAt: parsed.paidAt,
        recipientName: parsed.recipientName,
      },
      reviewReasons: reasons,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return Response.json(
        { error: "Este comprovante ou esta vaga já possui um envio registrado." },
        { status: 409 },
      );
    }

    console.error("[payment-proof] falha ao processar comprovante", error);

    try {
      await db.insert(paymentProofs).values({
        attendanceId,
        status: "NEEDS_REVIEW",
        reviewReasons: ["ocr_failed"],
      });
    } catch (insertError) {
      console.error("[payment-proof] falha ao salvar análise manual", insertError);
      return Response.json(
        { error: "Não foi possível registrar o comprovante." },
        { status: 500 },
      );
    }

    return Response.json({
      ok: true,
      autoApproved: false,
      needsReview: true,
      reviewReasons: ["ocr_failed"],
    });
  }
}
