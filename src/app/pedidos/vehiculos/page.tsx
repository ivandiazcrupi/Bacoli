import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS, EncabezadoPedidos } from "../Encabezado";
import { TOPE_COSTO_POR_PIZZA } from "@/lib/ruta";
import { CostoLogisticoUnidad } from "./CostoLogisticoUnidad";
import { EncabezadoVehiculos, FilaVehiculo } from "./FilaVehiculo";

// Los vehículos de la empresa. Cada día, en la hoja de ruta, se elige cuáles salen.
export default async function Vehiculos() {
  const usuario = await exigirOficina();
  const empresa = usuario.rol === "DUENO" ? await db.empresa.findUnique({ where: { id: "principal" }, select: { costoLogisticoUnidad: true } }) : null;
  const vehiculos = await db.vehiculo.findMany({ where: { eliminado: false }, orderBy: [{ activo: "desc" }, { orden: "asc" }] });

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoPedidos activa="vehiculos" />
        <p className="text-sm text-stone-600">
          Cargá tus camionetas y autos. Si una camioneta tiene un <b>costo de logística por día</b> ya seteado, al sumarla a un día se carga sola (y se puede editar ahí); si no, hay que cargarlo a mano en cada hoja de ruta: sin eso no se puede dejar lista la hoja ni imprimirla. La <b>capacidad máxima</b> es cuántos <b>paquetes</b> puede llevar cada uno: en la hoja de ruta ves cuánto
          lleva cargado y se pone en rojo si te pasás (avisa, no te frena). Vacía = sin tope.
        </p>
        {usuario.rol === "DUENO" && <CostoLogisticoUnidad inicial={empresa?.costoLogisticoUnidad ? String(Number(empresa.costoLogisticoUnidad)) : ""} porDefecto={TOPE_COSTO_POR_PIZZA} />}
        <div className="overflow-hidden rounded-xl border-2 border-stone-300 bg-white shadow-sm">
          <EncabezadoVehiculos verCosto={usuario.rol === "DUENO"} />
          {vehiculos.map((v) => (
            <FilaVehiculo key={v.id} vehiculo={{ id: v.id, nombre: v.nombre, patente: v.patente ?? "", capacidad: v.capacidad?.toString() ?? "", costo: v.costoLogistico ? String(Number(v.costoLogistico)) : "", activo: v.activo }} verCosto={usuario.rol === "DUENO"} />
          ))}
          <FilaVehiculo verCosto={usuario.rol === "DUENO"} />
        </div>
      </main>
    </>
  );
}
