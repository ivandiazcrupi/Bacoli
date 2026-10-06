import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { aFecha, deFecha, diaMes, esFechaValida, nombreDia } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { bultosDe, porReparto, unidadesPorSabor } from "@/lib/ruta";
import { exigirOficina } from "@/lib/session";
import { titulo } from "@/lib/mayusculas";
import { BarraImpresion } from "../../../remito/BarraImpresion";
import { aFila, clientesConDeuda, incluirPedido } from "../../../filas";

// Hoja de ruta para el repartidor: una hoja A4 HORIZONTAL por camioneta, con el recorrido en orden y todo el dato bien legible.
// ?salida=ID imprime solo esa camioneta; sin eso, imprime todas las del día.
export default async function ImprimirHojaDeRuta({ params, searchParams }: { params: Promise<{ fecha: string }>; searchParams: Promise<{ salida?: string }> }) {
  await exigirOficina();
  const { fecha } = await params;
  const { salida } = await searchParams;
  if (!esFechaValida(fecha)) notFound();

  const [pedidos, salidas] = await Promise.all([
    db.pedido.findMany({ where: { fechaEntrega: aFecha(fecha), estado: { not: "CANCELADO" }, salidaId: salida ? salida : { not: null } }, include: { ...incluirPedido, salida: true } }),
    db.salida.findMany({ where: { fecha: aFecha(fecha), ...(salida ? { id: salida } : {}) }, include: { vehiculo: true }, orderBy: { orden: "asc" } }),
  ]);
  pedidos.sort(porReparto);
  const debe = await clientesConDeuda(pedidos.flatMap((p) => (p.clienteId ? [p.clienteId] : [])));
  const filas = pedidos.map((p) => aFila(p, debe));
  const f = deFecha(aFecha(fecha));
  const textoFecha = `${nombreDia(f)} ${diaMes(f)}`;

  return (
    <div className="bg-stone-200 print:bg-white">
      <style>{"@page { size: A4 landscape; margin: 11mm 12mm } @media print { html { font-size: 14px !important } body { background: #fff !important; padding-bottom: 0 !important } }"}</style>
      <BarraImpresion volver={`/pedidos/dia/${fecha}`} textoVolver="Volver a la hoja de ruta" />
      {salidas.length === 0 ? (
        <p className="p-10">No hay camionetas con pedidos para imprimir en este día.</p>
      ) : (
        <div className="space-y-6 py-6 print:space-y-0 print:py-0">
          {salidas.filter((sa) => salida || pedidos.some((p) => p.salidaId === sa.id)).map((sa) => {
            const grupo = filas.filter((x) => pedidos.find((p) => p.id === x.id)?.salidaId === sa.id);
            const paquetes = pedidos.filter((p) => p.salidaId === sa.id).reduce((s, p) => s + bultosDe(p.items), 0);
            const sabores = pedidos.filter((p) => p.salidaId === sa.id).reduce((t, p) => { const x = unidadesPorSabor(p.items); return { tomate: t.tomate + x.tomate, cebolla: t.cebolla + x.cebolla }; }, { tomate: 0, cebolla: 0 });
            return (
              <section key={sa.id} className="mx-auto w-[277mm] bg-white p-[8mm] font-[Helvetica,Arial,sans-serif] text-neutral-900 shadow print:w-full print:p-0 print:shadow-none [&:not(:last-child)]:break-after-page">
                <header className="mb-6 flex items-end justify-between border-b border-neutral-900 pb-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-neutral-500">Bacoli · Hoja de ruta</p>
                    <h1 className="mt-1 text-[30px] font-bold leading-none tracking-tight">{titulo(sa.vehiculo.nombre)}{sa.vehiculo.patente ? <span className="ml-3 align-middle text-[14px] font-medium tracking-[0.18em] text-neutral-500">{sa.vehiculo.patente}</span> : null}</h1>
                  </div>
                  <div className="flex items-end gap-10">
                    <dl className="flex gap-7 text-right">
                      <div>
                        <dt className="text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Paquetes</dt>
                        <dd className="mt-1 text-[24px] font-bold leading-none tabular-nums">{paquetes}</dd>
                      </div>
                      <div>
                        <dt className="text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Unidades</dt>
                        <dd className="mt-1 text-[24px] font-bold leading-none tabular-nums">{sabores.tomate + sabores.cebolla}</dd>
                      </div>
                      <div>
                        <dt className="text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Tomate</dt>
                        <dd className="mt-1 text-[24px] font-bold leading-none tabular-nums">{sabores.tomate}</dd>
                      </div>
                      <div>
                        <dt className="text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Cebolla</dt>
                        <dd className="mt-1 text-[24px] font-bold leading-none tabular-nums">{sabores.cebolla}</dd>
                      </div>
                    </dl>
                    <p className="border-l border-neutral-300 pl-10 text-[24px] font-semibold leading-none tracking-tight">{textoFecha}</p>
                  </div>
                </header>

                <table className="w-full table-fixed border-collapse text-[13px] leading-snug">
                  <colgroup>{["11mm", "23mm", "40mm", "53mm", "29mm", "56mm", "24mm", "28mm", "13mm"].map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
                  <thead>
                    <tr className="text-left text-[9.5px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      {["", "Barrio", "Cliente", "Dirección", "Teléfono", "Pedido", "Comprobante", "Monto", "OK"].map((h, i) => (
                        <th key={h || "n"} className={`border-b border-neutral-300 px-2 pb-2 font-semibold ${i === 7 ? "text-right" : i === 8 ? "text-center" : ""}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.map((x, n) => (
                      <tr key={x.id} className="break-inside-avoid border-b border-neutral-300 align-top">
                        <td className="px-2 py-3.5"><span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-neutral-900 text-[13px] font-bold tabular-nums">{n + 1}</span></td>
                        <td className="px-2 py-4 text-[10.5px] font-semibold uppercase leading-tight tracking-wide text-neutral-600">{x.barrio}</td>
                        <td className="px-2 py-4 text-[14px] font-bold uppercase leading-tight">{x.cliente}</td>
                        <td className="px-2 py-4 text-[13.5px] font-medium leading-tight">
                          {x.direccion}
                          {x.comentario && <span className="mt-1.5 block text-[11.5px] font-semibold leading-snug text-neutral-700"><span className="mr-1 inline-block rounded-sm border border-neutral-700 px-1 text-[9px] uppercase tracking-wider">Nota</span>{x.comentario}</span>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-4 text-[13px] font-medium tabular-nums">{x.telefono || "—"}</td>
                        <td className="px-2 py-4">
                          {x.cobranza && <div className="text-[13px] font-extrabold uppercase tracking-[0.14em]">Cobrar</div>}
                          {x.items.map((i, k) => (
                            <div key={k} className="flex gap-2.5 text-[13px] leading-snug"><span className="w-6 shrink-0 text-right text-[14px] font-bold tabular-nums">{i.cantidad}</span><span className="font-medium">{i.nombre}</span></div>
                          ))}
                        </td>
                        <td className="px-2 py-4 leading-tight">
                          {x.cobranza ? <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">Cobranza</span> : x.webOrden ? <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">Tienda</span> : <>
                            <span className="block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{x.conFactura ? "Factura" : "Remito"}</span>
                            <span className="mt-0.5 block text-[13.5px] font-bold tabular-nums">{(x.conFactura ? x.numeroFactura : x.remito) || "—"}</span>
                          </>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-4 text-right text-[14px] font-bold tabular-nums">
                          {x.webOrden ? <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">Pagado</span> : formatoPesos(x.monto)}
                        </td>
                        <td className="px-2 py-4 text-center"><span className="inline-block h-[18px] w-[18px] rounded-[3px] border-[1.5px] border-neutral-900" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
