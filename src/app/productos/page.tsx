import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { cambiarActivoProducto } from "./actions";
import { AgregarProducto, EditarProducto } from "./Formularios";

export default async function Productos() {
  const usuario = await exigirOficina();
  const productos = await db.producto.findMany({ orderBy: [{ activo: "desc" }, { orden: "asc" }, { nombre: "asc" }] });
  const activos = productos.filter((p) => p.activo).length;

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productos <span className="ml-1 rounded-full bg-stone-700 px-2.5 py-0.5 align-middle text-xs font-semibold text-white">{activos} activos</span></h1>
          <p className="mt-1 text-sm text-stone-600">Los productos desactivados no aparecen al cargar un pedido. Los pedidos ya hechos no cambian. El precio se escribe a mano en cada pedido.</p>
        </div>

        <ul className="space-y-2">
          {productos.map((p) => (
            <li key={p.id} className={`rounded-xl border bg-white ${p.activo ? "border-stone-300" : "border-stone-200 bg-stone-50"}`}>
              <details className="group/p">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-crema-200 text-xs font-bold text-stone-700">{p.orden}</span>
                    <span className="min-w-0">
                      <span className={`block truncate font-semibold ${p.activo ? "" : "text-stone-400 line-through"}`}>{p.nombre}</span>
                      <span className="block text-xs text-stone-500">{p.sku ?? "Sin código"} · por {p.unidad}{p.ean ? ` · EAN ${p.ean}` : ""}{p.activo ? "" : " · Desactivado"}</span>
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 group-open/p:bg-stone-800 group-open/p:text-white">Editar</span>
                </summary>
                <div className="space-y-3 px-4 pb-4">
                  <EditarProducto producto={p} />
                  <form action={cambiarActivoProducto.bind(null, p.id, !p.activo)}>
                    <button className={`rounded-md border px-4 py-2 text-sm font-semibold ${p.activo ? "border-rojo-600 text-rojo-700 hover:bg-rojo-50" : "border-verde-700 text-verde-800 hover:bg-verde-50"}`}>
                      {p.activo ? "Desactivar (no sale al cargar pedidos)" : "Volver a activar"}
                    </button>
                  </form>
                </div>
              </details>
            </li>
          ))}
          <li className="rounded-xl border border-dashed border-stone-400 bg-white">
            <details>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-stone-800"><span className="text-xl leading-none">+</span> Agregar producto</summary>
              <div className="px-4 pb-4"><AgregarProducto /></div>
            </details>
          </li>
        </ul>
      </main>
    </>
  );
}
