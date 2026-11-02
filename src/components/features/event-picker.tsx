import { LinkTabs } from "@/components/ui/tabs";
import type { EventSummary } from "@/db/queries/events";
import { formatDateShort, formatTime } from "@/lib/time";

export function EventPicker({
  events,
  selectedId,
  basePath,
  timeZone,
}: {
  events: EventSummary[];
  selectedId?: string;
  basePath: string;
  timeZone: string;
}) {
  if (events.length <= 1) return null;

  return (
    <LinkTabs
      className="mb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      items={events.map((event) => ({
        href: `${basePath}?evento=${event.id}`,
        label: `${formatDateShort(event.startsAt, timeZone)} · ${formatTime(event.startsAt, timeZone)}`,
        active: event.id === selectedId,
      }))}
    />
  );
}
