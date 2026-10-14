import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { deFecha } from "@/lib/fechas";
import { exigirVendedor, vendedorDeUsuario } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../pedidos/Encabezado";
import { EncabezadoVendedor } from "./EncabezadoVendedor";
import { MisPedidos } from "./MisPedidos";

// MIS PEDIDOS (vendedor): solo los pedidos de SUS clientes, con su estado y si están pagos o no.
export default async function VendedorPedidos() {
  const usuario = await exigirVendedor();
  const vendedor = await vendedorDeUsuario(usuario.id); // su ficha en Comercial → Vendedores (si todavía no la enlazaron, no ve nada)
  const pedidos = await db.pedido.findMany({
    where: { cliente: { vendedorId: vendedor?.id ?? "-" } },
    include: { items: true, cliente: { select: { nombre: true } }, punto: { select: { barrio: true } } },
    orderBy: { creadoEn: "desc" },
    take: 1000,
  });
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoVendedor activa="pedidos" derecha={<Link href="/vendedor/nuevo" className="flex h-10 items-center rounded-lg bg-verde-700 px-5 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800">+ Cargar pedido</Link>} />
        <MisPedidos
          filas={pedidos.map((p) => ({
            id: p.id,
            cargado: new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(p.creadoEn),
            entrega: p.fechaEntrega ? deFecha(p.fechaEntrega) : null,
            cliente: p.cliente?.nombre ?? "—",
            barrio: p.punto?.barrio ?? "",
            items: p.items.filter((i) => i.paquetesPor !== 0).map((i) => ({ cantidad: i.cantidad, nombre: i.nombre })),
            monto: importeVigente(p.items, Number(p.ivaPct), "PENDIENTE"),
            estado: p.estado,
            pagado: p.pagado,
            medio: p.medioCobro,
            aCuenta: p.cobro === "CUENTA_CORRIENTE",
          }))}
        />
      </main>
    </>
  );
}
