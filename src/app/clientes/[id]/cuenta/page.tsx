import { titulo } from "@/lib/mayusculas";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { LibroCuenta, columnasDeMovimiento } from "@/components/LibroCuenta";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { formatoPesos } from "@/lib/numeros";
import { formatoRemito } from "@/lib/remito";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../../../pedidos/Encabezado";

const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });
const MEDIO: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE: "Cheque", MERCADO_PAGO: "Mercado Pago", OTRO: "Otro" };

export default async function CuentaCorriente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const cliente = await db.cliente.findUnique({ where: { id } });
  if (!cliente) notFound();

  const [movimientos, abiertos] = await Promise.all([
    db.movimientoCuenta.findMany({ where: { clienteId: id }, orderBy: [{ fecha: "asc" }, { id: "asc" }], include: { pedido: { include: { punto: true } } } }),
    db.pedido.findMany({ where: { clienteId: id, estado: "PENDIENTE" }, include: { items: true } }),
  ]);

  const total = Math.round(movimientos.reduce((s, m) => s + Number(m.monto), 0) * 100) / 100;
  const porEntregar = abiertos.reduce((s, p) => s + importeVigente(p.items, Number(p.ivaPct), "PENDIENTE"), 0);
  const entregado = Math.round((total - porEntregar) * 100) / 100;

  const celda = (titulo: string, valor: React.ReactNode, ayuda: string) => (
    <div className="min-w-0">
      <p className="border-b border-stone-300 bg-crema-100 px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">{titulo}</p>
      <p className="px-3 pt-2 text-center text-lg font-bold tabular-nums">{valor}</p>
      <p className="px-3 pb-2 text-center text-xs text-stone-500">{ayuda}</p>
    </div>
  );

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cuenta corriente</h1>
            <p className="mt-1 text-sm text-stone-600">{cliente.nombre}</p>
          </div>
          <Link href={`/clientes/${id}`} className="rounded-md border border-stone-400 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-crema-100">← {cliente.nombre}</Link>
        </div>

        <section className="grid grid-cols-1 divide-y divide-stone-300 overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0" aria-label="Saldo">
          {celda("Saldo total", <span className={total > 0 ? "text-rojo-700" : ""}>{formatoPesos(total)}</span>, total > 0 ? "Lo que debe el cliente" : total < 0 ? "Saldo a favor del cliente" : "Al día")}
          {celda("Entregado", formatoPesos(entregado), "Ya recibió la mercadería")}
          {celda("Por entregar", formatoPesos(porEntregar), `${abiertos.length} ${abiertos.length === 1 ? "pedido" : "pedidos"} todavía sin entregar`)}
        </section>

        <LibroCuenta
          vacio="Este cliente todavía no tiene movimientos."
          lineas={movimientos.map((m) => ({
            id: m.id,
            fecha: formatoFecha.format(m.fecha),
            detalle: (
              <div className="leading-snug">
                <p className="font-medium">{m.nota}{m.medio ? ` · ${MEDIO[m.medio]}` : ""}</p>
                {m.pedido && (
                  <p className="text-xs text-stone-600">
                    {m.pedido.conFactura ? (
                      m.pedido.numeroFactura ? <>Factura <b>{m.pedido.numeroFactura}</b></> : <span className="text-rojo-700">Factura sin número</span>
                    ) : m.pedido.remitoNumero ? (
                      <>Remito <b>{formatoRemito(m.pedido.remitoNumero)}</b></>
                    ) : (
                      <span className="text-rojo-700">Remito sin emitir</span>
                    )}
                    {" · "}{m.pedido.punto?.alias ?? titulo(m.pedido.punto?.direccion)}
                    {" · "}<Link href={`/pedidos/${m.pedidoId}`} className="underline">ver pedido</Link>
                  </p>
                )}
              </div>
            ),
            ...columnasDeMovimiento(m.tipo, Number(m.monto)),
          }))}
        />
      </main>
    </>
  );
}
