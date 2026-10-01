import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { aFecha, deFecha, diaMes, esFechaValida, lunesDe, nombreDia, sumarDias } from "@/lib/fechas";
import { porReparto } from "@/lib/ruta";
import { exigirOficina } from "@/lib/session";
import { aFila, clientesConDeuda, incluirPedido } from "../../filas";
import { CONTENEDOR_PEDIDOS, EncabezadoPedidos } from "../../Encabezado";
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
  const domingo = sumarDias(lunes, 6);
  const [cuentaPedidos, cuentaSalidas] = await Promise.all([
    db.pedido.groupBy({ by: ["fechaEntrega"], where: { estado: { not: "CANCELADO" }, fechaEntrega: { gte: aFecha(lunes), lte: aFecha(domingo) } }, _count: true }),
    db.salida.groupBy({ by: ["fecha"], where: { fecha: { gte: aFecha(lunes), lte: aFecha(domingo) } }, _count: true }),
  ]);
  const nPedidos = new Map(cuentaPedidos.map((c) => [c.fechaEntrega ? deFecha(c.fechaEntrega) : "", c._count]));
  const nSalidas = new Map(cuentaSalidas.map((c) => [deFecha(c.fecha), c._count]));
  const fechasSemana = Array.from({ length: 6 }, (_, n) => sumarDias(lunes, n));
  const diasSemana = fechasSemana.map((f) => ({ fecha: f, corta: `${nombreDia(f).slice(0, 3)} ${diaMes(f)}` }));
  const mismoDia = (semana: number) => sumarDias(fecha, 7 * semana);

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoPedidos activa="ruta" fechaRuta={fecha} />

        {/* Para ir día por día: la semana y sus seis días */}
        <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Días de la semana">
          <Link href={`/pedidos/dia/${mismoDia(-1)}`} className="rounded-md border border-stone-400 bg-white px-3 py-2.5 text-sm shadow-sm hover:border-verde-700" aria-label="Semana anterior">←</Link>
          <Link href={`/pedidos/semana?semana=${lunes}`} title="Ver el resumen de la semana" className="rounded-md bg-verde-800 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-700">Semana {diaMes(lunes)}</Link>
          <Link href={`/pedidos/dia/${mismoDia(1)}`} className="rounded-md border border-stone-400 bg-white px-3 py-2.5 text-sm shadow-sm hover:border-verde-700" aria-label="Semana siguiente">→</Link>
          <span className="mx-1 hidden h-8 w-px bg-stone-300 sm:block" />
          {fechasSemana.map((f) => {
            const activo = f === fecha;
            return (
              <Link
                key={f}
                href={`/pedidos/dia/${f}`}
                aria-current={activo ? "page" : undefined}
                className={`flex min-w-24 flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2 text-center shadow-sm transition ${activo ? "border-verde-800 bg-verde-800 text-white" : "border-stone-400 bg-white text-stone-800 hover:border-verde-700"}`}
              >
                <span className="text-sm font-bold uppercase leading-none tracking-wide">{nombreDia(f).slice(0, 3)} {Number(f.slice(8))}</span>
                <span className={`text-[11px] leading-none ${activo ? "text-verde-100" : "text-stone-500"}`}>
                  {nPedidos.get(f) ?? 0} {(nPedidos.get(f) ?? 0) === 1 ? "pedido" : "pedidos"}{nSalidas.get(f) ? ` · ${nSalidas.get(f)} veh.` : ""}
                </span>
              </Link>
            );
          })}
        </nav>

        <h2 className="text-center text-2xl font-bold">Hoja de ruta · {nombreDia(fecha)} {diaMes(fecha)}</h2>

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
