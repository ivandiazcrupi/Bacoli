import { BotonVolver } from "@/components/BotonVolver";
import { Cabecera } from "@/components/Cabecera";
import { exigirVendedor } from "@/lib/session";
import { NuevoPedido } from "../../pedidos/NuevoPedido";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";

// El vendedor carga un pedido a uno de SUS clientes. Entra directo a Pedidos (la oficina le asigna el día).
export default async function CargarPedidoVendedor() {
  const usuario = await exigirVendedor();
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cargar pedido</h1>
            <p className="mt-1 text-sm text-stone-600">Elegí uno de tus clientes y cargá lo que pidió. La oficina le asigna el día de entrega.</p>
          </div>
          <BotonVolver fallback="/vendedor" />
        </div>
        <NuevoPedido esDueno={false} esVendedor />
      </main>
    </>
  );
}
