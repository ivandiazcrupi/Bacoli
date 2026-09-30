import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { AgregarLista, AgregarProducto, GrillaPrecios } from "./Formularios";

export default async function Precios() {
  const usuario = await exigirOficina();
  const [listas, productos, precios] = await Promise.all([
    db.listaPrecios.findMany({ orderBy: { nombre: "asc" } }),
    db.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    db.precio.findMany(),
  ]);
  const mapa: Record<string, string> = {};
  for (const p of precios) mapa[`${p.listaId}_${p.productoId}`] = String(p.precio).replace(".", ",");

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <h1 className="text-2xl font-bold">Precios</h1>
        <GrillaPrecios listas={listas} productos={productos} precios={mapa} />
        <section className="space-y-2">
          <h2 className="font-semibold">Agregar producto</h2>
          <AgregarProducto />
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold">Agregar lista de precios</h2>
          <AgregarLista />
        </section>
      </main>
    </>
  );
}
