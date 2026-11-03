import { cancelAttendanceAction, confirmAttendanceAction } from "@/actions/attendance";
import { PaymentProofUpload } from "@/components/features/payment-proof-upload";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";

export function AttendanceControls({
  eventId,
  status,
  waitlistPosition,
  isFull,
  allowWaitlist,
  isOrganizer,
  requiresPayment = false,
  attendanceId,
  paymentProofUpload = false,
  paymentProofId = null,
  paymentProofNote = null,
  size = "lg",
  block = true,
}: {
  eventId: string;
  status: "PENDING_PAYMENT" | "CONFIRMED" | "WAITLIST" | "CANCELLED" | null;
  waitlistPosition?: number | null;
  isFull: boolean;
  allowWaitlist: boolean;
  isOrganizer?: boolean;
  requiresPayment?: boolean;
  attendanceId?: string | null;
  paymentProofUpload?: boolean;
  paymentProofId?: string | null;
  paymentProofNote?: string | null;
  size?: "sm" | "md" | "lg";
  block?: boolean;
}) {
  if (isOrganizer) {
    return (
      <p className="rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-center text-xs text-muted">
        Você está apenas organizando este encontro.
      </p>
    );
  }

  if (status === "CONFIRMED") {
    return (
      <ActionButton
        action={cancelAttendanceAction}
        fields={{ eventId }}
        variant="danger"
        size={size}
        block={block}
        confirmMessage="Deseja cancelar sua presença neste jogo?"
        pendingLabel="Cancelando..."
      >
        Cancelar presença
      </ActionButton>
    );
  }

  if (status === "PENDING_PAYMENT") {
    return (
      <div className="space-y-2">
        {attendanceId && (paymentProofUpload || paymentProofId) ? (
          <PaymentProofUpload
            attendanceId={attendanceId}
            hasProof={Boolean(paymentProofId)}
            note={paymentProofNote}
          />
        ) : null}
        <ActionButton
          action={cancelAttendanceAction}
          fields={{ eventId }}
          variant="secondary"
          size={size}
          block={block}
          confirmMessage="Deseja cancelar sua solicitação de vaga?"
          pendingLabel="Cancelando..."
        >
          Cancelar solicitação
        </ActionButton>
        {paymentProofId ? null : (
          <p className="text-center text-xs text-warning">
            {paymentProofUpload
              ? "Vaga reservada. Envie o comprovante para o admin aprovar."
              : "Vaga reservada. Aguardando aprovação do admin."}
          </p>
        )}
      </div>
    );
  }

  if (status === "WAITLIST") {
    return (
      <div className="space-y-1.5">
        <ActionButton
          action={cancelAttendanceAction}
          fields={{ eventId }}
          variant="secondary"
          size={size}
          block={block}
          pendingLabel="Saindo..."
        >
          Sair da lista de espera
        </ActionButton>
        <p className="text-center text-xs text-muted">
          Você está na fila{waitlistPosition ? ` na ${waitlistPosition}ª posição` : ""}. Se alguém cancelar, você
          entra automaticamente.
        </p>
      </div>
    );
  }

  if (isFull && !allowWaitlist) {
    return (
      <Button variant="secondary" size={size} block disabled>
        Vagas esgotadas
      </Button>
    );
  }

  return (
    <ActionButton
      action={confirmAttendanceAction}
      fields={{ eventId }}
      variant="primary"
      size={size}
      block={block}
      pendingLabel="Confirmando..."
      icon={<span aria-hidden className="text-base leading-none">+</span>}
    >
      {isFull
        ? "Entrar na lista de espera"
        : requiresPayment
          ? "Solicitar vaga (Pix)"
          : "Confirmar presença"}
    </ActionButton>
  );
}
