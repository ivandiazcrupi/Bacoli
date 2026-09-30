import { redirect } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { NOMBRE_ROL, puedeGestionarUsuarios } from "@/lib/roles";
import { exigirUsuario } from "@/lib/session";
import { cambiarActivo } from "./actions";
import { FormularioUsuario } from "./FormularioUsuario";

export default async function Usuarios() {
  const actual = await exigirUsuario();
  if (!puedeGestionarUsuarios(actual.rol)) redirect("/");

  const usuarios = await db.usuario.findMany({ orderBy: { creadoEn: "asc" } });

  return (
    <>
      <Cabecera usuario={actual} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {usuarios.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 p-4">
              <div className={u.activo ? "" : "opacity-50"}>
                <p className="font-medium">{u.nombre}</p>
                <p className="text-sm text-stone-600">
                  {u.email} · {NOMBRE_ROL[u.rol]}
                  {!u.activo && " · desactivado"}
                </p>
              </div>
              {u.id !== actual.id && (
                <form action={cambiarActivo}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
                    {u.activo ? "Desactivar" : "Activar"}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <FormularioUsuario />
      </main>
    </>
  );
}
