import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { diasDeAtraso, incluirNc, partidaDe } from "@/lib/cobranza";
import { db } from "@/lib/db";
import { deFecha, hoy } from "@/lib/fechas";
import { cargarFacturas } from "@/lib/facturas";
import { formatoRemito } from "@/lib/remito";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { CONTENEDOR_TABLA, Resumen } from "../estilo";
import { filaDeArca, filaDeRemito } from "../filas";
import { ListaComprobantes } from "../ListaComprobantes";
import { AnularNota } from "./AnularNota";
import { BotonVolver } from "@/components/BotonVolver";

const fechaCorta = (s: string) => `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}`;

// Cuenta de un cliente: la MISMA hoja que Facturas y Remitos (facturas y notas de crédito de ARCA + remitos), filtrada a este cliente.
export default async function CuentaDeCliente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const cliente = await db.cliente.findUnique({ where: { id } });
  if (!cliente) notFound();
  const hoyStr = hoy();

  const [pedidosRemito, notas, facturas] = await Promise.all([
    db.pedido.findMany({
      where: { clienteId: id, conFactura: false, OR: [{ estado: { in: ["PENDIENTE", "ENTREGADO"] } }, { remitoNumero: { not: null } }] },
      include: { items: true, ...incluirNc },
      orderBy: [{ creadoEn: "asc" }],
    }),
    db.notaCredito.findMany({ where: { clienteId: id }, include: { aplicaciones: { include: { pedido: true } } }, orderBy: { fecha: "desc" }, take: 30 }),
    cargarFacturas(),
  ]);

  const filasArca = facturas.filas.filter((f) => f.clienteId === id).map((f) => filaDeArca(f, facturas.puntosDeCuit(f.cuit)));
  const filasRemito = pedidosRemito.map((p) => filaDeRemito(p, cliente, hoyStr));
  const filas = [...filasArca, ...filasRemito].sort((a, b) => a.cargado.localeCompare(b.cargado) || (a.numero ?? "").localeCompare(b.numero ?? ""));

  const pendientes = filas.filter((f) => !f.esNc && !f.pagada && !f.cubierta && !f.anulado);
  const total = pendientes.reduce((s, f) => s + f.monto, 0);
  const porEntregar = pendientes.filter((f) => !f.entregado).reduce((s, f) => s + f.monto, 0);
  const vencido = pendientes.filter((f) => f.entregado && f.atraso > 0).reduce((s, f) => s + f.monto, 0);
  const vigentes = notas.filter((n) => !n.anuladaEn);
  const aFavor = vigentes.reduce((t, n) => t + Number(n.monto) - n.aplicaciones.reduce((u, a) => u + Number(a.monto), 0), 0)
    + filasArca.filter((f) => f.esNc).reduce((t, f) => t + (f.saldo ?? 0), 0);
  void partidaDe; void diasDeAtraso;

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cuenta</h1>
            <p className="mt-2 text-lg font-semibold">{cliente.nombre}{cliente.cuit ? <span className="ml-3 text-sm font-normal text-stone-500">CUIT {cliente.cuit}</span> : null}</p>
            {cliente.observacion && <p className="mt-2 max-w-3xl whitespace-pre-line rounded-md border border-rojo-200 bg-rojo-50 px-3 py-1.5 text-sm font-medium text-rojo-800"><span className="mr-1.5 font-bold uppercase">Importante:</span>{cliente.observacion}</p>}
          </div>
          <div className="flex gap-2 text-sm">
            <Link href={`/cuentas/${id}/nc`} className="rounded-md bg-verde-700 px-3 py-2 font-semibold text-white shadow-sm hover:bg-verde-800">+ Nota de crédito</Link>
            <Link href={`/clientes/${id}/cuenta`} className="rounded-md border border-stone-400 bg-white px-3 py-2 font-medium shadow-sm hover:bg-crema-100">Movimientos</Link>
            <BotonVolver fallback="/cuentas/clientes" />
          </div>
        </div>

        <Resumen datos={[
          { titulo: "Deuda total", valor: formatoPesos(total) },
          { titulo: "Por entregar", valor: formatoPesos(porEntregar) },
          { titulo: "Vencido", valor: formatoPesos(vencido), rojo: vencido > 0 },
          { titulo: "Sin pagar", valor: pendientes.length },
          { titulo: "Saldo a favor (NC)", valor: formatoPesos(aFavor) },
        ]} />

        <section className={CONTENEDOR_TABLA} aria-label="Comprobantes del cliente">
          <ListaComprobantes filas={filas} tipo="CUENTA" />
        </section>

        {notas.length > 0 && (
          <section aria-label="Notas de crédito (de remitos)">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-700">Notas de crédito de remitos</h2>
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


      </main>
    </>
  );
}
