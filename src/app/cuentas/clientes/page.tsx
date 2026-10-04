import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { diasDeAtraso, incluirNc, partidaDe } from "@/lib/cobranza";
import { db } from "@/lib/db";
import { hoy } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { BarraFiltros, CABECERA_TABLA, CONTENEDOR_TABLA, FILA_TABLA, Resumen } from "../estilo";
import { EncabezadoCuenta } from "../EncabezadoCuenta";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";

const COLUMNAS = "sm:grid-cols-[minmax(180px,2fr)_110px_130px_130px_140px_110px_90px]";

// CUENTA: a quién hay que cobrarle. Cada comprobante (factura o remito) entregado y sin pagar es una partida.
export default async function Cuentas({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const usuario = await exigirOficina();
  const { q = "" } = await searchParams;
  const hoyStr = hoy();
  const inicioMes = new Date(`${hoyStr.slice(0, 7)}-01T00:00:00Z`);

  const [abiertos, pagosMes] = await Promise.all([
    db.pedido.findMany({ where: { clienteId: { not: null }, estado: { in: ["PENDIENTE", "ENTREGADO"] }, pagado: false }, include: { items: true, cliente: true, ...incluirNc } }),
    db.movimientoCuenta.aggregate({ where: { tipo: { in: ["PAGO", "ANULACION_PAGO"] }, fecha: { gte: inicioMes } }, _sum: { monto: true } }),
  ]);

  type Fila = { id: string; nombre: string; comprobantes: number; porEntregar: number; vencido: number; total: number; masViejo: number };
  const porCliente = new Map<string, Fila>();
  for (const p of abiertos) {
    if (!p.cliente) continue;
    const partida = partidaDe(p, p.cliente.condicionPago);
    if (partida.cubierta) continue; // una nota de crédito lo cubre entero
    const atraso = partida.entregado ? diasDeAtraso(partida.vence, hoyStr) : 0; // lo que todavía no se entregó no está vencido
    const f = porCliente.get(p.cliente.id) ?? { id: p.cliente.id, nombre: p.cliente.nombre, comprobantes: 0, porEntregar: 0, vencido: 0, total: 0, masViejo: 0 };
    f.comprobantes += 1;
    f.total += partida.monto;
    if (!partida.entregado) f.porEntregar += partida.monto;
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
  const totalPorEntregar = [...porCliente.values()].reduce((s, f) => s + f.porEntregar, 0);
  const totalVencido = [...porCliente.values()].reduce((s, f) => s + f.vencido, 0);
  const cobradoMes = Math.max(0, -Number(pagosMes._sum.monto ?? 0));

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoCuenta activa="clientes" />

        <Resumen datos={[
          { titulo: "Deuda total", valor: formatoPesos(totalACobrar) },
          { titulo: "Por entregar", valor: formatoPesos(totalPorEntregar) },
          { titulo: "Vencido", valor: formatoPesos(totalVencido), rojo: totalVencido > 0 },
          { titulo: "Cobrado este mes", valor: formatoPesos(cobradoMes) },
        ]} />

        <BarraFiltros q={q} placeholder="Buscar cliente…" derecha={`${filas.length} ${filas.length === 1 ? "cliente" : "clientes"} con comprobantes sin pagar`} />

        <section className={CONTENEDOR_TABLA} aria-label="Clientes con deuda">
          <div className={`hidden sm:grid ${CABECERA_TABLA} ${COLUMNAS}`}>
            {["Cliente", "Comprobantes", "Por entregar", "Vencido", "Deuda total", "Más viejo", ""].map((h, i) => <span key={i} className={i === 0 ? "" : i === 4 ? "text-right" : "text-center"}>{h}</span>)}
          </div>
          {filas.length === 0 ? (
            <p className="p-8 text-center text-sm text-stone-500">{q ? "No hay clientes que coincidan." : "No hay comprobantes sin pagar. Todo cobrado."}</p>
          ) : (
            <ul>
              {filas.map((f) => (
                <li key={f.id} className={`gap-y-1 sm:grid ${FILA_TABLA} ${COLUMNAS}`}>
                  <Link href={`/cuentas/${f.id}`} className="truncate font-semibold hover:underline">{f.nombre}</Link>
                  <span className="text-center tabular-nums">{f.comprobantes}</span>
                  <span className="text-center tabular-nums">{f.porEntregar > 0 ? formatoPesos(f.porEntregar) : <span className="text-stone-300">—</span>}</span>
                  <span className={`text-center font-semibold tabular-nums ${f.vencido > 0 ? "text-rojo-700" : "text-stone-300"}`}>{f.vencido > 0 ? formatoPesos(f.vencido) : "—"}</span>
                  <span className="text-right text-[14px] font-bold tabular-nums">{formatoPesos(f.total)}</span>
                  <span className={`text-center tabular-nums ${f.masViejo > 0 ? "text-rojo-700" : "text-stone-300"}`}>{f.masViejo > 0 ? `${f.masViejo} ${f.masViejo === 1 ? "día" : "días"}` : "—"}</span>
                  <Link href={`/cuentas/${f.id}`} className="text-center text-[12.5px] font-semibold text-verde-800 underline-offset-4 hover:underline">Abrir ›</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
