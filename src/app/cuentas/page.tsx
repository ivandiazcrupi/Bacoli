import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { cabeceraTabla } from "@/components/campos";
import { diasDeAtraso, partidaDe } from "@/lib/cobranza";
import { db } from "@/lib/db";
import { hoy } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../pedidos/Encabezado";

const COLUMNAS = "sm:grid-cols-[minmax(180px,2fr)_110px_130px_140px_120px_90px]";

// CUENTA: a quién hay que cobrarle. Cada comprobante (factura o remito) entregado y sin pagar es una partida.
export default async function Cuentas({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const usuario = await exigirOficina();
  const { q = "" } = await searchParams;
  const hoyStr = hoy();
  const inicioMes = new Date(`${hoyStr.slice(0, 7)}-01T00:00:00Z`);

  const [abiertos, pagosMes] = await Promise.all([
    db.pedido.findMany({ where: { clienteId: { not: null }, estado: "ENTREGADO", pagado: false }, include: { items: true, cliente: true } }),
    db.movimientoCuenta.aggregate({ where: { tipo: { in: ["PAGO", "ANULACION_PAGO"] }, fecha: { gte: inicioMes } }, _sum: { monto: true } }),
  ]);

  type Fila = { id: string; nombre: string; comprobantes: number; vencido: number; total: number; masViejo: number };
  const porCliente = new Map<string, Fila>();
  for (const p of abiertos) {
    if (!p.cliente) continue;
    const partida = partidaDe(p, p.cliente.condicionPago);
    const atraso = diasDeAtraso(partida.vence, hoyStr);
    const f = porCliente.get(p.cliente.id) ?? { id: p.cliente.id, nombre: p.cliente.nombre, comprobantes: 0, vencido: 0, total: 0, masViejo: 0 };
    f.comprobantes += 1;
    f.total += partida.monto;
    if (atraso > 0) {
      f.vencido += partida.monto;
      f.masViejo = Math.max(f.masViejo, atraso);
    }
    porCliente.set(p.cliente.id, f);
  }

  const palabras = q.toLowerCase().split(/\s+/).filter(Boolean);
  const filas = [...porCliente.values()]
    .filter((f) => palabras.every((w) => f.nombre.toLowerCase().includes(w)))
    .sort((a, b) => b.vencido - a.vencido || b.total - a.total);
  const totalACobrar = [...porCliente.values()].reduce((s, f) => s + f.total, 0);
  const totalVencido = [...porCliente.values()].reduce((s, f) => s + f.vencido, 0);
  const cobradoMes = Math.max(0, -Number(pagosMes._sum.monto ?? 0));

  const celda = (titulo: string, valor: string, clase = "") => (
    <div className="min-w-0">
      <p className="border-b border-stone-300 bg-crema-100 px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">{titulo}</p>
      <p className={`px-3 py-3 text-center text-xl font-bold tabular-nums ${clase}`}>{valor}</p>
    </div>
  );

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <h1 className="text-2xl font-bold tracking-tight">Cuenta</h1>

        <section aria-label="Resumen" className="grid grid-cols-1 divide-y divide-stone-300 overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {celda("A cobrar", formatoPesos(totalACobrar))}
          {celda("Vencido", formatoPesos(totalVencido), totalVencido > 0 ? "text-rojo-700" : "")}
          {celda("Cobrado este mes", formatoPesos(cobradoMes))}
        </section>

        <form className="flex flex-wrap items-center gap-2">
          <input name="q" defaultValue={q} placeholder="Buscar cliente…" className="h-10 w-full max-w-md rounded-md border border-stone-400 bg-white px-3 text-sm shadow-sm focus:border-verde-700 focus:outline-none" />
          <button className="h-10 rounded-md border border-stone-400 bg-white px-4 text-sm font-medium shadow-sm hover:border-verde-700">Buscar</button>
          <span className="ml-auto text-sm text-stone-600">{filas.length} {filas.length === 1 ? "cliente" : "clientes"} con comprobantes sin pagar</span>
        </form>

        <section className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm" aria-label="Clientes con deuda">
          <div className={`hidden gap-x-3 px-4 py-2.5 text-center sm:grid ${COLUMNAS} ${cabeceraTabla}`}>
            {["Cliente", "Comprobantes", "Vencido", "A cobrar", "Más viejo", ""].map((h, i) => <span key={i} className={i === 0 ? "text-left" : ""}>{h}</span>)}
          </div>
          {filas.length === 0 ? (
            <p className="p-8 text-center text-stone-600">{q ? "No hay clientes que coincidan." : "No hay comprobantes sin pagar. Todo cobrado."}</p>
          ) : (
            <ul className="divide-y divide-stone-300">
              {filas.map((f) => (
                <li key={f.id} className={`grid items-center gap-x-3 gap-y-1 px-4 py-3 text-center text-sm sm:grid ${COLUMNAS}`}>
                  <Link href={`/cuentas/${f.id}`} className="text-left font-semibold hover:underline">{f.nombre}</Link>
                  <span className="tabular-nums">{f.comprobantes}</span>
                  <span className={`font-semibold tabular-nums ${f.vencido > 0 ? "text-rojo-700" : "text-stone-400"}`}>{f.vencido > 0 ? formatoPesos(f.vencido) : "—"}</span>
                  <span className="font-bold tabular-nums">{formatoPesos(f.total)}</span>
                  <span className={`tabular-nums ${f.masViejo > 0 ? "text-rojo-700" : "text-stone-400"}`}>{f.masViejo > 0 ? `${f.masViejo} ${f.masViejo === 1 ? "día" : "días"}` : "—"}</span>
                  <Link href={`/cuentas/${f.id}`} className="font-semibold text-verde-800 underline-offset-4 hover:underline">Abrir ›</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
