import { startOfDay, subDays } from "date-fns";
import { TZDate } from "@date-fns/tz";
import type { ParsedPixReceipt } from "./parser";

export type ReviewReason =
  | "missing_e2e"
  | "missing_amount"
  | "missing_date"
  | "amount_mismatch"
  | "old_date"
  | "future_date"
  | "recipient_mismatch"
  | "low_confidence"
  | "ocr_failed";

function normalizeName(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function recipientMatches(
  received: string | null,
  expected: string | null,
): boolean {
  if (!received || !expected) return false;

  const receivedTokens = normalizeName(received);
  const expectedTokens = normalizeName(expected);
  const receivedWords = receivedTokens.filter((token) => token.length >= 2);
  const expectedWords = expectedTokens.filter((token) => token.length >= 2);

  const directMatches = receivedWords.filter((token) =>
    expectedWords.includes(token),
  );

  if (directMatches.length >= 2) return true;

  const receivedInitials = receivedTokens.filter(
    (token) =>
      token.length === 1 &&
      expectedWords.some((word) => word.startsWith(token)),
  );
  const expectedInitials = expectedTokens.filter(
    (token) =>
      token.length === 1 &&
      receivedWords.some((word) => word.startsWith(token)),
  );

  return (
    directMatches.length >= 1 &&
    receivedInitials.length + expectedInitials.length >= 1
  );
}

export function isRecentEnough(
  paidAt: Date | null,
  eventCreatedAt: Date,
  timeZone: string,
  now = new Date(),
): boolean {
  if (!paidAt) return false;

  const startOfYesterday = startOfDay(subDays(new TZDate(now, timeZone), 1));

  return (
    paidAt.getTime() >= startOfYesterday.getTime() ||
    paidAt.getTime() >= eventCreatedAt.getTime()
  );
}

export function validatePixProof(input: {
  parsed: ParsedPixReceipt;
  confidence: number;
  eventPriceCents: number;
  eventCreatedAt: Date;
  expectedRecipient: string | null;
  timeZone: string;
  now?: Date;
}): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  const now = input.now ?? new Date();

  if (!input.parsed.e2eId) reasons.push("missing_e2e");
  if (!input.parsed.amountCents) reasons.push("missing_amount");
  if (!input.parsed.paidAt) reasons.push("missing_date");

  if (
    input.parsed.amountCents &&
    input.parsed.amountCents !== input.eventPriceCents
  ) {
    reasons.push("amount_mismatch");
  }

  if (
    input.parsed.paidAt &&
    !isRecentEnough(
      input.parsed.paidAt,
      input.eventCreatedAt,
      input.timeZone,
      now,
    )
  ) {
    reasons.push("old_date");
  }

  if (
    input.parsed.paidAt &&
    input.parsed.paidAt.getTime() > now.getTime() + 5 * 60 * 1000
  ) {
    reasons.push("future_date");
  }

  if (
    !recipientMatches(input.parsed.recipientName, input.expectedRecipient)
  ) {
    reasons.push("recipient_mismatch");
  }

  if (input.confidence < 65) reasons.push("low_confidence");

  return reasons;
}
