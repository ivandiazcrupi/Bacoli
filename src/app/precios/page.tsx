import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { AgregarLista, AgregarProducto, EditarProducto, GrillaPrecios } from "./Formularios";

// Sin centavos si es entero ("3.500"); con dos decimales si no ("3.200,50").
const formato = (n: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);

export default async function Precios() {
  const usuario = await exigirOficina();
  const [listas, productos, precios] = await Promise.all([
    db.listaPrecios.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
    db.producto.findMany({ where: { activo: true }, orderBy: [{ sku: "asc" }, { nombre: "asc" }] }),
    db.precio.findMany(),
  ]);
  const mapa: Record<string, string> = {};
  for (const p of precios) mapa[`${p.listaId}_${p.productoId}`] = formato(Number(p.precio));

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-6">
        <section className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Precios</h1>
            <p className="text-sm text-stone-600">Una columna por lista. Cada cliente usa la lista que tiene asignada en su ficha.</p>
          </div>
          <GrillaPrecios listas={listas} productos={productos} precios={mapa} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Productos</h2>
          <ul className="divide-y divide-stone-200 border-y border-stone-200">
            {productos.map((p) => (
              <li key={p.id}>
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 py-3">
                    <span>
                      <span className="block font-medium">{p.nombre}</span>
                      <span className="block text-xs text-stone-500">{p.sku ?? "Sin código"} · por {p.unidad}{p.ean ? ` · EAN ${p.ean}` : ""}</span>
                    </span>
                    <span className="text-sm text-stone-500 group-open:hidden">Editar</span>
                  </summary>
                  <div className="pb-4"><EditarProducto producto={p} /></div>
                </details>
              </li>
            ))}
          </ul>
          <details className="py-1">
            <summary className="cursor-pointer text-sm font-medium">+ Agregar producto</summary>
            <div className="mt-3"><AgregarProducto /></div>
          </details>
        </section>

        <section className="space-y-2">
          <details>
            <summary className="cursor-pointer text-sm font-medium">+ Agregar lista de precios</summary>
            <div className="mt-3"><AgregarLista /></div>
          </details>
        </section>
      </main>
    </>
  );
}
