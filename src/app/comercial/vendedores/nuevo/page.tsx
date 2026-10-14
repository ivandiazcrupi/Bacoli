import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { vendedoresDesbloqueado } from "@/lib/claveVendedores";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../../../pedidos/Encabezado";
import { PantallaBloqueada } from "../Bloqueo";
import { FormVendedor } from "../Formularios";

export default async function NuevoVendedor() {
  const usuario = await exigirOficina();
  if (!(await vendedoresDesbloqueado())) return <PantallaBloqueada usuario={usuario} />;
  const usuarios = await db.usuario.findMany({ where: { rol: "VENDEDOR", activo: true, vendedor: null }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } });
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={`${CONTENEDOR_PEDIDOS} space-y-6`}>
        <Link href="/comercial/vendedores" className="text-sm font-semibold text-stone-500 hover:underline">‹ Vendedores</Link>
        <div className="mx-auto w-full max-w-2xl space-y-6 rounded-2xl border border-stone-200 bg-white p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Nuevo vendedor</h1>
          <FormVendedor usuarios={usuarios} />
        </div>
      </main>
    </>
  );
}
