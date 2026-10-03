import { titulo } from "@/lib/mayusculas";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { actualizarPedido } from "../../actions";
import { productosParaCliente } from "../../datos";
import { CONTENEDOR_PEDIDOS } from "../../Encabezado";
import { datosEntrega, ordenarItems } from "../../filas";
import { EditorWeb } from "./EditorWeb";
import { FormularioLineas, type LineaProducto } from "../../FormularioLineas";

export default async function EditarPedido({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const pedido = await db.pedido.findUnique({ where: { id }, include: { items: { include: { producto: { select: { orden: true } } } }, cliente: true, punto: true } });
  if (!pedido) notFound();
  if (pedido.estado !== "PENDIENTE" && pedido.estado !== "NO_ENTREGADO") redirect(`/pedidos/${id}`);

  // Pedido de la tienda online: sin cliente ni lista de precios, se edita con su propio formulario.
  if (!pedido.clienteId || !pedido.puntoId) {
    const entrega = datosEntrega(pedido);
    return (
      <>
        <Cabecera usuario={usuario} />
        <main className={CONTENEDOR_PEDIDOS}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Pedido de la tienda N° {pedido.webOrden}</h1>
              <p className="mt-1 text-sm text-stone-600">{entrega.nombre}</p>
            </div>
            <Link href={`/pedidos/${id}`} className="rounded-md border border-stone-400 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-crema-100">← Volver al pedido</Link>
          </div>
          <EditorWeb
            pedidoId={id}
            items={ordenarItems(pedido.items).map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad, cantidad: i.cantidad }))}
            datos={{ nombre: pedido.webNombre ?? "", barrio: pedido.webBarrio ?? "", direccion: titulo(pedido.webDireccion), telefono: pedido.webTelefono ?? "", total: String(pedido.webTotal ?? "").replace(".", ","), nota: pedido.nota ?? "" }}
          />
        </main>
      </>
    );
  }

  // Los renglones que ya estaban conservan su precio; los productos que no estaban usan el precio actual del cliente.
  const actuales = await productosParaCliente(pedido.clienteId);
  const lineas: LineaProducto[] = actuales.map((p) => {
    const item = pedido.items.find((i) => i.productoId === p.id);
    return { ...p, precio: item ? String(item.precioUnitario).replace(".", ",") : p.precio, cantidad: item?.cantidad ?? 0, sinCargo: item?.sinCargo ?? 0, motivoSinCargo: item?.motivoSinCargo ?? null, bonificacion: item && Number(item.descuentoPct) ? String(item.descuentoPct).replace(".", ",") : "" };
  });
  for (const item of pedido.items) {
    if (item.productoId && !lineas.some((l) => l.id === item.productoId)) {
      lineas.push({ id: item.productoId, nombre: item.nombre, sku: item.sku, unidad: item.unidad, precio: String(item.precioUnitario).replace(".", ","), cantidad: item.cantidad, sinCargo: item.sinCargo, motivoSinCargo: item.motivoSinCargo, bonificacion: Number(item.descuentoPct) ? String(item.descuentoPct).replace(".", ",") : "" });
    }
  }

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{pedido.cliente?.nombre}</h1>
            <p className="mt-1 text-sm text-stone-600">{[pedido.punto?.alias, titulo(pedido.punto?.direccion)].filter(Boolean).join(" · ")}</p>
          </div>
          <Link href={`/pedidos/${id}`} className="rounded-md border border-stone-400 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-crema-100">← Volver al pedido</Link>
        </div>
        <FormularioLineas
          accion={actualizarPedido.bind(null, id)}
          puntoId={pedido.puntoId}
          productos={lineas}
          conFacturaInicial={pedido.conFactura}
          notaInicial={pedido.nota ?? ""}
          envioInicial={(() => { const e = pedido.items.find((i) => !i.productoId && i.paquetesPor === 0 && i.nombre === "ENVÍO"); return e ? String(e.precioUnitario).replace(".", ",") : ""; })()}
          esDueno={usuario.rol === "DUENO"}
          textoBoton="Guardar cambios"
        />
      </main>
    </>
  );
}
