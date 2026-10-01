import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { aFecha, diaMes, esFechaValida, lunesDe, nombreDia, sumarDias } from "@/lib/fechas";
import { porReparto } from "@/lib/ruta";
import { exigirOficina } from "@/lib/session";
import { aFila, clientesConDeuda, incluirPedido } from "../../filas";
import { HojaDia } from "./HojaDia";

// Hoja de ruta de un día: qué vehículos salen, qué lleva cada uno y en qué orden (con las entregas y cobros de cada pedido).
export default async function HojaDelDia({ params }: { params: Promise<{ fecha: string }> }) {
  const usuario = await exigirOficina();
  const { fecha } = await params;
  if (!esFechaValida(fecha)) notFound();

  const [pedidos, salidas, vehiculos, repartidores, cerrado] = await Promise.all([
    db.pedido.findMany({ where: { fechaEntrega: aFecha(fecha), estado: { not: "CANCELADO" } }, include: { ...incluirPedido, salida: true } }),
    db.salida.findMany({ where: { fecha: aFecha(fecha) }, include: { vehiculo: true }, orderBy: { orden: "asc" } }),
    db.vehiculo.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    db.usuario.findMany({ where: { rol: "REPARTIDOR", activo: true }, orderBy: { nombre: "asc" } }),
    db.diaCerrado.findUnique({ where: { fecha: aFecha(fecha) } }),
  ]);
  pedidos.sort(porReparto);
  const debe = await clientesConDeuda(pedidos.map((p) => p.clienteId));
  const filas = pedidos.map((p) => aFila(p, debe));
  const salen = new Set(salidas.map((s) => s.vehiculoId));

  const lunes = lunesDe(fecha);
  const diasSemana = Array.from({ length: 6 }, (_, n) => sumarDias(lunes, n)).map((f) => ({ fecha: f, corta: `${nombreDia(f).slice(0, 3)} ${diaMes(f)}` }));
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1900px] space-y-4 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/pedidos/semana?semana=${lunes}`} className="text-sm text-stone-600">← Semana</Link>
          <Link href={`/pedidos/dia/${sumarDias(fecha, -1)}`} className="rounded-md border border-stone-400 bg-white px-3 py-2 text-sm shadow-sm" aria-label="Día anterior">←</Link>
          <h1 className="text-2xl font-bold">Hoja de ruta · {nombreDia(fecha)} {diaMes(fecha)}</h1>
          <Link href={`/pedidos/dia/${sumarDias(fecha, 1)}`} className="rounded-md border border-stone-400 bg-white px-3 py-2 text-sm shadow-sm" aria-label="Día siguiente">→</Link>
        </div>
        <HojaDia
          fecha={fecha}
          filasIniciales={filas}
          salidas={salidas.map((s) => ({ id: s.id, nombre: s.vehiculo.nombre, patente: s.vehiculo.patente ?? "", capacidad: s.vehiculo.capacidad, repartidorId: s.repartidorId ?? "" }))}
          vehiculosLibres={vehiculos.filter((v) => !salen.has(v.id)).map((v) => ({ id: v.id, nombre: v.nombre }))}
          repartidores={repartidores.map((r) => ({ id: r.id, nombre: r.nombre }))}
          diasSemana={diasSemana}
          cerrado={!!cerrado}
          esDueno={usuario.rol === "DUENO"}
        />
      </main>
    </>
  );
}
