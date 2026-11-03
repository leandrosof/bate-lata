import { expirePreRegistrations } from "@/lib/pre-registration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await expirePreRegistrations();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron] falha ao expirar pré-inscrições", error);
    return Response.json({ error: "Falha ao processar." }, { status: 500 });
  }
}
