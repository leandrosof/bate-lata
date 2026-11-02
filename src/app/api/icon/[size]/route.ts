import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { settings } from "@/db/schema";

export const dynamic = "force-dynamic";

const SIZES = new Set([16, 32, 48, 180, 192, 512]);

const DEFAULT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1d4ed8"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <circle cx="32" cy="32" r="19" fill="none" stroke="#ffffff" stroke-width="2.4" opacity="0.95"/>
  <path d="M32 13c7 6 10 12 10 19s-3 13-10 19" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.7"/>
  <path d="M32 51c-7-6-10-12-10-19s3-13 10-19" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.7"/>
  <path d="M14 27h36M14 37h36" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.5"/>
  <circle cx="32" cy="32" r="4" fill="#ffffff"/>
</svg>`;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await params;
  const size = Number(rawSize);
  if (!SIZES.has(size)) return new Response("Tamanho inválido.", { status: 400 });

  let logo: Buffer | null = null;
  let updatedAt: Date | null = null;

  try {
    const [row] = await db
      .select({ data: settings.logoData, updatedAt: settings.logoUpdatedAt })
      .from(settings)
      .where(eq(settings.id, 1))
      .limit(1);
    logo = row?.data ? Buffer.from(row.data) : null;
    updatedAt = row?.updatedAt ?? null;
  } catch {
    logo = null;
  }

  if (!logo) logo = Buffer.from(DEFAULT_ICON_SVG);

  try {
    const sharp = (await import("sharp")).default;
    const output = await sharp(logo)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    return new Response(new Uint8Array(output), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=0, s-maxage=86400, must-revalidate",
        ETag: `"${size}-${updatedAt?.getTime() ?? 0}"`,
      },
    });
  } catch {
    return new Response("Não foi possível gerar o ícone.", { status: 500 });
  }
}
