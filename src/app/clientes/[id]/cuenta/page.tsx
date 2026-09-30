import { titulo } from "@/lib/mayusculas";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { formatoPesos } from "@/lib/numeros";
import { formatoRemito } from "@/lib/remito";
import { exigirOficina } from "@/lib/session";

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

  // Saldo corrido: cada línea muestra cuánto debía el cliente después de ese movimiento.
  let acumulado = 0;
  const lineas = movimientos.map((m) => {
    acumulado = Math.round((acumulado + Number(m.monto)) * 100) / 100;
    return { ...m, saldo: acumulado };
  });
  const total = acumulado;
  const porEntregar = abiertos.reduce((s, p) => s + importeVigente(p.items, Number(p.ivaPct), "PENDIENTE"), 0);
  const entregado = Math.round((total - porEntregar) * 100) / 100;

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div>
          <Link href={`/clientes/${id}`} className="text-sm text-stone-600">← {cliente.nombre}</Link>
          <h1 className="text-2xl font-bold">Cuenta corriente</h1>
          <p className="text-stone-600">{cliente.nombre}</p>
        </div>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="Saldo">
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-sm text-stone-600">Saldo total</p>
            <p className={`text-2xl font-bold tabular-nums ${total > 0 ? "text-amber-800" : ""}`}>{formatoPesos(total)}</p>
            <p className="text-xs text-stone-500">{total > 0 ? "Lo que debe el cliente" : total < 0 ? "Saldo a favor del cliente" : "Al día"}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-sm text-stone-600">Entregado</p>
            <p className="text-2xl font-bold tabular-nums">{formatoPesos(entregado)}</p>
            <p className="text-xs text-stone-500">Ya recibió la mercadería</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-sm text-stone-600">Por entregar</p>
            <p className="text-2xl font-bold tabular-nums">{formatoPesos(porEntregar)}</p>
            <p className="text-xs text-stone-500">{abiertos.length} {abiertos.length === 1 ? "pedido" : "pedidos"} todavía sin entregar</p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">Movimientos</h2>
          {lineas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 p-4 text-stone-600">Este cliente todavía no tiene movimientos.</p>
          ) : (
            <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white text-sm">
              {[...lineas].reverse().map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {m.nota}{m.medio ? ` · ${MEDIO[m.medio]}` : ""}
                    </p>
                    {m.pedido && (
                      <p className="text-sm">
                        {m.pedido.conFactura ? (
                          m.pedido.numeroFactura ? <>Factura <b>{m.pedido.numeroFactura}</b></> : <span className="text-amber-800">Factura sin número</span>
                        ) : m.pedido.remitoNumero ? (
                          <>Remito <b>{formatoRemito(m.pedido.remitoNumero)}</b></>
                        ) : (
                          <span className="text-amber-800">Remito sin emitir</span>
                        )}
                        {m.pedido.conFactura && m.pedido.remitoNumero ? <> · Remito {formatoRemito(m.pedido.remitoNumero)}</> : null}
                        {" · "}<Link href={`/pedidos/${m.pedidoId}`} className="underline">ver pedido</Link>
                      </p>
                    )}
                    <p className="text-xs text-stone-500">{formatoFecha.format(m.fecha)}{m.pedido ? ` · ${m.pedido.punto.alias ?? titulo(m.pedido.punto.direccion)}` : ""}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className={`font-semibold ${Number(m.monto) < 0 ? "text-green-700" : ""}`}>{Number(m.monto) > 0 ? "+" : ""}{formatoPesos(Number(m.monto))}</p>
                    <p className="text-xs text-stone-500">saldo {formatoPesos(m.saldo)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
