import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { errorEdicionVendedor } from "@/lib/edicionVendedor";
import { exigirVendedor, vendedorDeUsuario } from "@/lib/session";
import { datosNuevoPedido } from "../../../../pedidos/actions";
import { BandaTotales } from "../../../BandaTotales";
import { PedidoMovil, type EdicionPedido } from "../../../PedidoMovil";

const coma = (v: { toString(): string } | number) => String(v).replace(".", ","); // 10.5 -> "10,5"

// El vendedor modifica un pedido de SUS clientes mientras siga pendiente (aunque ya esté asignado a un día y a una camioneta).
export default async function EditarPedidoVendedor({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirVendedor();
  const { id } = await params;
  const vendedor = await vendedorDeUsuario(usuario.id);
  const pedido = await db.pedido.findUnique({ where: { id }, include: { items: true, cliente: { select: { vendedorId: true, nombre: true } } } });
  if (!pedido || !vendedor || !pedido.puntoId || pedido.cliente?.vendedorId !== vendedor.id) notFound();

  const encabezado = (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">Modificar pedido</h1>
      <Link href="/vendedor/pedidos" className="text-sm font-semibold text-stone-500 underline decoration-stone-300 underline-offset-4">Salir</Link>
    </div>
  );
  const aviso = (texto: string) => (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-4">
        {encabezado}
        <p className="rounded-xl border border-stone-300 bg-white px-4 py-6 text-center text-[15px] text-stone-700">{texto}</p>
      </main>
    </>
  );

  const motivo = await errorEdicionVendedor(pedido);
  if (motivo) return aviso(motivo);
  const destino = await datosNuevoPedido(pedido.puntoId);
  if (!destino) return aviso("Ese cliente o sucursal ya no está disponible. Pedile a la oficina que modifique el pedido.");

  // Lo que el formulario del celular no puede representar se deja a la oficina, para no perder nada al guardar.
  const manuales = pedido.items.filter((i) => !i.productoId && i.paquetesPor !== 0);
  const sinProducto = pedido.items.some((i) => i.productoId && !destino.productos.some((p) => p.id === i.productoId));
  if (sinProducto || manuales.length > 1 || manuales.some((m) => Number(m.descuentoPct) > 0)) {
    return aviso("Este pedido tiene renglones que no se pueden editar desde el celular (un producto que ya no está o más de un “otro producto”). Pedile a la oficina que lo modifique.");
  }

  const edicion: EdicionPedido = {
    pedidoId: id,
    conFactura: pedido.conFactura,
    nota: pedido.nota ?? "",
    envio: (() => { const e = pedido.items.find((i) => !i.productoId && i.paquetesPor === 0); return e ? coma(Number(e.precioUnitario)) : ""; })(),
    cantidades: {}, precios: {}, ivas: {}, descuentos: {}, sinCargo: {}, motivos: {},
    otro: manuales[0] ? { nombre: manuales[0].nombre, cantidad: String(manuales[0].cantidad), precio: coma(Number(manuales[0].precioUnitario)), unidad: manuales[0].unidad === "unidad" ? "unidad" : "paquete", iva: coma(Number(manuales[0].ivaPct ?? 0)) } : null,
  };
  for (const i of pedido.items) {
    if (!i.productoId) continue;
    edicion.cantidades[i.productoId] = i.cantidad;
    edicion.precios[i.productoId] = coma(Number(i.precioUnitario));
    edicion.ivas[i.productoId] = coma(Number(i.ivaPct ?? (Number(pedido.ivaPct) > 0 ? pedido.ivaPct : 0)));
    if (Number(i.descuentoPct) > 0) edicion.descuentos[i.productoId] = coma(Number(i.descuentoPct));
    if (i.sinCargo > 0) { edicion.sinCargo[i.productoId] = i.sinCargo; edicion.motivos[i.productoId] = i.motivoSinCargo ?? ""; }
  }

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-4">
        {encabezado}
        <BandaTotales vendedor={vendedor} />
        <PedidoMovil inicial={destino} edicion={edicion} />
      </main>
    </>
  );
}
