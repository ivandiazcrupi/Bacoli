import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { aFecha, deFecha, diaMes, esFechaValida, hoy, lunesDe, nombreDia, sumarDias } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { bultosDe } from "@/lib/ruta";
import { exigirOficina } from "@/lib/session";
import { PestanasPedidos } from "../Pestanas";

// SEMANA: cada día con lo que tiene asignado. Al entrar a un día se arma su hoja de ruta (qué vehículos salen y qué lleva cada uno).
export default async function Semana({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const usuario = await exigirOficina();
  const { semana } = await searchParams;
  const lunes = lunesDe(semana && esFechaValida(semana) ? semana : hoy());
  const domingo = sumarDias(lunes, 6);
  const esta = lunesDe(hoy());

  const [pedidos, salidas, cerrados] = await Promise.all([
    db.pedido.findMany({ where: { estado: { not: "CANCELADO" }, fechaEntrega: { gte: aFecha(lunes), lte: aFecha(domingo) } }, include: { items: true } }),
    db.salida.findMany({ where: { fecha: { gte: aFecha(lunes), lte: aFecha(domingo) } }, include: { vehiculo: true }, orderBy: { orden: "asc" } }),
    db.diaCerrado.findMany({ where: { fecha: { gte: aFecha(lunes), lte: aFecha(domingo) } } }),
  ]);
  const cerradosSet = new Set(cerrados.map((d) => deFecha(d.fecha)));
  const hayDomingo = pedidos.some((p) => p.fechaEntrega && deFecha(p.fechaEntrega) === domingo);
  const fechas = Array.from({ length: hayDomingo ? 7 : 6 }, (_, n) => sumarDias(lunes, n));

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <Link href="/pedidos/nuevo" className="whitespace-nowrap rounded-lg bg-verde-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800 sm:px-10">+ Cargar pedido</Link>
        </div>
        <PestanasPedidos activa="semana" />

        <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Semana">
          <Link href={`/pedidos/semana?semana=${sumarDias(lunes, -7)}`} className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm" aria-label="Semana anterior">←</Link>
          <span className="min-w-40 text-center text-base font-semibold">Semana {diaMes(lunes)} al {diaMes(domingo)}</span>
          <Link href={`/pedidos/semana?semana=${sumarDias(lunes, 7)}`} className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm" aria-label="Semana siguiente">→</Link>
          {lunes !== esta && <Link href="/pedidos/semana" className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm">Esta semana</Link>}
        </nav>

        <div className="space-y-2">
          {fechas.map((f) => {
            const delDia = pedidos.filter((p) => p.fechaEntrega && deFecha(p.fechaEntrega) === f);
            const sus = salidas.filter((s) => deFecha(s.fecha) === f);
            const sinVehiculo = delDia.filter((p) => p.salidaId === null).length;
            const bultos = delDia.reduce((s, p) => s + bultosDe(p.items), 0);
            const monto = delDia.reduce((s, p) => s + importeVigente(p.items, Number(p.ivaPct), p.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE"), 0);
            const esHoy = f === hoy();
            return (
              <Link
                key={f}
                href={`/pedidos/dia/${f}`}
                className={`grid items-center gap-x-4 gap-y-2 rounded-xl border bg-white px-5 py-4 shadow-sm hover:border-verde-700 lg:grid-cols-[11rem_1fr_9rem_9rem_9rem_7rem] ${esHoy ? "border-verde-700 border-l-4" : "border-stone-300"}`}
              >
                <span>
                  <span className="block text-lg font-bold">{nombreDia(f)}</span>
                  <span className="text-sm text-stone-600">{diaMes(f)}{esHoy && " · hoy"}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {sus.length === 0 ? <span className="text-sm text-stone-400">Sin vehículos todavía</span> : sus.map((s) => <span key={s.id} className="rounded-full bg-crema-200 px-3 py-1 text-xs font-semibold uppercase text-verde-900">{s.vehiculo.nombre}</span>)}
                  {sinVehiculo > 0 && <span className="rounded-full bg-rojo-100 px-3 py-1 text-xs font-semibold text-rojo-800">{sinVehiculo} sin vehículo</span>}
                </span>
                <span className="text-sm"><b className="tabular-nums">{delDia.length}</b> {delDia.length === 1 ? "pedido" : "pedidos"}</span>
                <span className="text-sm"><b className="tabular-nums">{bultos}</b> bultos</span>
                <span className="text-sm font-semibold tabular-nums">{delDia.length ? formatoPesos(monto) : "—"}</span>
                <span className="flex items-center justify-end gap-2 text-sm font-medium text-verde-800">
                  {cerradosSet.has(f) && <span className="rounded-full bg-stone-800 px-2.5 py-0.5 text-xs font-semibold text-white">Cerrado</span>}
                  Abrir →
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
