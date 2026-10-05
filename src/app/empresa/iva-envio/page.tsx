import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { BotonVolver } from "@/components/BotonVolver";
import { desgloseIva, IVA_ENVIO } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { deFecha } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { exigirUsuario } from "@/lib/session";
import { puedeGestionarUsuarios } from "@/lib/roles";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";

// Solo para MIRAR (no cambia nada): las facturas ya hechas que llevan envío y cuánto cambiarían sus montos si el envío pasara al 21% de IVA.
export default async function RevisarIvaEnvio() {
  const usuario = await exigirUsuario();
  if (!puedeGestionarUsuarios(usuario.rol)) return <p className="p-10">Solo para dueños.</p>;
  const pedidos = await db.pedido.findMany({
    where: { conFactura: true, ivaPct: { gt: 0 }, estado: { in: ["PENDIENTE", "ENTREGADO"] }, items: { some: { nombre: "ENVÍO", OR: [{ ivaPct: null }, { ivaPct: { not: IVA_ENVIO } }] } } },
    include: { items: true, cliente: true },
    orderBy: [{ fechaEntrega: "asc" }, { creadoEn: "asc" }],
  });
  const filas = pedidos.map((p) => {
    const estado = p.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE";
    const hoy = desgloseIva(p.items, Number(p.ivaPct), estado);
    const nuevo = desgloseIva(p.items.map((i) => (i.nombre === "ENVÍO" ? { ...i, ivaPct: IVA_ENVIO } : i)), Number(p.ivaPct), estado);
    const envio = p.items.filter((i) => i.nombre === "ENVÍO").reduce((t, i) => t + Number(i.precioUnitario) * i.cantidad, 0);
    return { p, envio, hoy: hoy.total, nuevo: nuevo.total, dif: Math.round((nuevo.total - hoy.total) * 100) / 100 };
  });
  const totalDif = Math.round(filas.reduce((t, f) => t + f.dif, 0) * 100) / 100;

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Envío al 21% · facturas ya hechas</h1>
            <p className="mt-1 max-w-3xl text-sm text-stone-600">Solo para mirar: <b>no se cambió nada</b>. Son los pedidos con factura que llevan envío cobrado a la tasa vieja. Se muestra cuánto cambiaría cada monto si el envío pasara al 21%. Las facturas que ya están en ARCA no cambian allá: si el monto del sistema cambia, van a aparecer con diferencia en CUENTA CORRIENTE → Facturas.</p>
          </div>
          <BotonVolver fallback="/empresa" />
        </div>
        {filas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-400 p-8 text-center text-stone-600">No hay facturas con envío a la tasa vieja. No hay nada para cambiar.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
            <div className="grid grid-cols-[6rem_1.6fr_6rem_7rem_7.5rem_7.5rem_7rem] gap-x-3 border-b border-stone-300 bg-crema-100 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-600">
              <span>Día</span><span>Cliente</span><span>Factura</span><span>Envío</span><span>Total hoy</span><span>Total con envío al 21%</span><span>Diferencia</span>
            </div>
            {filas.map(({ p, envio, hoy, nuevo, dif }) => (
              <div key={p.id} className="grid grid-cols-[6rem_1.6fr_6rem_7rem_7.5rem_7.5rem_7rem] items-center gap-x-3 border-t border-stone-200 px-4 py-2 text-center text-[13px] first:border-t-0">
                <span className="tabular-nums">{p.fechaEntrega ? deFecha(p.fechaEntrega).split("-").reverse().join("/") : "—"}</span>
                <Link href={`/pedidos/${p.id}`} className="font-semibold hover:underline">{p.cliente?.nombre}</Link>
                <span className="tabular-nums">{p.numeroFactura || "sin número"}</span>
                <span className="tabular-nums">{formatoPesos(envio)}</span>
                <span className="tabular-nums">{formatoPesos(hoy)}</span>
                <span className="font-semibold tabular-nums">{formatoPesos(nuevo)}</span>
                <span className="font-semibold tabular-nums text-rojo-700">+{formatoPesos(dif)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-stone-400 bg-crema-50 px-4 py-3 text-sm font-semibold">
              <span>{filas.length} {filas.length === 1 ? "factura" : "facturas"}</span>
              <span>Diferencia total: <span className="text-rojo-700">+{formatoPesos(totalDif)}</span></span>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
