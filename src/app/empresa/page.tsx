import { redirect } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/session";
import { FormularioEmpresa } from "./FormularioEmpresa";

export default async function Empresa() {
  const usuario = await exigirUsuario();
  if (usuario.rol !== "DUENO") redirect("/");
  const [empresa, contador] = await Promise.all([db.empresa.findUnique({ where: { id: "principal" } }), db.numerador.findUnique({ where: { id: "REMITO" } })]);
  const version = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">Datos de la empresa</h1>
          <p className="text-sm text-stone-600">Salen impresos en los remitos, y más adelante en las facturas.</p>
        </div>
        <FormularioEmpresa
          proximoRemito={(contador?.ultimo ?? 0) + 1}
          inicial={{
            razonSocial: empresa?.razonSocial ?? "", nombreComercial: empresa?.nombreComercial ?? "BACOLI", cuit: empresa?.cuit ?? "", condicionIva: empresa?.condicionIva ?? "",
            domicilio: empresa?.domicilio ?? "", telefono: empresa?.telefono ?? "", email: empresa?.email ?? "", ingresosBrutos: empresa?.ingresosBrutos ?? "",
            inicioActividades: empresa?.inicioActividades ?? "", puntoVenta: empresa?.puntoVenta ?? "",
          }}
        />
        <p className="text-xs text-stone-500">Versión del sistema: {version}. Sirve para comprobar que lo último ya está publicado.</p>
      </main>
    </>
  );
}
