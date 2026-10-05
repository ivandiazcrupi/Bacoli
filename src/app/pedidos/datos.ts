import { db } from "@/lib/db";

export type ProductoPedido = { id: string; nombre: string; sku: string | null; unidad: string; precio: string | null; iva: string };

/** Productos activos para cargar un pedido. El precio y el IVA se eligen en cada pedido (el IVA arranca en 0%). */
export async function productosParaCliente(_clienteId: string): Promise<ProductoPedido[]> {
  const productos = await db.producto.findMany({ where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] });
  return productos.map((p) => ({ id: p.id, nombre: p.nombre, sku: p.sku, unidad: p.unidad, precio: null, iva: "0" }));
}
