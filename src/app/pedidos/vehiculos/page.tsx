import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS, EncabezadoPedidos } from "../Encabezado";
import { EncabezadoVehiculos, FilaVehiculo } from "./FilaVehiculo";

// Los vehículos de la empresa. Cada día, en la hoja de ruta, se elige cuáles salen.
export default async function Vehiculos() {
  const usuario = await exigirOficina();
  const vehiculos = await db.vehiculo.findMany({ orderBy: [{ activo: "desc" }, { orden: "asc" }] });

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoPedidos activa="vehiculos" />
        <p className="text-sm text-stone-600">
          Cargá tus camionetas y autos. La <b>capacidad máxima</b> es cuántos <b>paquetes</b> puede llevar cada uno: en la hoja de ruta ves cuánto
          lleva cargado y se pone en rojo si te pasás (avisa, no te frena). Vacía = sin tope.
        </p>
        <div className="overflow-hidden rounded-xl border-2 border-stone-300 bg-white shadow-sm">
          <EncabezadoVehiculos />
          {vehiculos.map((v) => (
            <FilaVehiculo key={v.id} vehiculo={{ id: v.id, nombre: v.nombre, patente: v.patente ?? "", capacidad: v.capacidad?.toString() ?? "", activo: v.activo }} />
          ))}
          <FilaVehiculo />
        </div>
      </main>
    </>
  );
}
