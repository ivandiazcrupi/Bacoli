import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirVendedor, vendedorDeUsuario } from "@/lib/session";
import { FormEditarCliente } from "./FormEditarCliente";

// El vendedor corrige los datos de uno de SUS clientes (teléfono, nota, dirección…).
export default async function EditarClienteVendedor({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirVendedor();
  const vendedor = await vendedorDeUsuario(usuario.id);
  const { id } = await params;
  const cliente = await db.cliente.findUnique({ where: { id }, include: { puntos: { orderBy: [{ barrio: "asc" }, { direccion: "asc" }] } } });
  if (!cliente || !vendedor || cliente.vendedorId !== vendedor.id) notFound();
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{cliente.nombre}</h1>
          <Link href="/vendedor/clientes" className="text-sm font-semibold text-stone-500 underline decoration-stone-300 underline-offset-4">Volver a clientes</Link>
        </div>
        <FormEditarCliente
          id={cliente.id} razonSocial={cliente.razonSocial ?? ""} cuit={cliente.cuit ?? ""}
          puntos={cliente.puntos.map((p) => ({ id: p.id, barrio: p.barrio, direccion: p.direccion, telefono: p.telefono ?? "", comentario: p.comentario ?? "", activo: p.activo }))}
        />
      </main>
    </>
  );
}
