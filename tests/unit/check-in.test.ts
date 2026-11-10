import { describe, expect, it } from "vitest";
import { checkInWindow } from "@/lib/check-in";

const event = {
  startsAt: new Date("2026-12-05T22:00:00.000Z"),
  endsAt: new Date("2026-12-06T01:00:00.000Z"),
  status: "SCHEDULED" as const,
};

describe("checkInWindow", () => {
  it("abre 2 horas antes do início", () => {
    const window = checkInWindow(event, new Date("2026-12-05T19:59:00.000Z"));
    expect(window.open).toBe(false);
    expect(window.reason).toBe("before");

    const openWindow = checkInWindow(event, new Date("2026-12-05T20:00:00.000Z"));
    expect(openWindow.open).toBe(true);
    expect(openWindow.reason).toBe("open");
  });

  it("fecha 2 horas depois do fim", () => {
    const openWindow = checkInWindow(event, new Date("2026-12-06T02:59:00.000Z"));
    expect(openWindow.open).toBe(true);

    const closedWindow = checkInWindow(event, new Date("2026-12-06T03:01:00.000Z"));
    expect(closedWindow.open).toBe(false);
    expect(closedWindow.reason).toBe("after");
  });

  it("bloqueia evento cancelado ou encerrado", () => {
    const now = new Date("2026-12-05T22:30:00.000Z");
    expect(checkInWindow({ ...event, status: "CANCELLED" }, now).reason).toBe("cancelled");
    expect(checkInWindow({ ...event, status: "FINISHED" }, now).reason).toBe("finished");
  });
});
