import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { aFecha, diaMes, esFechaValida, lunesDe, nombreDia, sumarDias } from "@/lib/fechas";
import { titulo } from "@/lib/mayusculas";
import { formatoRemito } from "@/lib/remito";
import { exigirOficina } from "@/lib/session";
import { HojaDia, type Fila } from "./HojaDia";

export default async function HojaDelDia({ params }: { params: Promise<{ fecha: string }> }) {
  const usuario = await exigirOficina();
  const { fecha } = await params;
  if (!esFechaValida(fecha)) notFound();

  const [pedidos, cerrado] = await Promise.all([
    db.pedido.findMany({
      where: { fechaEntrega: aFecha(fecha), estado: { not: "CANCELADO" } },
      include: { cliente: true, punto: true, items: { orderBy: { producto: { orden: "asc" } } } },
      orderBy: [{ ordenDia: "asc" }, { creadoEn: "asc" }],
    }),
    db.diaCerrado.findUnique({ where: { fecha: aFecha(fecha) } }),
  ]);

  // Marca de deuda: el cliente tiene saldo a favor de la empresa (el monto se ve en su cuenta corriente).
  const saldos = await db.movimientoCuenta.groupBy({ by: ["clienteId"], where: { clienteId: { in: [...new Set(pedidos.map((p) => p.clienteId))] } }, _sum: { monto: true } });
  const debe = new Set(saldos.filter((s) => Number(s._sum.monto ?? 0) > 0.005).map((s) => s.clienteId));

  const filas: Fila[] = pedidos.map((p) => ({
    id: p.id,
    clienteId: p.clienteId,
    barrio: p.punto.barrio,
    cliente: p.punto.alias && !p.cliente.nombre.includes(p.punto.alias) ? `${p.cliente.nombre} · ${p.punto.alias}` : p.cliente.nombre,
    direccion: titulo(p.punto.direccion),
    telefono: p.punto.telefono ?? "",
    items: p.items.map((i) => ({ nombre: i.nombre, cantidad: p.estado === "ENTREGADO" ? (i.cantidadEntregada ?? i.cantidad) : i.cantidad })),
    monto: importeVigente(p.items, Number(p.ivaPct), p.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE"),
    conFactura: p.conFactura,
    numeroFactura: p.numeroFactura ?? "",
    estado: p.estado as Fila["estado"],
    cobro: p.cobro,
    medioCobro: p.medioCobro,
    tieneDeuda: debe.has(p.clienteId),
    remito: p.remitoNumero ? formatoRemito(p.remitoNumero) : null,
  }));

  const lunes = lunesDe(fecha);
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1900px] space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/pedidos?semana=${lunes}`} className="text-sm text-stone-600">← Semana</Link>
          <Link href={`/pedidos/dia/${sumarDias(fecha, -1)}`} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" aria-label="Día anterior">←</Link>
          <h1 className="text-2xl font-bold">{nombreDia(fecha)} {diaMes(fecha)}</h1>
          <Link href={`/pedidos/dia/${sumarDias(fecha, 1)}`} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" aria-label="Día siguiente">→</Link>
        </div>
        <HojaDia fecha={fecha} filasIniciales={filas} cerrado={!!cerrado} esDueno={usuario.rol === "DUENO"} />
      </main>
    </>
  );
}
