import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
}

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function fallbackSvg(name: string) {
  const initials = escapeXml(initialsOf(name) || "?");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="${escapeXml(name)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1d4ed8"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" fill="url(#g)"/>
  <circle cx="128" cy="128" r="88" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
  <text x="128" y="128" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="700" text-anchor="middle" dominant-baseline="central">${initials}</text>
</svg>`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Não autorizado", { status: 401 });

  const { userId } = await params;
  const rows = await db
    .select({
      name: users.name,
      avatarData: users.avatarData,
      avatarMime: users.avatarMime,
      avatarUpdatedAt: users.avatarUpdatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return new Response("Não encontrado", { status: 404 });

  if (!row.avatarData || !row.avatarMime) {
    return new Response(fallbackSvg(row.name), {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const etag = `"${row.avatarUpdatedAt?.getTime() ?? 0}"`;
  if (_request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(new Uint8Array(row.avatarData), {
    headers: {
      "Content-Type": row.avatarMime,
      "Cache-Control": "private, max-age=86400",
      ETag: etag,
    },
  });
}
