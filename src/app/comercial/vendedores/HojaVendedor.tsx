import { formatoPesos } from "@/lib/numeros";
import { num } from "@/lib/ruta";
import { type FilaVendedor, nombreMes, resumenDe } from "@/lib/vendedores";
import { Barras, BarrasH, Panel, SinDatos } from "../estadisticas/Graficos";

// La hoja de un vendedor: cómo viene el mes (vendido, comisión, unidades), gráficos y cada pedido como una cuenta corriente.
// La usan la ficha de Comercial → Vendedores y la pantalla del propio vendedor.

const ESTADOS = { PENDIENTE: "Pendiente", ENTREGADO: "Entregado", NO_ENTREGADO: "No entregado" } as const;
const PASTILLA_ESTADO = { PENDIENTE: "bg-[#fdf8e3] text-[#8a6a05]", ENTREGADO: "bg-verde-50 text-verde-700", NO_ENTREGADO: "bg-rojo-50 text-rojo-700" } as const;
const MEDIOS: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE: "Cheque", MERCADO_PAGO: "Mercado Pago", OTRO: "Otro" };
const pastilla = "inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-[12.5px] font-bold";
const fecha = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : "");
const corto = (n: number) => (n >= 1_000_000 ? `$ ${(n / 1_000_000).toFixed(1).replace(".", ",")} M` : `$ ${Math.round(n / 1000)} mil`);
const variacion = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

function Tendencia({ ahora, antes }: { ahora: number; antes: number }) {
  const v = variacion(ahora, antes);
  if (v === null) return <span className="text-[12px] text-stone-400">mes anterior sin ventas</span>;
  return <span className={`text-[12px] font-semibold ${v >= 0 ? "text-verde-700" : "text-rojo-700"}`}>{v >= 0 ? "▲" : "▼"} {Math.abs(v)}% vs mes anterior</span>;
}

export function HojaVendedor({ nombre, pct, mes, filas, anteriores, comision = true }: {
  nombre: string; pct: number; mes: string; filas: FilaVendedor[]; anteriores: FilaVendedor[]; comision?: boolean;
}) {
  const r = resumenDe(filas, pct);
  const ant = resumenDe(anteriores, pct);
  const dias = Number(new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)), 0)).getUTCDate());
  const etiquetas = Array.from({ length: dias }, (_, i) => String(i + 1));
  const ent = filas.filter((x) => x.estado === "ENTREGADO");
  const porDia = (val: (x: FilaVendedor) => number) => etiquetas.map((_, i) => ent.filter((x) => Number(x.f.slice(8)) === i + 1).reduce((t, x) => t + val(x), 0));

  const porCliente = new Map<string, { nombre: string; neto: number; pedidos: number }>();
  for (const x of ent) {
    const c = porCliente.get(x.clienteId) ?? { nombre: x.cliente, neto: 0, pedidos: 0 };
    c.neto += x.neto; c.pedidos += 1; porCliente.set(x.clienteId, c);
  }
  const top = [...porCliente.values()].sort((a, b) => b.neto - a.neto).slice(0, 8);
  const ordenadas = [...filas].sort((a, b) => b.cargado.localeCompare(a.cargado) || b.f.localeCompare(a.f));
  const totalMonto = ent.reduce((t, x) => t + x.total, 0);

  const tarjeta = (titulo: string, valor: string, pie?: React.ReactNode, grande = false, rojo = false) => (
    <div className="flex flex-col items-center justify-center px-4 py-4 text-center">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">{titulo}</div>
      <div className={`mt-1 font-bold tabular-nums ${grande ? "text-3xl" : "text-2xl"} ${rojo ? "text-rojo-700" : "text-stone-900"}`}>{valor}</div>
      <div className="mt-0.5 min-h-[1.1rem] text-[12px] text-stone-500">{pie}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Cómo viene el mes: lo vendido y la comisión pesan lo mismo */}
      <section aria-label={`Resumen de ${nombreMes(mes)}`} className="grid grid-cols-2 divide-x divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-300 bg-white lg:grid-cols-6 lg:divide-y-0">
        {tarjeta("Vendió", formatoPesos(r.neto), <Tendencia ahora={r.neto} antes={ant.neto} />, true)}
        {comision && tarjeta("Comisión", formatoPesos(r.comision), pct ? `${String(pct).replace(".", ",")}% de lo vendido` : "sin % cargado", true)}
        {tarjeta("Unidades", num(r.unidades), <Tendencia ahora={r.unidades} antes={ant.unidades} />)}
        {tarjeta("Pedidos", String(r.pedidos), `${r.entregados} entregados · ${r.porEntregar} por entregar`)}
        {tarjeta("Por cobrar", formatoPesos(r.porCobrar), r.sinPagar ? `${r.sinPagar} ${r.sinPagar === 1 ? "pedido entregado sin pagar" : "pedidos entregados sin pagar"}` : "todo al día", false, r.porCobrar > 0)}
      </section>

      {/* Gráficos del mes */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Panel titulo="Vendido por día" nota="sin IVA, entregado">
          {r.neto > 0 ? <Barras etiquetas={etiquetas} series={[{ nombre: "Vendido", color: "#026433", valores: porDia((x) => x.neto) }]} formato={corto} alto={170} valoresSiempre /> : <SinDatos texto={`${nombre} todavía no vendió en ${nombreMes(mes).split(" ")[0]}.`} />}
        </Panel>
        <Panel titulo="Unidades por día" nota="entregadas">
          {r.unidades > 0 ? <Barras etiquetas={etiquetas} series={[{ nombre: "Unidades", color: "#3b6ea5", valores: porDia((x) => x.unidades) }]} formato={num} alto={170} valoresSiempre /> : <SinDatos texto="Sin unidades entregadas en este mes." />}
        </Panel>
        <Panel titulo="A quién le vendió" nota="top 8, sin IVA">
          {top.length > 0 ? <BarrasH filas={top.map((c) => ({ nombre: c.nombre, valor: c.neto, extra: `${c.pedidos} ${c.pedidos === 1 ? "pedido" : "pedidos"}` }))} formato={(n) => formatoPesos(Math.round(n))} /> : <SinDatos texto="Todavía no hay clientes con entregas." />}
        </Panel>
      </section>

      {/* Cada pedido como una cuenta corriente: cuándo se cargó, cuándo se entregó, si se pagó */}
      <section className="overflow-hidden rounded-xl border border-stone-300 bg-white">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-200 px-4 py-3">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.12em] text-stone-600">Pedidos de {nombreMes(mes)}</h2>
          <span className="text-[12px] text-stone-500">{ordenadas.length} {ordenadas.length === 1 ? "pedido" : "pedidos"}</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-center text-[13px]">
            <thead className="bg-stone-100 text-[11px] uppercase tracking-wide text-stone-600">
              <tr>
                <th className="px-2 py-2 font-semibold">Cargado</th>
                <th className="px-2 py-2 font-semibold">Entregado</th>
                <th className="px-2 py-2 text-left font-semibold">Cliente</th>
                <th className="px-2 py-2 text-left font-semibold">Pedido</th>
                <th className="px-2 py-2 font-semibold">Comprobante</th>
                <th className="px-2 py-2 font-semibold">Monto</th>
                {comision && <th className="px-2 py-2 font-semibold">Comisión</th>}
                <th className="px-2 py-2 font-semibold">Estado</th>
                <th className="px-2 py-2 font-semibold">Pago</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((x) => (
                <tr key={x.id} className="border-t border-stone-200">
                  <td className="px-2 py-2.5 tabular-nums">{fecha(x.cargado)}</td>
                  <td className="px-2 py-2.5 tabular-nums">{x.estado === "ENTREGADO" ? fecha(x.entrega) : <span className="text-stone-300">—</span>}</td>
                  <td className="px-2 py-2.5 text-left"><div className="font-semibold">{x.cliente}</div>{x.barrio && <div className="text-[12px] text-stone-500">{x.barrio}</div>}</td>
                  <td className="px-2 py-2.5 text-left">{x.items.map((i, k) => <div key={k}><b>{i.cantidad}</b> {i.nombre}</div>)}</td>
                  <td className="px-2 py-2.5 font-medium tabular-nums">{x.comprobante ?? <span className="text-stone-300">—</span>}</td>
                  <td className="px-2 py-2.5 font-semibold tabular-nums">{formatoPesos(x.total)}</td>
                  {comision && <td className="px-2 py-2.5 tabular-nums">{x.estado === "ENTREGADO" ? formatoPesos((x.neto * pct) / 100) : <span className="text-stone-300">—</span>}</td>}
                  <td className="px-2 py-2.5"><span className={`${pastilla} ${PASTILLA_ESTADO[x.estado]}`}>{ESTADOS[x.estado]}</span></td>
                  <td className="px-2 py-2.5">
                    {x.pagado ? <span className={`${pastilla} bg-verde-50 text-verde-700`}>Pagado{x.medio ? ` · ${MEDIOS[x.medio] ?? ""}` : ""}</span>
                      : x.estado === "ENTREGADO" ? <span className={`${pastilla} bg-rojo-50 text-rojo-700`}>{x.aCuenta ? "Cuenta corriente" : "Sin pagar"}</span>
                      : <span className="text-stone-400">{x.estado === "NO_ENTREGADO" ? "—" : "Sin entregar"}</span>}
                  </td>
                </tr>
              ))}
              {ordenadas.length === 0 && <tr><td colSpan={comision ? 9 : 8} className="px-4 py-12 text-stone-500">No hay pedidos en este mes.</td></tr>}
            </tbody>
            {ordenadas.length > 0 && (
              <tfoot className="border-t-2 border-stone-300 bg-stone-50 text-[13px] font-bold">
                <tr>
                  <td colSpan={5} className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide text-stone-600">Total entregado</td>
                  <td className="px-2 py-2.5 tabular-nums">{formatoPesos(totalMonto)}</td>
                  {comision && <td className="px-2 py-2.5 tabular-nums">{formatoPesos(r.comision)}</td>}
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
