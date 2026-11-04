import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { vendedoresDesbloqueado } from "@/lib/claveVendedores";
import { db } from "@/lib/db";
import { esFechaValida, hoy, nombreDia, sumarDias } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { EncabezadoComercial } from "../EncabezadoComercial";
import { Panel, SinDatos } from "../estadisticas/Graficos";
import { PantallaBloqueada } from "../vendedores/Bloqueo";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (m: string) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const mesSiguiente = (m: string) => sumarDias(`${m}-01`, 32).slice(0, 7);
const mesAnterior = (m: string) => sumarDias(`${m}-01`, -1).slice(0, 7);
const fechaAR = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const inicioDia = (f: string) => new Date(`${f}T00:00:00-03:00`); // Argentina no cambia la hora: siempre -03:00
const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const fechaLarga = (f: string) => `${nombreDia(f)} ${Number(f.slice(8))} de ${MESES[Number(f.slice(5, 7)) - 1]}`;
const esFecha = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && esFechaValida(s);

type P = { f: string; en: Date; monto: number };
const suma = (l: P[]) => ({ pedidos: l.length, total: l.reduce((t, p) => t + p.monto, 0) });

// TIENDA ONLINE: cómo viene la venta minorista. Cada pedido cuenta el día en que se HIZO (no importa cuándo se entregue ni si ya pagó).
// La facturación es el total de todos los pedidos que entraron; los CANCELADOS no cuentan (si se cancela uno, se resta).
export default async function Tienda({ searchParams }: { searchParams: Promise<{ mes?: string; dia?: string }> }) {
  const usuario = await exigirOficina();
  if (!(await vendedoresDesbloqueado())) return <PantallaBloqueada usuario={usuario} activa="tienda" titulo="Tienda online" volver="/comercial/tienda" />;

  const { mes: mesParam, dia: diaParam } = await searchParams;
  const fechaHoy = hoy();
  const dia = esFecha(diaParam) && diaParam! <= fechaHoy ? diaParam! : fechaHoy; // se puede mirar cualquier día hasta hoy
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) && esFechaValida(`${mesParam}-01`) ? mesParam : dia.slice(0, 7);
  const esHoy = dia === fechaHoy;

  // Se trae el mes que se está mirando y, aparte, el día elegido con los 8 días anteriores (para comparar).
  const iniMes = inicioDia(`${mes}-01`), finMes = inicioDia(`${mesSiguiente(mes)}-01`);
  const iniComp = inicioDia(sumarDias(dia, -8)), finComp = inicioDia(sumarDias(dia, 1));
  const filas = await db.pedido.findMany({
    where: { origen: "WEB", estado: { not: "CANCELADO" }, OR: [{ creadoEn: { gte: iniMes, lt: finMes } }, { creadoEn: { gte: iniComp, lt: finComp } }] },
    select: { creadoEn: true, webTotal: true },
  });
  const todos: P[] = filas.map((p) => ({ f: fechaAR(p.creadoEn), en: p.creadoEn, monto: Number(p.webTotal ?? 0) }));

  // DÍA ELEGIDO contra el día anterior y el mismo día de la semana pasada. Si es hoy, hasta la misma hora (si no, hoy siempre perdería contra un día entero).
  const ahora = new Date();
  const transcurrido = ahora.getTime() - inicioDia(dia).getTime();
  const ventana = (f: string) => {
    const ini = inicioDia(f).getTime();
    const fin = esHoy ? ini + transcurrido : ini + 24 * 3600_000 - 1;
    return todos.filter((p) => p.en.getTime() >= ini && p.en.getTime() <= fin);
  };
  const horaAhora = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ahora);
  const delDia = suma(todos.filter((p) => p.f === dia));
  const ayer = suma(ventana(sumarDias(dia, -1)));
  const semPasada = suma(ventana(sumarDias(dia, -7)));
  const ticket = delDia.pedidos ? delDia.total / delDia.pedidos : null;
  const vs = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
  const txt = (a: number, b: number, cuando: string) => { const v = vs(a, b); return v === null ? `${cuando}: sin datos` : `${v >= 0 ? "▲" : "▼"} ${Math.abs(v)}% vs ${cuando}`; };
  const col = (a: number, b: number) => { const v = vs(a, b); return v === null ? "text-stone-400" : v >= 0 ? "text-emerald-400" : "text-red-400"; };
  const cuandoAyer = `${nombreDia(sumarDias(dia, -1)).toLowerCase()} anterior`;

  // DETALLE POR DÍA del mes que se está mirando
  const delMes = todos.filter((p) => p.f.startsWith(mes));
  const diasDelMes = Number(sumarDias(`${mesSiguiente(mes)}-01`, -1).slice(8));
  const dias = Array.from({ length: diasDelMes }, (_, i) => {
    const f = `${mes}-${String(i + 1).padStart(2, "0")}`;
    return { f, dia: i + 1, nombre: nombreDia(f), ...suma(delMes.filter((p) => p.f === f)) };
  });
  const tot = suma(delMes);
  const diasConVenta = dias.filter((d) => d.pedidos > 0).length;
  const nav = "flex h-9 items-center rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold hover:border-stone-600";
  const navOff = "flex h-9 items-center rounded-md border border-stone-200 bg-stone-100 px-3 text-sm font-semibold text-stone-300";
  const celda = "px-3 py-1.5 text-center tabular-nums";
  const href = (d: string, m?: string) => `/comercial/tienda?dia=${d}${m ? `&mes=${m}` : ""}`;

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoComercial
          activa="tienda"
          derecha={
            <nav className="flex items-center gap-2" aria-label="Mes">
              <Link href={href(dia, mesAnterior(mes))} className={nav} aria-label="Mes anterior">←</Link>
              <span className="min-w-44 rounded-md border border-stone-800 bg-stone-800 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">{nombreMes(mes)}</span>
              {mesSiguiente(mes) <= fechaHoy.slice(0, 7) ? <Link href={href(dia, mesSiguiente(mes))} className={nav} aria-label="Mes siguiente">→</Link> : <span className={navOff} aria-hidden>→</span>}
            </nav>
          }
        />

        {/* El día que se está mirando: ← día anterior · fecha · día siguiente → */}
        <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Día">
          <Link href={href(sumarDias(dia, -1))} className={nav} aria-label="Día anterior">← Día anterior</Link>
          <span className="min-w-64 rounded-md border border-stone-800 bg-stone-800 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">{fechaLarga(dia)}{esHoy && " · hoy"}</span>
          {esHoy ? <span className={navOff} aria-hidden>Día siguiente →</span> : <Link href={href(sumarDias(dia, 1))} className={nav} aria-label="Día siguiente">Día siguiente →</Link>}
          {!esHoy && <Link href="/comercial/tienda" className={nav}>Ir a hoy</Link>}
        </nav>

        <section aria-label="Resumen del día" className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-stone-700 bg-stone-700 sm:grid-cols-3">
          {[
            { t: "Pedidos", v: String(delDia.pedidos), d1: txt(delDia.pedidos, ayer.pedidos, cuandoAyer), c1: col(delDia.pedidos, ayer.pedidos), d2: txt(delDia.pedidos, semPasada.pedidos, "semana pasada"), c2: col(delDia.pedidos, semPasada.pedidos) },
            { t: "Facturación", v: pesos(delDia.total), d1: txt(delDia.total, ayer.total, cuandoAyer), c1: col(delDia.total, ayer.total), d2: txt(delDia.total, semPasada.total, "semana pasada"), c2: col(delDia.total, semPasada.total) },
            { t: "Ticket promedio", v: ticket === null ? "—" : pesos(ticket), d1: "por pedido", c1: "text-stone-400", d2: "", c2: "" },
          ].map((x) => (
            <div key={x.t} className="bg-stone-900 px-4 py-4 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">{x.t}</p>
              <p className="mt-1 truncate text-[26px] font-extrabold leading-tight tabular-nums text-white">{x.v}</p>
              <p className={`mt-0.5 text-[12px] ${x.c1}`}>{x.d1}</p>
              <p className={`text-[12px] ${x.c2}`}>{x.d2 || " "}</p>
            </div>
          ))}
        </section>
        <p className="-mt-2 text-center text-[12px] text-stone-500">
          {esHoy ? `Hoy hasta las ${horaAhora}: se compara contra el día anterior y el mismo día de la semana pasada hasta esta misma hora. ` : "Se compara contra el día anterior y el mismo día de la semana pasada. "}
          Cuenta todo lo que entró ese día (esté pago o no); los cancelados no cuentan.
        </p>

        <Panel titulo="Detalle por día" nota={`${nombreMes(mes)} · tocá un día para verlo arriba`}>
          {tot.pedidos === 0 ? <SinDatos /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-stone-300 bg-crema-100 text-[11.5px] uppercase tracking-wide text-stone-600">
                    <th className={`${celda} !text-left`}>Día</th>
                    <th className={celda}>Pedidos</th>
                    <th className={celda}>Facturación</th>
                    <th className={celda}>Ticket promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map((d) => {
                    const futuro = d.f > fechaHoy, elegido = d.f === dia, esDeHoy = d.f === fechaHoy;
                    const tk = d.pedidos ? d.total / d.pedidos : null;
                    return (
                      <tr key={d.f} className={`border-b border-stone-200 ${elegido ? "bg-crema-100 font-semibold" : ""} ${futuro ? "text-stone-300" : ""}`}>
                        <td className={`${celda} !text-left`}>
                          {futuro ? <span>{d.nombre.slice(0, 3)} {d.dia}</span> : <Link href={href(d.f, mes)} className="underline-offset-2 hover:underline">{d.nombre.slice(0, 3)} {d.dia}</Link>}
                          {esDeHoy && <span className="ml-2 rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">hoy</span>}
                        </td>
                        <td className={celda}>{d.pedidos || "—"}</td>
                        <td className={celda}>{d.pedidos ? pesos(d.total) : "—"}</td>
                        <td className={celda}>{tk === null ? "—" : pesos(tk)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-stone-400 bg-crema-100 font-bold">
                    <td className={`${celda} !text-left`}>Total del mes</td>
                    <td className={celda}>{tot.pedidos}</td>
                    <td className={celda}>{pesos(tot.total)}</td>
                    <td className={celda}>{tot.pedidos ? pesos(tot.total / tot.pedidos) : "—"}</td>
                  </tr>
                  {diasConVenta > 0 && (
                    <tr className="bg-crema-50 text-stone-600">
                      <td className={`${celda} !text-left`}>Promedio por día con ventas</td>
                      <td className={celda}>{(tot.pedidos / diasConVenta).toLocaleString("es-AR", { maximumFractionDigits: 1 })}</td>
                      <td className={celda}>{pesos(tot.total / diasConVenta)}</td>
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
