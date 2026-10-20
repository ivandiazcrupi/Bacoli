import { hoy } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { filasDelPeriodo, mesSiguiente, nombreMes, resumenDe } from "@/lib/vendedores";

// Franja fija arriba de todas las pantallas del vendedor: lo facturado y la comisión, del mes y en total, sin tener que buscarlos.
export async function BandaTotales({ vendedor }: { vendedor: { id: string; comisionPct: unknown } | null }) {
  if (!vendedor) return null;
  const pct = Number(vendedor.comisionPct ?? 0);
  const mes = hoy().slice(0, 7);
  const todas = (await filasDelPeriodo("2000-01-01", "2100-01-01")).filter((x) => x.vendedorId === vendedor.id);
  const delMes = todas.filter((x) => x.f >= `${mes}-01` && x.f < `${mesSiguiente(mes)}-01`);
  const m = resumenDe(delMes, pct), t = resumenDe(todas, pct);
  const celda = (etiqueta: string, valor: string, grande = false) => (
    <div className="px-4 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{etiqueta}</div>
      <div className={`font-semibold tabular-nums ${grande ? "text-xl" : "text-base"}`}>{valor}</div>
    </div>
  );
  return (
    <section aria-label="Totales" className="grid grid-cols-2 divide-x divide-y divide-stone-200 rounded-lg border border-stone-300 bg-white sm:grid-cols-4 sm:divide-y-0">
      {celda(`Facturado ${nombreMes(mes)}`, formatoPesos(m.neto), true)}
      {celda(`Comisión ${nombreMes(mes)}`, formatoPesos(m.comision), true)}
      {celda("Facturado en total", formatoPesos(t.neto))}
      {celda("Comisión en total", formatoPesos(t.comision))}
    </section>
  );
}
