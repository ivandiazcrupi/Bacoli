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
                <header className="mb-4 flex items-end justify-between border-b-[3px] border-black pb-2">
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-[0.25em]">BACOLI · Hoja de ruta</p>
                    <h1 className="text-[30px] font-extrabold uppercase leading-tight">{titulo(sa.vehiculo.nombre)}{sa.vehiculo.patente ? <span className="ml-4 text-[18px] font-semibold tracking-wide">{sa.vehiculo.patente}</span> : null}</h1>
                  </div>
                  <p className="text-[26px] font-extrabold uppercase leading-tight">{textoFecha}</p>
                </header>

                <table className="w-full table-fixed border-collapse text-[14px] leading-snug">
                  <colgroup>{["11mm", "20mm", "38mm", "56mm", "28mm", "62mm", "26mm", "27mm", "11mm"].map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
                  <thead>
                    <tr className="border-b-2 border-black text-[11px] font-extrabold uppercase tracking-wider">
                      {["N°", "Barrio", "Cliente", "Dirección", "Teléfono", "Pedido", "Comprobante", "Monto", "OK"].map((h, i) => (
                        <th key={h} className={`px-1.5 pb-1.5 ${i === 3 || i === 5 ? "text-left" : "text-center"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.map((x, n) => (
                      <tr key={x.id} className="break-inside-avoid border-b border-neutral-500 align-middle">
                        <td className="px-1 py-3 text-center"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-[2.5px] border-black text-[16px] font-extrabold text-black">{n + 1}</span></td>
                        <td className="px-1.5 py-3 text-center text-[12px] font-bold uppercase leading-tight">{x.barrio}</td>
                        <td className="px-1.5 py-3 text-center text-[15px] font-extrabold uppercase leading-tight">{x.cliente}</td>
                        <td className="px-2 py-3 text-left text-[15px] font-bold leading-tight">
                          {x.direccion}
                          {x.comentario && <span className="mt-1 block text-[12.5px] font-bold">⚠ {x.comentario}</span>}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-3 text-center text-[13.5px] font-semibold tabular-nums">{x.telefono || "—"}</td>
                        <td className="px-2 py-3 text-left">
                          {x.items.map((i, k) => (
                            <div key={k} className="flex gap-2 text-[14.5px] font-semibold leading-snug"><span className="w-7 shrink-0 text-right text-[16px] font-extrabold tabular-nums">{i.cantidad}</span><span>{i.nombre}</span></div>
                          ))}
                        </td>
                        <td className="px-1.5 py-3 text-center text-[12px] font-extrabold uppercase leading-tight">
                          {x.webOrden ? "TIENDA" : x.conFactura ? <>FACTURA<span className="block text-[14px]">{x.numeroFactura || "—"}</span></> : <>REMITO<span className="block text-[14px]">{x.remito ?? "—"}</span></>}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-3 text-center text-[15px] font-extrabold tabular-nums">
                          {x.webOrden ? <span className="text-[13px] tracking-wide">PAGADO</span> : formatoPesos(x.monto)}
                        </td>
                        <td className="px-1 py-3 text-center"><span className="inline-block h-5 w-5 border-2 border-black" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-5 flex justify-end break-inside-avoid">
                  <div className="w-[60mm] border-[3px] border-black text-center">
                    <p className="border-b-[3px] border-black py-1 text-[12px] font-extrabold uppercase tracking-[0.2em]">Paquetes</p>
                    <p className="py-2 text-[40px] font-extrabold leading-none tabular-nums">{paquetes}</p>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
