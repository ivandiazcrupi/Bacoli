import { db } from "@/lib/db";
import { aTexto, generarCopia } from "@/lib/copia";
import { exigirUsuario } from "@/lib/session";

// Descarga de la copia de seguridad. Solo dueños.
export async function GET() {
  const usuario = await exigirUsuario();
  if (usuario.rol !== "DUENO") return new Response("No tenés permiso.", { status: 403 });
  const copia = await generarCopia();
  await db.empresa.upsert({ where: { id: "principal" }, update: { ultimaCopia: new Date(), ultimaCopiaPor: usuario.nombre }, create: { id: "principal", ultimaCopia: new Date(), ultimaCopiaPor: usuario.nombre } });
  const marca = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" }).format(new Date()).replace(" ", "_").replace(":", "");
  return new Response(aTexto(copia), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="bacoli-copia-${marca}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
