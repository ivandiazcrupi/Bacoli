import Link from "next/link";
import { PestanasPedidos } from "./Pestanas";

/** Mismo ancho y mismo encabezado en las cuatro pantallas de Pedidos, para que al pasar de una a otra nada se mueva. */
export const CONTENEDOR_PEDIDOS = "mx-auto w-full max-w-[1600px] space-y-5 px-4 py-6 sm:px-8";

export function EncabezadoPedidos({ activa, fechaRuta }: { activa: "pedidos" | "semana" | "ruta" | "vehiculos"; fechaRuta?: string }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <Link href="/pedidos/nuevo" className="whitespace-nowrap rounded-lg bg-verde-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800 sm:px-10">+ Cargar pedido</Link>
      </div>
      <PestanasPedidos activa={activa} fechaRuta={fechaRuta} />
    </>
  );
}
