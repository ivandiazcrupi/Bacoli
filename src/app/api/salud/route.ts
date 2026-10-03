import { db } from "@/lib/db";

// Chequeo de salud (sin datos): responde 200 si el sistema y la base andan, 503 si no. Sirve para que Railway detecte caídas y reinicie.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
