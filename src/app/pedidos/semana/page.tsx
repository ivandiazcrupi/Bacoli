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

  const totalPedidos = pedidos.length;
  const totalBultos = pedidos.reduce((t, p) => t + bultosDe(p.items), 0);
  const totalMonto = pedidos.reduce((t, p) => t + importeVigente(p.items, Number(p.ivaPct), p.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE"), 0);
  const totalSinVehiculo = pedidos.filter((p) => p.salidaId === null).length;
  const resumen = [
    { t: "Pedidos", v: String(totalPedidos) },
    { t: "Bultos", v: String(totalBultos) },
    { t: "Monto", v: formatoPesos(totalMonto) },
    { t: "Salidas de vehículos", v: String(salidas.length) },
    { t: "Sin vehículo", v: String(totalSinVehiculo), alerta: totalSinVehiculo > 0 },
  ];

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <Link href="/pedidos/nuevo" className="whitespace-nowrap rounded-lg bg-verde-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800 sm:px-10">+ Cargar pedido</Link>
        </div>
        <PestanasPedidos activa="semana" fechaRuta={esta === lunes ? undefined : lunes} />

        <nav className="flex flex-wrap items-center justify-center gap-3 text-sm" aria-label="Semana">
          <Link href={`/pedidos/semana?semana=${sumarDias(lunes, -7)}`} className="rounded-md border border-stone-400 bg-white px-4 py-2.5 shadow-sm hover:border-verde-700" aria-label="Semana anterior">←</Link>
          <span className="min-w-52 rounded-md bg-verde-800 px-6 py-2.5 text-center text-base font-bold uppercase tracking-wide text-white">Semana {diaMes(lunes)}</span>
          <Link href={`/pedidos/semana?semana=${sumarDias(lunes, 7)}`} className="rounded-md border border-stone-400 bg-white px-4 py-2.5 shadow-sm hover:border-verde-700" aria-label="Semana siguiente">→</Link>
          {lunes !== esta && <Link href="/pedidos/semana" className="rounded-md border border-stone-400 bg-white px-4 py-2.5 shadow-sm hover:border-verde-700">Esta semana</Link>}
        </nav>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Resumen de la semana">
          {resumen.map((r) => (
            <div key={r.t} className={`rounded-xl border bg-white px-4 py-4 text-center shadow-sm ${r.alerta ? "border-rojo-600" : "border-stone-300"}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{r.t}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${r.alerta ? "text-rojo-700" : "text-stone-900"}`}>{r.v}</p>
            </div>
          ))}
        </section>

        <div className="space-y-2">
          <div className="hidden gap-x-4 rounded-t-xl bg-verde-800 px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-white lg:grid lg:grid-cols-[9rem_1fr_7rem_7rem_9rem_8rem_7rem]">
            <span>Día</span><span>Vehículos (carga)</span><span>Pedidos</span><span>Bultos</span><span>Monto</span><span>Entregas</span><span />
          </div>
          {fechas.map((f) => {
            const delDia = pedidos.filter((p) => p.fechaEntrega && deFecha(p.fechaEntrega) === f);
            const sus = salidas.filter((s) => deFecha(s.fecha) === f);
            const sinVehiculo = delDia.filter((p) => p.salidaId === null).length;
            const bultos = delDia.reduce((s, p) => s + bultosDe(p.items), 0);
            const monto = delDia.reduce((s, p) => s + importeVigente(p.items, Number(p.ivaPct), p.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE"), 0);
            const entregados = delDia.filter((p) => p.estado === "ENTREGADO").length;
            const esHoy = f === hoy();
            return (
              <Link
                key={f}
                href={`/pedidos/dia/${f}`}
                className={`grid items-center gap-x-4 gap-y-2 rounded-xl border bg-white px-5 py-4 text-center shadow-sm hover:border-verde-700 lg:grid-cols-[9rem_1fr_7rem_7rem_9rem_8rem_7rem] ${esHoy ? "border-l-4 border-verde-700" : "border-stone-300"}`}
              >
                <span>
                  <span className="block text-lg font-bold">{nombreDia(f)}</span>
                  <span className="text-sm text-stone-600">{diaMes(f)}{esHoy && " · hoy"}</span>
                </span>
                <span className="flex flex-wrap items-center justify-center gap-2">
                  {sus.length === 0 && sinVehiculo === 0 && <span className="text-sm text-stone-400">—</span>}
                  {sus.map((s) => {
                    const carga = delDia.filter((p) => p.salidaId === s.id).reduce((t, p) => t + bultosDe(p.items), 0);
                    const pasado = s.vehiculo.capacidad !== null && carga > s.vehiculo.capacidad;
                    return (
                      <span key={s.id} className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${pasado ? "bg-rojo-100 text-rojo-800" : "bg-crema-200 text-verde-900"}`}>
                        {s.vehiculo.nombre} · {carga}{s.vehiculo.capacidad !== null && ` / ${s.vehiculo.capacidad}`}
                      </span>
                    );
                  })}
                  {sinVehiculo > 0 && <span className="rounded-full bg-rojo-100 px-3 py-1 text-xs font-semibold text-rojo-800">{sinVehiculo} sin vehículo</span>}
                </span>
                <span className="text-sm font-semibold tabular-nums">{delDia.length}</span>
                <span className="text-sm font-semibold tabular-nums">{bultos}</span>
                <span className="text-sm font-semibold tabular-nums">{delDia.length ? formatoPesos(monto) : "—"}</span>
                <span className="text-sm tabular-nums">{delDia.length ? `${entregados} de ${delDia.length}` : "—"}</span>
                <span className="flex items-center justify-center gap-2 text-sm font-semibold text-verde-800">
                  {cerradosSet.has(f) && <span className="rounded-full bg-stone-800 px-2.5 py-0.5 text-xs font-semibold text-white">Cerrado</span>}
                  Abrir ›
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
