import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { aFecha, deFecha, diaMes, esFechaValida, nombreDia } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { bultosDe, porReparto } from "@/lib/ruta";
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
      <style>{"@page { size: A4 landscape; margin: 9mm } @media print { html { font-size: 14px !important } body { background: #fff !important; padding-bottom: 0 !important } }"}</style>
      <BarraImpresion volver={`/pedidos/dia/${fecha}`} textoVolver="Volver a la hoja de ruta" />
      {salidas.length === 0 ? (
        <p className="p-10">No hay camionetas con pedidos para imprimir en este día.</p>
      ) : (
        <div className="space-y-6 py-6 print:space-y-0 print:py-0">
          {salidas.filter((sa) => salida || pedidos.some((p) => p.salidaId === sa.id)).map((sa) => {
            const grupo = filas.filter((x) => pedidos.find((p) => p.id === x.id)?.salidaId === sa.id);
            const paquetes = pedidos.filter((p) => p.salidaId === sa.id).reduce((s, p) => s + bultosDe(p.items), 0);
            return (
              <section key={sa.id} className="mx-auto w-[277mm] bg-white p-[6mm] text-black shadow print:w-full print:p-0 print:shadow-none [&:not(:last-child)]:break-after-page">
                <header className="mb-3 flex items-end justify-between border-b-2 border-black pb-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em]">BACOLI · Hoja de ruta</p>
                    <h1 className="text-[26px] font-extrabold uppercase leading-tight">{titulo(sa.vehiculo.nombre)}{sa.vehiculo.patente ? <span className="ml-3 text-[16px] font-semibold">{sa.vehiculo.patente}</span> : null}</h1>
                  </div>
                  <div className="text-right">
                    <p className="text-[22px] font-extrabold uppercase leading-tight">{textoFecha}</p>
                    <p className="text-[13px] font-semibold">{grupo.length} {grupo.length === 1 ? "parada" : "paradas"} · {paquetes} paquetes</p>
                  </div>
                </header>

                <table className="w-full table-fixed border-collapse text-[13px] leading-snug">
                  <colgroup>{["8mm", "19mm", "38mm", "42mm", "30mm", "54mm", "28mm", "28mm", "28mm"].map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
                  <thead>
                    <tr className="bg-neutral-200 text-[11px] font-bold uppercase tracking-wide">
                      {["N°", "Barrio", "Cliente", "Dirección", "Teléfono", "Pedido", "Comprobante", "Monto", "Entregó / Cobró"].map((h) => (
                        <th key={h} className="border border-black px-1.5 py-1.5 text-center">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.map((x, n) => (
                      <tr key={x.id} className="break-inside-avoid align-middle">
                        <td className="border border-black px-1 py-2 text-center text-[18px] font-extrabold">{n + 1}</td>
                        <td className="border border-black px-1.5 py-2 text-center text-[12px] font-bold uppercase">{x.barrio}</td>
                        <td className="border border-black px-1.5 py-2 text-center text-[14px] font-bold uppercase leading-tight">{x.cliente}</td>
                        <td className="border border-black px-1.5 py-2 text-center text-[14px] font-semibold">
                          {x.direccion}
                          {x.comentario && <span className="mt-0.5 block text-[12px] font-bold">⚠ {x.comentario}</span>}
                        </td>
                        <td className="whitespace-nowrap border border-black px-1.5 py-2 text-center text-[13px] font-semibold tabular-nums">{x.telefono || "—"}</td>
                        <td className="border border-black px-2 py-2">
                          {x.items.map((i, k) => (
                            <div key={k} className="flex gap-2 text-[14px] font-semibold"><span className="w-6 shrink-0 text-right font-extrabold tabular-nums">{i.cantidad}</span><span>{i.nombre}</span></div>
                          ))}
                        </td>
                        <td className="border border-black px-1.5 py-2 text-center text-[13px] font-bold">
                          {x.webOrden ? "TIENDA" : x.conFactura ? <>FACTURA<span className="block text-[14px]">{x.numeroFactura || "—"}</span></> : <>REMITO<span className="block text-[14px]">{x.remito ?? "—"}</span></>}
                        </td>
                        <td className="whitespace-nowrap border border-black px-1.5 py-2 text-center text-[14px] font-extrabold tabular-nums">
                          {x.webOrden && x.pagoMp ? <span className="text-[12px]">PAGADO</span> : formatoPesos(x.monto)}
                        </td>
                        <td className="border border-black px-1.5 py-2 text-[11px] text-neutral-500">
                          <div>☐ Entregó</div>
                          <div className="mt-1.5">Cobró $ ________</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-right text-[12px] font-semibold">Total a entregar: {paquetes} paquetes · {grupo.length} {grupo.length === 1 ? "parada" : "paradas"}</p>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
