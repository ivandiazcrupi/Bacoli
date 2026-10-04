import { db } from "@/lib/db";

export type ProductoPedido = { id: string; nombre: string; sku: string | null; unidad: string; precio: string | null };

/** Productos activos para cargar un pedido. El precio se escribe a mano en cada pedido (por ahora no hay listas de precios). */
export async function productosParaCliente(_clienteId: string): Promise<ProductoPedido[]> {
  const productos = await db.producto.findMany({ where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] });
  return productos.map((p) => ({ id: p.id, nombre: p.nombre, sku: p.sku, unidad: p.unidad, precio: null }));
}
