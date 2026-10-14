import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirVendedor, vendedorDeUsuario } from "@/lib/session";
import { FiltrosClientes } from "../../clientes/FiltrosClientes";
import { ListaClientes } from "../../clientes/ListaClientes";
import { filtroClientes } from "../../clientes/consulta";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { EncabezadoVendedor } from "../EncabezadoVendedor";

// CLIENTES (vendedor): la misma lista que ve la oficina en Clientes, pero solo con SUS clientes y sin los accesos de oficina.
export default async function VendedorClientes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const usuario = await exigirVendedor();
  const vendedor = await vendedorDeUsuario(usuario.id);
  const { q = "", zona = "", estado = "activos" } = await searchParams;
  const where = filtroClientes({ q, zona, estado }, { vendedorId: vendedor?.id ?? "-" });
  const [clientes, zonas] = await Promise.all([
    db.cliente.findMany({
      where, orderBy: { nombre: "asc" },
      include: { puntos: { where: zona ? { zonaId: zona } : undefined, include: { zona: true }, orderBy: [{ barrio: "asc" }, { direccion: "asc" }] } },
    }),
    db.zona.findMany({ orderBy: { orden: "asc" } }),
  ]);
  const totalPuntos = clientes.reduce((n, c) => n + c.puntos.length, 0);
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoVendedor activa="clientes" derecha={<Link href="/vendedor/nuevo" className="whitespace-nowrap rounded-lg bg-verde-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800 sm:px-10">+ Cargar pedido</Link>} />
        <FiltrosClientes q={q} zona={zona} estado={estado} zonas={zonas.map((z) => ({ id: z.id, nombre: z.nombre }))} base="/vendedor/clientes" />
        <p className="text-sm text-stone-600">
          <b className="text-stone-900">{clientes.length}</b> {clientes.length === 1 ? "cliente" : "clientes"} · <b className="text-stone-900">{totalPuntos}</b> {totalPuntos === 1 ? "sucursal" : "sucursales"} (puntos de entrega)
        </p>
        {clientes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-4 text-stone-600">{vendedor && !q && !zona && estado === "activos" ? "Todavía no tenés clientes asignados. La oficina te los asigna desde Comercial → Vendedores." : "No hay clientes con esos filtros."}</p>
        ) : (
          <ListaClientes clientes={clientes} modo="vendedor" />
        )}
      </main>
    </>
  );
}
