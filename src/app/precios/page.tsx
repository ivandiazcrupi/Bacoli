import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { AgregarLista, AgregarProducto, EditarProducto, GrillaPrecios } from "./Formularios";

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
      <main className="relative mx-auto max-w-[1400px] space-y-8 px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Precios</h1>
            <p className="mt-1 text-sm text-stone-500">Un precio por producto en cada lista. Cada cliente usa la lista que tiene en su ficha.</p>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {listas.map((l) => (
              <Link
                key={l.id}
                href={`/precios?lista=${l.id}`}
                className={`rounded-full px-5 py-2 text-sm font-semibold uppercase tracking-wide transition ${l.id === lista?.id ? "bg-amber-700 text-white shadow-sm" : "border border-stone-300 bg-white text-stone-600 hover:border-amber-600 hover:text-amber-800"}`}
              >
                {l.nombre}
              </Link>
            ))}
            <details className="group sm:relative">
              <summary className="cursor-pointer list-none rounded-full border border-dashed border-stone-400 px-5 py-2 text-sm font-medium text-stone-600 hover:border-amber-600 hover:text-amber-800">+ Nueva lista</summary>
              <div className="absolute inset-x-4 z-10 mt-2 rounded-2xl sm:inset-x-auto sm:left-0 sm:w-80 border border-stone-200 bg-white p-4 shadow-lg">
                <AgregarLista listas={listas} />
              </div>
            </details>
          </div>

          {lista ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-stone-100 pb-4">
                <h2 className="shrink-0 text-xl font-bold uppercase tracking-wide">Lista {lista.nombre}</h2>
                <span className="text-right text-xs text-stone-500">Precios sin IVA, por la unidad de venta de cada producto</span>
              </div>
              <GrillaPrecios lista={lista} productos={productos} precios={mapa} />
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-stone-600">Todavía no hay listas de precios. Creá una con “+ Nueva lista”.</p>
          )}
        </section>

        <details className="group overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4">
            <span>
              <span className="block text-lg font-bold">Productos <span className="ml-1 rounded-full bg-amber-700 px-2.5 py-0.5 text-xs font-semibold text-white">{productos.length}</span></span>
              <span className="block text-sm text-stone-600">Ver, editar o agregar productos (nombre, código, unidad, EAN)</span>
            </span>
            <span aria-hidden className="text-2xl text-amber-800 transition group-open:rotate-180">⌄</span>
          </summary>
          <div className="space-y-2 border-t border-amber-200 bg-white p-4 sm:p-6">
            <ul className="grid gap-3 lg:grid-cols-2">
              {productos.map((p) => (
                <li key={p.id} className="self-start rounded-xl border border-stone-200 lg:[&:has(details[open])]:col-span-2">
                  <details className="group/p">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{p.nombre}</span>
                        <span className="block text-xs text-stone-500">{p.sku ?? "Sin código"} · por {p.unidad}{p.ean ? ` · EAN ${p.ean}` : ""}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 group-open/p:bg-amber-700 group-open/p:text-white">Editar</span>
                    </summary>
                    <div className="px-4 pb-4"><EditarProducto producto={p} /></div>
                  </details>
                </li>
              ))}
              <li className="self-start rounded-xl border border-dashed border-amber-400">
                <details>
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-amber-800">
                    <span className="text-xl leading-none">+</span> Agregar producto
                  </summary>
                  <div className="px-4 pb-4"><AgregarProducto /></div>
                </details>
              </li>
            </ul>
          </div>
        </details>
      </main>
    </>
  );
}
