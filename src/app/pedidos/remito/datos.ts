import { titulo } from "@/lib/mayusculas";
import { ordenarItems } from "../filas";

type ItemRemito = { sku: string | null; nombre: string; cantidad: number; sinCargo: number; descuentoPct: unknown; unidad: string; precioUnitario: unknown; producto?: { descripcion: string | null; orden: number } | null };
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
    items: ordenarItems(p.items).flatMap((i) => {
      const dto = Number(i.descuentoPct ?? 0);
      const filas = [];
      if (i.cantidad > 0) filas.push({ sku: i.sku, descripcion: dto > 0 ? `${i.nombre} · bonif. ${String(dto).replace(".", ",")}%` : i.nombre, cantidad: i.cantidad, unidad: i.unidad, precioUnitario: Math.round(Number(i.precioUnitario) * (1 - dto / 100) * 100) / 100 });
      if (i.sinCargo > 0) filas.push({ sku: i.sku, descripcion: `${i.nombre} · sin cargo`, cantidad: i.sinCargo, unidad: i.unidad, precioUnitario: 0 });
      return filas;
    }),
  };
}
