import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { hoy } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { FormCargar } from "./FormCargar";
import { BotonVolver } from "@/components/BotonVolver";

export default async function CargarComprobante() {
  const usuario = await exigirOficina();
  const clientes = await db.cliente.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } });
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Cargar comprobante</h1>
          <BotonVolver fallback="/cuentas" />
        </div>
        <FormCargar clientes={clientes} hoy={hoy()} />
      </main>
    </>
  );
}
