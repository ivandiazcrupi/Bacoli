import { db } from "@/lib/db";

export type ProductoPedido = { id: string; nombre: string; sku: string | null; unidad: string; precio: string | null; iva: string };

const texto = (n: number) => String(n).replace(".", ",");

/** Productos activos para cargar un pedido. El precio se escribe a mano en cada pedido; el IVA es el propio del producto o, si no tiene, el del cliente. */
export async function productosParaCliente(clienteId: string): Promise<ProductoPedido[]> {
  const [cliente, productos] = await Promise.all([
    db.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { ivaPct: true } }),
    db.producto.findMany({ where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
  ]);
  return productos.map((p) => ({ id: p.id, nombre: p.nombre, sku: p.sku, unidad: p.unidad, precio: null, iva: texto(Number(p.ivaPct ?? cliente.ivaPct)) }));
}
