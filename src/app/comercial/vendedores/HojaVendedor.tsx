import { formatoPesos } from "@/lib/numeros";
import { num } from "@/lib/ruta";
import { type FilaVendedor, nombreMes, resumenDe } from "@/lib/vendedores";
import { SinDatos } from "../estadisticas/Graficos";
import { TablaPedidosVendedor } from "./TablaPedidosVendedor";

// La hoja de un vendedor: cómo viene el mes (resumen ordenado), sus 5 mejores clientes, dos gráficos y cada pedido como una cuenta corriente.
// La usan la ficha de Comercial → Vendedores y la pantalla del propio vendedor.

const variacion = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

function Tendencia({ ahora, antes }: { ahora: number; antes: number }) {
  const v = variacion(ahora, antes);
  if (v === null) return <>mes anterior sin ventas</>;
  return <span className={`font-semibold ${v >= 0 ? "text-verde-700" : "text-rojo-700"}`}>{v >= 0 ? "▲" : "▼"} {Math.abs(v)}% vs mes anterior</span>;
}

export function HojaVendedor({ nombre, pct, mes, filas, anteriores, comision = true, modo = "oficina", conTabla = true }: {
  nombre: string; pct: number; mes: string; filas: FilaVendedor[]; anteriores: FilaVendedor[]; comision?: boolean; modo?: "oficina" | "vendedor"; conTabla?: boolean;
}) {
  const r = resumenDe(filas, pct);
  const ant = resumenDe(anteriores, pct);
  const ent = filas.filter((x) => x.estado === "ENTREGADO");
  const avisos = filas.filter((x) => x.avisadoPor && !x.pagado).length;

  const porCliente = new Map<string, { nombre: string; neto: number; pedidos: number; unidades: number }>();
  for (const x of ent) {
    const c = porCliente.get(x.clienteId) ?? { nombre: x.cliente, neto: 0, pedidos: 0, unidades: 0 };
    c.neto += x.neto; c.pedidos += 1; c.unidades += x.unidades; porCliente.set(x.clienteId, c);
  }
  const top = [...porCliente.values()].sort((a, b) => b.neto - a.neto).slice(0, 5);

  const celdas: { t: string; v: string; d: React.ReactNode; rojo?: boolean }[] = [
    { t: "Facturó", v: formatoPesos(r.neto), d: <Tendencia ahora={r.neto} antes={ant.neto} /> },
    ...(comision ? [{ t: "Comisión", v: formatoPesos(r.comision), d: pct ? `${String(pct).replace(".", ",")}% de lo facturado` : "sin % cargado" }] : []),
    { t: "Unidades", v: num(r.unidades), d: <Tendencia ahora={r.unidades} antes={ant.unidades} /> },
    { t: "Pedidos", v: String(r.pedidos), d: `${r.entregados} entregados · ${r.porEntregar} por entregar` },
    { t: "Por cobrar", v: formatoPesos(r.porCobrar), d: r.sinPagar ? `${r.sinPagar} ${r.sinPagar === 1 ? "pedido" : "pedidos"} sin pagar` : "todo al día", rojo: r.porCobrar > 0 },
  ];

  return (
    <div className="space-y-4">
      {/* Resumen del mes: todas las celdas del mismo tamaño y en el mismo orden */}
      <section aria-label={`Resumen de ${nombreMes(mes)}`} className={`grid grid-cols-2 divide-x divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-300 bg-white lg:divide-y-0 ${celdas.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        {celdas.map((c) => (
          <div key={c.t} className="px-5 py-3.5">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">{c.t}</div>
            <div className={`mt-1 text-[22px] font-bold leading-tight tabular-nums ${c.rojo ? "text-rojo-700" : "text-stone-900"}`}>{c.v}</div>
            <div className="mt-0.5 truncate text-[12px] text-stone-500">{c.d}</div>
          </div>
        ))}
      </section>
      {avisos > 0 && modo === "oficina" && <p className="rounded-lg border border-[#e6d9a6] bg-[#fdf8e3] px-4 py-2 text-[13px] font-medium text-[#8a6a05]">{nombre} avisó que se {avisos === 1 ? "pagó 1 pedido" : `pagaron ${avisos} pedidos`}: falta confirmarlo en Cuenta corriente.</p>}

      {/* Top 5 de clientes, en horizontal */}
      <section className="rounded-xl border border-stone-300 bg-white p-4">
        <header className="mb-3 flex items-baseline justify-between gap-3 border-b border-stone-200 pb-2">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.12em] text-stone-600">Top 5 · clientes a los que más vendió</h2>
          <span className="text-[11.5px] text-stone-400">{nombreMes(mes)} · sin IVA</span>
        </header>
        {top.length > 0 ? (
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {top.map((c, i) => (
              <li key={c.nombre + i} className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-800 text-[12px] font-bold text-white">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-stone-800" title={c.nombre}>{c.nombre}</span>
                </div>
                <div className="mt-2 text-[20px] font-bold tabular-nums text-stone-900">{formatoPesos(c.neto)}</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-stone-200"><div className="h-1.5 rounded-full bg-verde-700" style={{ width: `${r.neto > 0 ? Math.max(3, (c.neto / r.neto) * 100) : 0}%` }} /></div>
                <div className="mt-1.5 flex justify-between text-[12px] text-stone-500"><span>{r.neto > 0 ? Math.round((c.neto / r.neto) * 100) : 0}% de lo facturado</span><span>{num(c.unidades)} un. · {c.pedidos} {c.pedidos === 1 ? "ped." : "ped."}</span></div>
              </li>
            ))}
          </ol>
        ) : <SinDatos texto="Todavía no hay clientes con entregas en este mes." />}
      </section>

      {conTabla && <TablaPedidosVendedor filas={filas} pct={pct} comision={comision} modo={modo} />}
    </div>
  );
}
