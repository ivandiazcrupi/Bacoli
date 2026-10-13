import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { titulo } from "@/lib/mayusculas";
import { formatoPesos } from "@/lib/numeros";
import { exigirVendedor } from "@/lib/session";
import { enlaceWhatsApp } from "@/lib/telefonos";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { EncabezadoVendedor } from "../EncabezadoVendedor";

// MIS CLIENTES (vendedor): solo sus clientes, con dónde entregan y cuánto tienen sin pagar.
export default async function VendedorClientes() {
  const usuario = await exigirVendedor();
  const clientes = await db.cliente.findMany({
    where: { vendedorId: usuario.id, activo: true },
    include: { puntos: { where: { activo: true }, orderBy: { barrio: "asc" } }, pedidos: { where: { estado: "ENTREGADO", pagado: false }, include: { items: true } } },
    orderBy: { nombre: "asc" },
  });
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoVendedor activa="clientes" titulo="Mis clientes" derecha={<Link href="/vendedor/nuevo" className="flex h-10 items-center rounded-lg bg-verde-700 px-5 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800">+ Cargar pedido</Link>} />
        {clientes.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-stone-300 p-4 text-stone-600">Todavía no tenés clientes asignados. La oficina te los asigna desde la ficha de cada cliente.</p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {clientes.map((c) => {
              const debe = c.pedidos.reduce((t, p) => t + importeVigente(p.items, Number(p.ivaPct), "PENDIENTE"), 0);
              return (
                <section key={c.id} className="rounded-lg border border-stone-300 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold">{c.nombre}</h2>
                    {c.pedidos.length > 0
                      ? <span className="shrink-0 rounded-full bg-rojo-50 px-3 py-1 text-[12.5px] font-bold text-rojo-700">Sin pagar · {c.pedidos.length} {c.pedidos.length === 1 ? "pedido" : "pedidos"} · {formatoPesos(debe)}</span>
                      : <span className="shrink-0 rounded-full bg-verde-50 px-3 py-1 text-[12.5px] font-bold text-verde-700">Al día</span>}
                  </div>
                  <ul className="mt-2 divide-y divide-stone-200 text-[13px]">
                    {c.puntos.map((p) => {
                      const wa = enlaceWhatsApp(p.telefono);
                      return (
                        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                          <span><b>{p.barrio}</b> · {titulo(p.direccion)}</span>
                          {p.telefono && (wa ? <a href={wa} target="_blank" rel="noreferrer" className="text-verde-800 underline">{p.telefono}</a> : <span>{p.telefono}</span>)}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
