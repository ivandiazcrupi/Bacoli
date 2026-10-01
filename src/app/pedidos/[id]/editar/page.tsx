import { titulo } from "@/lib/mayusculas";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { actualizarPedido } from "../../actions";
import { productosParaCliente } from "../../datos";
import { CONTENEDOR_PEDIDOS } from "../../Encabezado";
import { FormularioLineas, type LineaProducto } from "../../FormularioLineas";

export default async function EditarPedido({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const pedido = await db.pedido.findUnique({ where: { id }, include: { items: true, cliente: true, punto: true } });
  if (!pedido) notFound();
  if (pedido.estado !== "PENDIENTE") redirect(`/pedidos/${id}`);

  // Los renglones que ya estaban conservan su precio; los productos que no estaban usan el precio actual del cliente.
  const actuales = await productosParaCliente(pedido.clienteId);
  const lineas: LineaProducto[] = actuales.map((p) => {
    const item = pedido.items.find((i) => i.productoId === p.id);
    return { ...p, precio: item ? String(item.precioUnitario).replace(".", ",") : p.precio, cantidad: item?.cantidad ?? 0 };
  });
  for (const item of pedido.items) {
    if (!lineas.some((l) => l.id === item.productoId)) {
      lineas.push({ id: item.productoId, nombre: item.nombre, sku: item.sku, unidad: item.unidad, precio: String(item.precioUnitario).replace(".", ","), cantidad: item.cantidad });
    }
  }

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{pedido.cliente.nombre}</h1>
            <p className="mt-1 text-sm text-stone-600">{[pedido.punto.alias, titulo(pedido.punto.direccion)].filter(Boolean).join(" · ")}</p>
          </div>
          <Link href={`/pedidos/${id}`} className="rounded-md border border-stone-400 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-crema-100">← Volver al pedido</Link>
        </div>
        <FormularioLineas
          accion={actualizarPedido.bind(null, id)}
          puntoId={pedido.puntoId}
          productos={lineas}
          conFacturaInicial={pedido.conFactura}
          notaInicial={pedido.nota ?? ""}
          esDueno={usuario.rol === "DUENO"}
          textoBoton="Guardar cambios"
        />
      </main>
    </>
  );
}
