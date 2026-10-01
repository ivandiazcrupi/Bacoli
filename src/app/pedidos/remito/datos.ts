import { titulo } from "@/lib/mayusculas";
import { ordenarItems } from "../filas";

type ItemRemito = { sku: string | null; nombre: string; cantidad: number; unidad: string; precioUnitario: unknown; producto?: { descripcion: string | null; orden: number } | null };
type PedidoRemito = {
  conFactura: boolean;
  numeroFactura: string | null;
  nota: string | null;
  webNombre: string | null;
  webDireccion: string | null;
  webBarrio: string | null;
  webTelefono: string | null;
  cliente: { nombre: string; razonSocial: string | null; cuit: string | null } | null;
  punto: { alias: string | null; direccion: string; barrio: string; telefono: string | null } | null;
  items: ItemRemito[];
};

/** Lo que lleva el remito: cliente y sucursal (mayorista) o los datos de entrega del pedido (tienda online). */
export function datosRemito(p: PedidoRemito) {
  const web = !p.cliente || !p.punto;
  return {
    web,
    cliente: p.cliente ?? { nombre: p.webNombre ?? "", razonSocial: null, cuit: null },
    sucursal: p.punto ?? { alias: null, direccion: titulo(p.webDireccion), barrio: p.webBarrio ?? "", telefono: p.webTelefono },
    items: ordenarItems(p.items).map((i) => ({ sku: i.sku, descripcion: i.producto?.descripcion ?? i.nombre, cantidad: i.cantidad, unidad: i.unidad, precioUnitario: Number(i.precioUnitario) })),
  };
}
