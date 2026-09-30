import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { crearCliente } from "../actions";
import { CLIENTE_VACIO, ClienteForm } from "../ClienteForm";

export default async function NuevoCliente() {
  const usuario = await exigirOficina();
  const [listas, marcas, zonas, barrios] = await Promise.all([
    db.listaPrecios.findMany({ orderBy: { nombre: "asc" } }),
    db.marca.findMany({ orderBy: { nombre: "asc" } }),
    db.zona.findMany({ orderBy: { orden: "asc" } }),
    db.puntoEntrega.findMany({ distinct: ["barrio"], select: { barrio: true }, orderBy: { barrio: "asc" } }),
  ]);

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <h1 className="text-2xl font-bold">Nuevo cliente</h1>
        <ClienteForm accion={crearCliente} inicial={CLIENTE_VACIO} listas={listas} marcas={marcas} zonas={zonas} barrios={barrios.map((b) => b.barrio)} textoBoton="Crear cliente" />
      </main>
    </>
  );
}
