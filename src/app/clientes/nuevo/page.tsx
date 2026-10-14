import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { BotonVolver } from "@/components/BotonVolver";
import { crearCliente } from "../actions";
import { CLIENTE_VACIO, ClienteForm } from "../ClienteForm";

export default async function NuevoCliente() {
  const usuario = await exigirOficina();
  const [listas, zonas, barrios] = await Promise.all([
    db.listaPrecios.findMany({ where: { activa: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
    db.zona.findMany({ orderBy: { orden: "asc" } }),
    db.puntoEntrega.findMany({ distinct: ["barrio"], select: { barrio: true }, orderBy: { barrio: "asc" } }),
  ]);

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1600px] space-y-4 sm:px-8 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Nuevo cliente</h1>
          <BotonVolver fallback="/clientes" />
        </div>
        <ClienteForm accion={crearCliente} inicial={{ ...CLIENTE_VACIO, listaPreciosId: listas[0]?.id ?? "" }} listas={listas} zonas={zonas} barrios={barrios.map((b) => b.barrio)} textoBoton="Crear cliente" />
      </main>
    </>
  );
}
