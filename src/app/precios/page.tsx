import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { AgregarLista, AgregarProducto, EditarProducto, GrillaPrecios, SelectorLista } from "./Formularios";

// Sin centavos si es entero ("3.500"); con dos decimales si no ("3.200,50").
const formato = (n: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);

export default async function Precios({ searchParams }: { searchParams: Promise<{ lista?: string }> }) {
  const usuario = await exigirOficina();
  const { lista: pedida } = await searchParams;
  const [listas, productos] = await Promise.all([
    db.listaPrecios.findMany({ where: { activa: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
    db.producto.findMany({ where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
  ]);
  const lista = listas.find((l) => l.id === pedida) ?? listas.find((l) => l.nombre.toUpperCase() === "MAYORISTA") ?? listas[0];
  const precios = lista ? await db.precio.findMany({ where: { listaId: lista.id } }) : [];
  const mapa: Record<string, string> = {};
  for (const p of precios) mapa[p.productoId] = formato(Number(p.precio));

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-xl space-y-10 px-4 py-6">
        <section className="space-y-4">
          <h1 className="text-2xl font-bold">Precios</h1>
          {lista ? (
            <>
              <SelectorLista listas={listas} actual={lista.id} />
              <GrillaPrecios lista={lista} productos={productos} precios={mapa} />
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-stone-300 p-4 text-stone-600">Todavía no hay listas de precios. Creá una abajo.</p>
          )}
          <details className="pt-2">
            <summary className="cursor-pointer text-sm font-medium">+ Nueva lista de precios</summary>
            <div className="mt-3"><AgregarLista listas={listas} /></div>
          </details>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Productos</h2>
          <ul className="divide-y divide-stone-200 border-y border-stone-200">
            {productos.map((p) => (
              <li key={p.id}>
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.nombre}</span>
                      <span className="block text-xs text-stone-500">{p.sku ?? "Sin código"} · por {p.unidad}{p.ean ? ` · EAN ${p.ean}` : ""}</span>
                    </span>
                    <span className="text-sm text-stone-500 group-open:hidden">Editar</span>
                  </summary>
                  <div className="pb-4"><EditarProducto producto={p} /></div>
                </details>
              </li>
            ))}
          </ul>
          <details>
            <summary className="cursor-pointer text-sm font-medium">+ Agregar producto</summary>
            <div className="mt-3"><AgregarProducto /></div>
          </details>
        </section>
      </main>
    </>
  );
}
