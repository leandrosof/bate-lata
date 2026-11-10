const HOUR_MS = 60 * 60 * 1000;

export const CHECK_IN_OPENS_BEFORE_MS = 2 * HOUR_MS;
export const CHECK_IN_DEFAULT_DURATION_MS = 12 * HOUR_MS;
export const CHECK_IN_CLOSES_AFTER_MS = 2 * HOUR_MS;

export type CheckInEvent = {
  startsAt: Date;
  endsAt: Date | null;
  status: "SCHEDULED" | "FINISHED" | "CANCELLED";
};

export type CheckInWindow = {
  open: boolean;
  opensAt: Date;
  closesAt: Date;
  reason: "open" | "before" | "after" | "cancelled" | "finished";
};

export function checkInWindow(event: CheckInEvent, now = new Date()): CheckInWindow {
  const opensAt = new Date(event.startsAt.getTime() - CHECK_IN_OPENS_BEFORE_MS);
  const referenceEnd = event.endsAt ?? new Date(event.startsAt.getTime() + CHECK_IN_DEFAULT_DURATION_MS);
  const closesAt = new Date(referenceEnd.getTime() + CHECK_IN_CLOSES_AFTER_MS);

  if (event.status === "CANCELLED") {
    return { open: false, opensAt, closesAt, reason: "cancelled" };
  }
  if (event.status === "FINISHED") {
    return { open: false, opensAt, closesAt, reason: "finished" };
  }
  if (now < opensAt) {
    return { open: false, opensAt, closesAt, reason: "before" };
  }
  if (now > closesAt) {
    return { open: false, opensAt, closesAt, reason: "after" };
  }
  return { open: true, opensAt, closesAt, reason: "open" };
}

export const CHECK_IN_NOTICE =
  "Marque Cheguei somente quando estiver no local do jogo. É a chegada que libera sua entrada no racha.";
