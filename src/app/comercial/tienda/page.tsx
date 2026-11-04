import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { vendedoresDesbloqueado } from "@/lib/claveVendedores";
import { db } from "@/lib/db";
import { esFechaValida, hoy, nombreDia, sumarDias } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { EncabezadoComercial } from "../EncabezadoComercial";
import { Barras, Panel, PALETA, SinDatos } from "../estadisticas/Graficos";
import { PantallaBloqueada } from "../vendedores/Bloqueo";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (m: string) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const mesSiguiente = (m: string) => sumarDias(`${m}-01`, 32).slice(0, 7);
const mesAnterior = (m: string) => sumarDias(`${m}-01`, -1).slice(0, 7);
const fechaAR = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const inicioDia = (f: string) => new Date(`${f}T00:00:00-03:00`); // Argentina no cambia la hora: siempre -03:00
const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const corto = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M` : n >= 1000 ? `${Math.round(n / 1000)} mil` : String(Math.round(n)));

type P = { f: string; en: Date; monto: number; confirmado: boolean };

const suma = (l: P[]) => ({
  pedidos: l.length,
  facturado: l.filter((p) => p.confirmado).reduce((t, p) => t + p.monto, 0),
  porConfirmar: l.filter((p) => !p.confirmado).reduce((t, p) => t + p.monto, 0),
  sinConfirmar: l.filter((p) => !p.confirmado).length,
});

// TIENDA ONLINE: cómo viene la venta minorista. Cada pedido cuenta el día en que se HIZO (no importa cuándo se entregue).
// "Facturado" = pedidos con el pago confirmado (Mercado Pago o transferencia ya cruzada); "por confirmar" = transferencias que todavía no llegaron.
export default async function Tienda({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const usuario = await exigirOficina();
  if (!(await vendedoresDesbloqueado())) return <PantallaBloqueada usuario={usuario} activa="tienda" titulo="Tienda online" volver="/comercial/tienda" />;

  const { mes: mesParam } = await searchParams;
  const fechaHoy = hoy();
  const actual = fechaHoy.slice(0, 7);
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) && esFechaValida(`${mesParam}-01`) ? mesParam : actual;

  // Se trae el mes elegido y, aparte, los últimos 8 días (para comparar "hoy" con ayer y la semana pasada).
  const iniMes = inicioDia(`${mes}-01`), finMes = inicioDia(`${mesSiguiente(mes)}-01`);
  const iniComp = inicioDia(sumarDias(fechaHoy, -8)), finComp = inicioDia(sumarDias(fechaHoy, 1));
  const filas = await db.pedido.findMany({
    where: { origen: "WEB", estado: { not: "CANCELADO" }, OR: [{ creadoEn: { gte: iniMes, lt: finMes } }, { creadoEn: { gte: iniComp, lt: finComp } }] },
    select: { creadoEn: true, webTotal: true, webPago: true },
  });
  const todos: P[] = filas.map((p) => ({ f: fechaAR(p.creadoEn), en: p.creadoEn, monto: Number(p.webTotal ?? 0), confirmado: p.webPago !== "PENDIENTE" && p.webPago !== null }));

  // HOY contra ayer y contra el mismo día de la semana pasada, hasta la misma hora (si no, hoy siempre pierde contra un día entero).
  const ahora = new Date();
  const transcurrido = ahora.getTime() - inicioDia(fechaHoy).getTime();
  const hasta = (f: string) => {
    const ini = inicioDia(f).getTime();
    return todos.filter((p) => p.en.getTime() >= ini && p.en.getTime() <= ini + transcurrido);
  };
  const horaAhora = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ahora);
  const hoyL = todos.filter((p) => p.f === fechaHoy);
  const h = suma(hoyL);
  const ayer = suma(hasta(sumarDias(fechaHoy, -1)));
  const semPasada = suma(hasta(sumarDias(fechaHoy, -7)));
  const ticket = hoyL.filter((p) => p.monto > 0).length ? hoyL.reduce((t, p) => t + p.monto, 0) / hoyL.filter((p) => p.monto > 0).length : null;
  const vs = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
  const txt = (a: number, b: number, cuando: string) => { const v = vs(a, b); return v === null ? `${cuando}: sin datos` : `${v >= 0 ? "▲" : "▼"} ${Math.abs(v)}% vs ${cuando}`; };
  const col = (a: number, b: number) => { const v = vs(a, b); return v === null ? "text-stone-400" : v >= 0 ? "text-emerald-400" : "text-red-400"; };

  // DÍA A DÍA del mes elegido
  const delMes = todos.filter((p) => p.f.startsWith(mes));
  const diasDelMes = Number(sumarDias(`${mesSiguiente(mes)}-01`, -1).slice(8));
  const dias = Array.from({ length: diasDelMes }, (_, i) => {
    const f = `${mes}-${String(i + 1).padStart(2, "0")}`;
    return { f, dia: i + 1, nombre: nombreDia(f), ...suma(delMes.filter((p) => p.f === f)) };
  });
  const tot = suma(delMes);
  const diasConVenta = dias.filter((d) => d.pedidos > 0 && d.f <= fechaHoy).length;
  const nav = "flex h-9 items-center rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold hover:border-stone-600";
  const celda = "px-3 py-1.5 text-center tabular-nums";

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoComercial
          activa="tienda"
          derecha={
            <nav className="flex items-center gap-2" aria-label="Mes">
              <Link href={`/comercial/tienda?mes=${mesAnterior(mes)}`} className={nav} aria-label="Mes anterior">←</Link>
              <span className="min-w-44 rounded-md border border-stone-800 bg-stone-800 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">{nombreMes(mes)}</span>
              <Link href={`/comercial/tienda?mes=${mesSiguiente(mes)}`} className={nav} aria-label="Mes siguiente">→</Link>
              {mes !== actual && <Link href="/comercial/tienda" className={nav}>Este mes</Link>}
            </nav>
          }
        />

        {/* HOY: cómo venimos, comparado con ayer y la semana pasada a esta misma hora */}
        <section aria-label="Hoy" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-stone-700 bg-stone-700 lg:grid-cols-4">
          {[
            { t: "Pedidos de hoy", v: String(h.pedidos), d1: txt(h.pedidos, ayer.pedidos, "ayer"), c1: col(h.pedidos, ayer.pedidos), d2: txt(h.pedidos, semPasada.pedidos, "semana pasada"), c2: col(h.pedidos, semPasada.pedidos) },
            { t: "Facturado hoy", v: pesos(h.facturado), d1: txt(h.facturado, ayer.facturado, "ayer"), c1: col(h.facturado, ayer.facturado), d2: txt(h.facturado, semPasada.facturado, "semana pasada"), c2: col(h.facturado, semPasada.facturado) },
            { t: "Por confirmar", v: pesos(h.porConfirmar), d1: h.sinConfirmar ? `${h.sinConfirmar} transferencia${h.sinConfirmar === 1 ? "" : "s"} sin cruzar` : "nada pendiente", c1: h.sinConfirmar ? "text-amber-400" : "text-stone-400", d2: "no suma a lo facturado", c2: "text-stone-500" },
            { t: "Ticket promedio", v: ticket === null ? "—" : pesos(ticket), d1: "por pedido de hoy", c1: "text-stone-400", d2: "", c2: "" },
          ].map((x) => (
            <div key={x.t} className="bg-stone-900 px-4 py-4 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">{x.t}</p>
              <p className="mt-1 truncate text-[26px] font-extrabold leading-tight tabular-nums text-white">{x.v}</p>
              <p className={`mt-0.5 text-[12px] ${x.c1}`}>{x.d1}</p>
              <p className={`text-[12px] ${x.c2}`}>{x.d2 || " "}</p>
            </div>
          ))}
        </section>
        <p className="-mt-2 text-center text-[12px] text-stone-500">Hoy hasta las {horaAhora} · las comparaciones son contra ayer y contra el mismo día de la semana pasada, hasta esta misma hora. Cada pedido cuenta el día en que se hizo.</p>

        <Panel titulo="Facturación día a día" nota={`${nombreMes(mes)} · por día en que se hizo el pedido`}>
          {tot.pedidos === 0 ? <SinDatos /> : (
            <Barras
              etiquetas={dias.map((d) => String(d.dia))}
              formato={corto}
              valoresSiempre
              resaltar={mes === actual ? Number(fechaHoy.slice(8)) - 1 : undefined}
              series={[
                { nombre: "Facturado", color: PALETA[0], valores: dias.map((d) => d.facturado) },
                { nombre: "Por confirmar", color: PALETA[2], valores: dias.map((d) => d.porConfirmar) },
              ]}
            />
          )}
        </Panel>

        <Panel titulo="Detalle por día" nota="pedidos cancelados no cuentan">
          {tot.pedidos === 0 ? <SinDatos /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-stone-300 bg-crema-100 text-[11.5px] uppercase tracking-wide text-stone-600">
                    <th className={`${celda} !text-left`}>Día</th>
                    <th className={celda}>Pedidos</th>
                    <th className={celda}>Facturado</th>
                    <th className={celda}>Por confirmar</th>
                    <th className={celda}>Ticket promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map((d) => {
                    const futuro = d.f > fechaHoy, esHoy = d.f === fechaHoy;
                    const tk = d.pedidos ? (d.facturado + d.porConfirmar) / d.pedidos : null;
                    return (
                      <tr key={d.f} className={`border-b border-stone-200 ${esHoy ? "bg-crema-100 font-semibold" : ""} ${futuro ? "text-stone-300" : ""}`}>
                        <td className={`${celda} !text-left`}>{d.nombre.slice(0, 3)} {d.dia}{esHoy && <span className="ml-2 rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">hoy</span>}</td>
                        <td className={celda}>{d.pedidos || "—"}</td>
                        <td className={celda}>{d.pedidos ? pesos(d.facturado) : "—"}</td>
                        <td className={`${celda} ${d.porConfirmar > 0 ? "text-amber-700" : ""}`}>{d.porConfirmar > 0 ? pesos(d.porConfirmar) : "—"}</td>
                        <td className={celda}>{tk === null ? "—" : pesos(tk)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-stone-400 bg-crema-100 font-bold">
                    <td className={`${celda} !text-left`}>Total del mes</td>
                    <td className={celda}>{tot.pedidos}</td>
                    <td className={celda}>{pesos(tot.facturado)}</td>
                    <td className={celda}>{tot.porConfirmar > 0 ? pesos(tot.porConfirmar) : "—"}</td>
                    <td className={celda}>{tot.pedidos ? pesos((tot.facturado + tot.porConfirmar) / tot.pedidos) : "—"}</td>
                  </tr>
                  {diasConVenta > 0 && (
                    <tr className="bg-crema-50 text-stone-600">
                      <td className={`${celda} !text-left`}>Promedio por día con ventas</td>
                      <td className={celda}>{(tot.pedidos / diasConVenta).toLocaleString("es-AR", { maximumFractionDigits: 1 })}</td>
                      <td className={celda}>{pesos(tot.facturado / diasConVenta)}</td>
                      <td className={celda}>{tot.porConfirmar > 0 ? pesos(tot.porConfirmar / diasConVenta) : "—"}</td>
                      <td className={celda}>—</td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}
        </Panel>
      </main>
    </>
  );
}
