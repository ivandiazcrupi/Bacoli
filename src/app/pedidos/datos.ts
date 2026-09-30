import { db } from "@/lib/db";
import { precioParaCliente } from "@/lib/precios";

export type ProductoPedido = { id: string; nombre: string; sku: string | null; unidad: string; precio: string | null };

/** Productos activos con el precio que le corresponde a ese cliente (su precio propio, o el de su lista con su descuento). */
export async function productosParaCliente(clienteId: string): Promise<ProductoPedido[]> {
  const [cliente, productos] = await Promise.all([
    db.cliente.findUniqueOrThrow({
      where: { id: clienteId },
      include: { listaPrecios: { include: { precios: true } }, preciosEspeciales: true },
    }),
    db.producto.findMany({ where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
  ]);
  return productos.map((p) => {
    const propio = cliente.preciosEspeciales.find((x) => x.productoId === p.id);
    const deLista = cliente.listaPrecios?.precios.find((x) => x.productoId === p.id);
    const precio = precioParaCliente({
      especial: propio ? Number(propio.precio) : null,
      precioLista: deLista ? Number(deLista.precio) : null,
      descuentoPct: Number(cliente.descuentoPct),
    });
    return { id: p.id, nombre: p.nombre, sku: p.sku, unidad: p.unidad, precio: precio === null ? null : String(precio).replace(".", ",") };
  });
}
