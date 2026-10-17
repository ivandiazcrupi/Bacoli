import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { errorEdicionVendedor } from "@/lib/edicionVendedor";
import { exigirVendedor, vendedorDeUsuario } from "@/lib/session";
import { filasDelPeriodo } from "@/lib/vendedores";
import { TablaPedidosVendedor } from "../../comercial/vendedores/TablaPedidosVendedor";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { EncabezadoVendedor } from "../EncabezadoVendedor";

// PEDIDOS (vendedor): todos los pedidos de SUS clientes como una cuenta corriente (cargado, entregado, pagado), con filtros.
// Desde acá puede avisar que un pedido se pagó; el último OK lo da la oficina en Cuenta corriente.
export default async function VendedorPedidos() {
  const usuario = await exigirVendedor();
  const vendedor = await vendedorDeUsuario(usuario.id); // su ficha en Comercial → Vendedores (si todavía no la enlazaron, no ve nada)
  const filas = vendedor ? (await filasDelPeriodo("2000-01-01", "2100-01-01")).filter((x) => x.vendedorId === vendedor.id) : [];
  // Pedidos que todavía se pueden modificar: pendientes (aunque ya estén en un día y una camioneta), sin remito ni factura y con la hoja de su día todavía armándose.
  const pendientes = await db.pedido.findMany({ where: { id: { in: filas.filter((x) => x.estado === "PENDIENTE").map((x) => x.id) } }, select: { id: true, estado: true, origen: true, remitoNumero: true, numeroFactura: true, fechaEntrega: true } });
  const editables = (await Promise.all(pendientes.map(async (p) => ((await errorEdicionVendedor(p)) ? null : p.id)))).filter((x): x is string => !!x);
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoVendedor activa="pedidos" titulo={vendedor?.nombre} derecha={<Link href="/vendedor/nuevo" className="whitespace-nowrap rounded-lg bg-verde-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800 sm:px-10">+ Cargar pedido</Link>} />
        {vendedor ? (
          <TablaPedidosVendedor filas={filas} pct={Number(vendedor.comisionPct ?? 0)} modo="vendedor" editables={editables} />
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-stone-500">Todavía no te enlazaron con tu ficha de vendedor. Pedile a la oficina que lo haga.</p>
        )}
      </main>
    </>
  );
}
