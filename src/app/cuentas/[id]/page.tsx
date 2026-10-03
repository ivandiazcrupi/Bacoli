import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { diasDeAtraso, incluirNc, partidaDe } from "@/lib/cobranza";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { deFecha, hoy } from "@/lib/fechas";
import { formatoRemito } from "@/lib/remito";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { AnularNota } from "./AnularNota";
import { DeshacerPago } from "./DeshacerPago";
import { PagarPartidas } from "./PagarPartidas";

const MEDIO: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE: "Cheque", MERCADO_PAGO: "Mercado Pago", OTRO: "Otro" };
const fechaCorta = (s: string) => `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}`;

export default async function CuentaDeCliente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const cliente = await db.cliente.findUnique({ where: { id } });
  if (!cliente) notFound();
  const hoyStr = hoy();

  const [abiertos, pagados, fuera, notas] = await Promise.all([
    db.pedido.findMany({ where: { clienteId: id, estado: { in: ["PENDIENTE", "ENTREGADO"] }, pagado: false }, include: { items: true, ...incluirNc }, orderBy: [{ fechaEntrega: "asc" }, { creadoEn: "asc" }] }),
    db.pedido.findMany({ where: { clienteId: id, estado: "ENTREGADO", pagado: true, cobro: "COBRADO" }, include: { items: true, ...incluirNc }, orderBy: [{ fechaEntrega: "desc" }], take: 30 }),
    db.pedido.findMany({ where: { clienteId: id, estado: { in: ["NO_ENTREGADO", "CANCELADO"] } }, include: { items: true, ...incluirNc }, orderBy: [{ creadoEn: "desc" }], take: 15 }),
    db.notaCredito.findMany({ where: { clienteId: id }, include: { aplicaciones: { include: { pedido: true } } }, orderBy: { fecha: "desc" }, take: 30 }),
  ]);
  const partidas = abiertos.map((p) => partidaDe(p, cliente.condicionPago)).filter((p) => !p.cubierta);
  const total = partidas.reduce((s, p) => s + p.monto, 0);
  const porEntregar = partidas.filter((p) => !p.entregado).reduce((s, p) => s + p.monto, 0);
  const vencido = partidas.filter((p) => p.entregado && diasDeAtraso(p.vence, hoyStr) > 0).reduce((s, p) => s + p.monto, 0);

  const vigentes = notas.filter((n) => !n.anuladaEn);
  const aFavor = vigentes.reduce((t, n) => t + Number(n.monto) - n.aplicaciones.reduce((u, a) => u + Number(a.monto), 0), 0);
  const celda = (titulo: string, valor: React.ReactNode, clase = "") => (
    <div className="min-w-0">
      <p className="border-b border-stone-300 bg-crema-100 px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">{titulo}</p>
      <p className={`px-3 py-3 text-center text-xl font-bold tabular-nums ${clase}`}>{valor}</p>
    </div>
  );

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cuenta</h1>
            <p className="mt-2 text-lg font-semibold">{cliente.nombre}</p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link href={`/cuentas/${id}/nc`} className="rounded-md bg-verde-700 px-3 py-2 font-semibold text-white shadow-sm hover:bg-verde-800">+ Nota de crédito</Link>
            <Link href={`/clientes/${id}/cuenta`} className="rounded-md border border-stone-400 bg-white px-3 py-2 font-medium shadow-sm hover:bg-crema-100">Movimientos</Link>
            <Link href="/cuentas/clientes" className="rounded-md border border-stone-400 bg-white px-3 py-2 font-medium shadow-sm hover:bg-crema-100">← Cuenta</Link>
          </div>
        </div>

        <section aria-label="Resumen" className="grid grid-cols-1 divide-y divide-stone-300 overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm sm:grid-cols-5 sm:divide-x sm:divide-y-0">
          {celda("Deuda total", formatoPesos(total))}
          {celda("Por entregar", formatoPesos(porEntregar))}
          {celda("Vencido", formatoPesos(vencido), vencido > 0 ? "text-rojo-700" : "")}
          {celda("Comprobantes sin pagar", partidas.length)}
          {celda("Saldo a favor (NC)", formatoPesos(aFavor), aFavor > 0 ? "text-verde-800" : "")}
        </section>

        <section className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm" aria-label="Comprobantes sin pagar">
          <PagarPartidas
            filas={partidas.map((p) => ({ id: p.id, cargado: p.cargado, fecha: p.fecha, entregado: p.entregado, tipo: p.tipo, numero: p.numero, monto: p.monto, vence: p.vence, atraso: diasDeAtraso(p.vence, hoyStr) }))}
          />
        </section>

        {notas.length > 0 && (
          <section aria-label="Notas de crédito">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-700">Notas de crédito</h2>
            <ul className="divide-y divide-stone-300 overflow-hidden rounded-xl border border-stone-300 bg-white text-sm shadow-sm">
              {notas.map((n) => {
                const aplicado = n.aplicaciones.reduce((t, a) => t + Number(a.monto), 0);
                const restante = Number(n.monto) - aplicado;
                return (
                  <li key={n.id} className={`grid grid-cols-[110px_150px_1fr_130px_200px] items-center gap-x-3 px-4 py-2.5 text-center ${n.anuladaEn ? "text-stone-400 line-through" : ""}`}>
                    <span className="tabular-nums">{fechaCorta(deFecha(n.fecha))}</span>
                    <span className="font-semibold">NC {n.numero ?? "s/n"}</span>
                    <span className="text-left">
                      {n.motivo}
                      <span className="block text-xs text-stone-500">{n.aplicaciones.length > 0 ? `Aplicada a ${n.aplicaciones.map((a) => `${a.pedido.conFactura ? "" : "R "}${a.pedido.conFactura ? a.pedido.numeroFactura ?? "factura" : a.pedido.remitoNumero ? formatoRemito(a.pedido.remitoNumero) : "remito"}`).join(", ")}` : "Sin aplicar"}</span>
                    </span>
                    <span className="font-bold tabular-nums">{formatoPesos(Number(n.monto))}</span>
                    <span className="flex items-center justify-center gap-2 no-underline">
                      {n.anuladaEn ? <span className="text-xs">Anulada</span> : (
                        <>
                          {restante > 0.004 && <Link href={`/cuentas/${id}/nc?nota=${n.id}`} className="text-xs font-semibold text-verde-800 underline">Aplicar {formatoPesos(restante)}</Link>}
                          <AnularNota notaId={n.id} />
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {fuera.length > 0 && (
          <section aria-label="Fuera de la cuenta">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-700">Fuera de la cuenta · no entregados y cancelados</h2>
            <ul className="divide-y divide-stone-300 overflow-hidden rounded-xl border border-stone-300 bg-white text-sm shadow-sm">
              {fuera.map((p) => {
                const x = partidaDe(p, cliente.condicionPago);
                return (
                  <li key={p.id} className="grid grid-cols-[110px_1fr_130px_170px] items-center gap-x-3 px-4 py-2.5 text-center text-stone-600">
                    <span className="tabular-nums">Cargado {fechaCorta(x.cargado)}</span>
                    <span>{p.conFactura ? "FACTURA" : "REMITO"} {x.numero ?? ""}</span>
                    <span className="tabular-nums line-through">{formatoPesos(importeVigente(p.items, Number(p.ivaPct), "PENDIENTE", p.webTotal))}</span>
                    <span className="font-semibold text-rojo-700">{p.estado === "CANCELADO" ? "Cancelado" : "No entregado"}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {pagados.length > 0 && (
          <section aria-label="Pagados">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-700">Pagados (últimos {pagados.length})</h2>
            <ul className="divide-y divide-stone-300 overflow-hidden rounded-xl border border-stone-300 bg-white text-sm shadow-sm">
              {pagados.map((p) => {
                const x = partidaDe(p, cliente.condicionPago);
                return (
                  <li key={p.id} className="grid grid-cols-[100px_1fr_130px_220px_80px] items-center gap-x-3 px-4 py-2.5 text-center">
                    <span className="tabular-nums">{fechaCorta(x.fecha)}</span>
                    <span className="font-semibold">{x.tipo === "FACTURA" ? "FACTURA" : "REMITO"} {x.numero ?? "sin número"}</span>
                    <span className="tabular-nums">{formatoPesos(x.monto)}</span>
                    <span className="font-semibold text-verde-800">Pagada · {MEDIO[x.medio ?? ""] ?? ""}</span>
                    <DeshacerPago pedidoId={p.id} />
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
