import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { aFecha, diaMes, esFechaValida, lunesDe, nombreDia, sumarDias } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { aFila, clientesConDeuda, incluirPedido } from "../../filas";
import { HojaDia } from "./HojaDia";

export default async function HojaDelDia({ params }: { params: Promise<{ fecha: string }> }) {
  const usuario = await exigirOficina();
  const { fecha } = await params;
  if (!esFechaValida(fecha)) notFound();

  const [pedidos, cerrado] = await Promise.all([
    db.pedido.findMany({
      where: { fechaEntrega: aFecha(fecha), estado: { not: "CANCELADO" } },
      include: incluirPedido,
      orderBy: [{ ordenDia: "asc" }, { creadoEn: "asc" }],
    }),
    db.diaCerrado.findUnique({ where: { fecha: aFecha(fecha) } }),
  ]);
  const debe = await clientesConDeuda(pedidos.map((p) => p.clienteId));
  const filas = pedidos.map((p) => aFila(p, debe));

  const lunes = lunesDe(fecha);
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1900px] space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/pedidos/ruta?semana=${lunes}`} className="text-sm text-stone-600">← Hoja de ruta</Link>
          <Link href={`/pedidos/dia/${sumarDias(fecha, -1)}`} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" aria-label="Día anterior">←</Link>
          <h1 className="text-2xl font-bold">{nombreDia(fecha)} {diaMes(fecha)}</h1>
          <Link href={`/pedidos/dia/${sumarDias(fecha, 1)}`} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" aria-label="Día siguiente">→</Link>
        </div>
        <HojaDia fecha={fecha} filasIniciales={filas} cerrado={!!cerrado} esDueno={usuario.rol === "DUENO"} />
      </main>
    </>
  );
}
