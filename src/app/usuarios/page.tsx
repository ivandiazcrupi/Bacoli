import { esEmailSinCargar } from "@/lib/usuarios";
import { redirect } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { cabeceraTabla } from "@/components/campos";
import { db } from "@/lib/db";
import { NOMBRE_ROL, puedeGestionarUsuarios } from "@/lib/roles";
import { exigirUsuario } from "@/lib/session";
import { cambiarActivo } from "./actions";
import { CambiarClave } from "./CambiarClave";
import { FormularioUsuario } from "./FormularioUsuario";

export default async function Usuarios() {
  const actual = await exigirUsuario();
  if (!puedeGestionarUsuarios(actual.rol)) redirect("/");

  const usuarios = await db.usuario.findMany({ orderBy: { creadoEn: "asc" } });

  return (
    <>
      <Cabecera usuario={actual} />
      <main className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-6 sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
        <div className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
          <div className={`hidden gap-x-4 px-5 py-3 lg:grid ${cabeceraTabla} lg:grid-cols-[1.5fr_1.2fr_1.6fr_1fr_8rem_23rem]`}>
            <span>Nombre</span><span>Usuario</span><span>Email</span><span>Rol</span><span>Estado</span><span />
          </div>
          {usuarios.map((u) => (
            <div key={u.id} className={`grid items-center gap-x-4 gap-y-1 border-t border-stone-300 px-5 py-3 first:border-t-0 lg:grid-cols-[1.5fr_1.2fr_1.6fr_1fr_8rem_23rem] ${u.activo ? "bg-white even:bg-crema-50" : "bg-stone-100 text-stone-500"}`}>
              <span className="font-semibold">{u.nombre}</span>
              <span className="text-sm">{u.usuario}</span>
              <span className="text-sm">{esEmailSinCargar(u.email) ? <span className="text-stone-400">—</span> : u.email}</span>
              <span className="text-sm">{NOMBRE_ROL[u.rol]}</span>
              <span>{u.activo ? <span className="rounded-full bg-verde-100 px-2.5 py-0.5 text-xs font-semibold text-verde-800">Activo</span> : <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-semibold text-stone-600">Desactivado</span>}</span>
              <div className="flex flex-wrap items-start justify-end gap-2">
                <CambiarClave id={u.id} />
                {u.id !== actual.id && (
                  <form action={cambiarActivo}>
                    <input type="hidden" name="id" value={u.id} />
                    <button className="rounded-md border border-stone-400 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:border-verde-700">
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
        <FormularioUsuario />
      </main>
    </>
  );
}
