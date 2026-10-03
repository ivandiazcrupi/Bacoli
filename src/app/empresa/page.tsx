import { redirect } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/session";
import { FormularioEmpresa } from "./FormularioEmpresa";

export default async function Empresa() {
  const usuario = await exigirUsuario();
  if (usuario.rol !== "DUENO") redirect("/");
  const [empresa, contador] = await Promise.all([db.empresa.findUnique({ where: { id: "principal" } }), db.numerador.findUnique({ where: { id: "REMITO" } })]);
  const ultima = empresa?.ultimaCopia ?? null;
  const vencida = !ultima || Date.now() - ultima.getTime() > 24 * 3600 * 1000;
  const version = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-6 sm:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Datos de la empresa</h1>
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
        <section className="rounded-xl border border-stone-300 bg-white p-5 shadow-sm" aria-label="Copia de seguridad">
          <h2 className="text-lg font-bold">Copia de seguridad</h2>
          <p className="mt-1 text-sm text-stone-600">Un archivo con todos los datos del sistema (clientes, pedidos, cuentas, precios…). Guardalo en tu Drive o en tu computadora. <b>Bajala todos los días al terminar la jornada.</b></p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <a href="/api/copia" className="rounded-lg bg-verde-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-verde-800">Descargar copia ahora</a>
            {ultima ? (
              <p className={`text-sm ${vencida ? "font-semibold text-rojo-700" : "text-stone-600"}`}>
                Última copia: {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(ultima)} · {empresa?.ultimaCopiaPor}{vencida ? " · hace más de un día" : ""}
              </p>
            ) : (
              <p className="text-sm font-semibold text-rojo-700">Todavía no se descargó ninguna copia.</p>
            )}
          </div>
        </section>
        <p className="text-xs text-stone-500">Versión del sistema: {version}. Sirve para comprobar que lo último ya está publicado.</p>
      </main>
    </>
  );
}
