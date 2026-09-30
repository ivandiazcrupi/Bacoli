import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { NavClientes } from "@/components/NavClientes";
import { PreciosEspeciales, type FilaPrecio } from "@/app/clientes/PreciosEspeciales";
import { db } from "@/lib/db";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { guardarPreciosMarca } from "../actions";

export default async function FichaMarca({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const marca = await db.marca.findUnique({
    where: { id },
    include: { precios: true, clientes: { orderBy: { nombre: "asc" }, include: { _count: { select: { puntos: true, preciosEspeciales: true } } } } },
  });
  if (!marca) notFound();
  const productos = await db.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });

  const filas: FilaPrecio[] = productos.map((p) => {
    const precio = marca.precios.find((x) => x.productoId === p.id);
    return {
      productoId: p.id,
      nombre: p.nombre,
      especial: precio ? String(precio.precio).replace(".", ",") : "",
      textoLleno: `Todos los clientes de ${marca.nombre} pagan ${precio ? formatoPesos(Number(precio.precio)) : ""} (final, sin descuento), salvo que un cliente tenga precio propio.`,
      textoVacio: "Sin precio de marca: cada cliente paga el de su lista.",
    };
  });

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <NavClientes actual="marcas" />
        <div>
          <Link href="/marcas" className="text-sm text-stone-600">← Marcas</Link>
          <h1 className="text-2xl font-bold">{marca.nombre}</h1>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Precios de la marca</h2>
          <PreciosEspeciales
            accion={guardarPreciosMarca.bind(null, marca.id)}
            filas={filas}
            pie="Precio por paquete, sin IVA. Vale para todos los clientes de la marca y todas sus sucursales."
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Clientes de la marca ({marca.clientes.length})</h2>
          {marca.clientes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 p-4 text-stone-600">
              Todavía no hay clientes. Se asigna la marca desde la ficha de cada cliente.
            </p>
          ) : (
            <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
              {marca.clientes.map((c) => (
                <li key={c.id}>
                  <Link href={`/clientes/${c.id}`} className={`block p-4 ${c.activo ? "" : "opacity-60"}`}>
                    <p className="font-medium">{c.nombre}</p>
                    <p className="text-sm text-stone-600">
                      {c._count.puntos} {c._count.puntos === 1 ? "sucursal" : "sucursales"}
                      {c._count.preciosEspeciales > 0 && " · precio propio"}
                      {c.cuit && ` · CUIT ${c.cuit}`}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
