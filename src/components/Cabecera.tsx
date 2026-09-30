import Link from "next/link";
import type { Usuario } from "@prisma/client";
import { NOMBRE_ROL, esPersonalDeOficina, puedeGestionarUsuarios } from "@/lib/roles";
import { salir } from "@/app/actions";

export function Cabecera({ usuario }: { usuario: Usuario }) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 whitespace-nowrap text-sm font-medium">
          <Link href="/" className="text-lg font-bold">BACOLI</Link>
          {esPersonalDeOficina(usuario.rol) && <Link href="/clientes">Clientes</Link>}
          {esPersonalDeOficina(usuario.rol) && <Link href="/marcas">Marcas</Link>}
          {esPersonalDeOficina(usuario.rol) && <Link href="/precios">Precios</Link>}
          {puedeGestionarUsuarios(usuario.rol) && <Link href="/usuarios">Usuarios</Link>}
        </nav>
        <form action={salir} className="flex items-center gap-3 text-sm">
          <Link href="/cuenta" className="hidden text-stone-600 underline-offset-2 hover:underline sm:inline">
            {usuario.nombre} · {NOMBRE_ROL[usuario.rol]}
          </Link>
          <Link href="/cuenta" className="whitespace-nowrap sm:hidden">Mi cuenta</Link>
          <button className="rounded-lg border border-stone-300 px-3 py-2">Salir</button>
        </form>
      </div>
    </header>
  );
}
