import Link from "next/link";
import type { Usuario } from "@prisma/client";
import { NOMBRE_ROL, esPersonalDeOficina, puedeGestionarUsuarios } from "@/lib/roles";
import { salir } from "@/app/actions";

// En el celular: arriba la marca y "Salir"; abajo el menú en una sola fila que se desliza de costado.
export function Cabecera({ usuario }: { usuario: Usuario }) {
  const enlace = "shrink-0 rounded-lg px-1 py-2";
  return (
    <header className="border-b border-stone-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 px-4 pt-2 sm:flex-nowrap sm:py-2">
        <Link href="/" className="py-2 text-xl font-bold">BACOLI</Link>
        <nav aria-label="Menú principal" className="order-last -mx-4 flex w-[calc(100%+2rem)] items-center gap-4 overflow-x-auto whitespace-nowrap px-4 pb-1 text-base font-medium sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:overflow-visible sm:px-0 sm:pb-0 sm:text-sm">
          {esPersonalDeOficina(usuario.rol) && <Link href="/pedidos" className={enlace}>Pedidos</Link>}
          {esPersonalDeOficina(usuario.rol) && <Link href="/clientes" className={enlace}>Clientes</Link>}
          {esPersonalDeOficina(usuario.rol) && <Link href="/precios" className={enlace}>Precios</Link>}
          {puedeGestionarUsuarios(usuario.rol) && <Link href="/usuarios" className={enlace}>Usuarios</Link>}
          {puedeGestionarUsuarios(usuario.rol) && <Link href="/empresa" className={enlace}>Empresa</Link>}
          <Link href="/cuenta" className={`${enlace} sm:hidden`}>Mi cuenta</Link>
        </nav>
        <form action={salir} className="flex items-center gap-3 text-sm">
          <Link href="/cuenta" className="hidden text-stone-600 underline-offset-2 hover:underline sm:inline">
            {usuario.nombre} · {NOMBRE_ROL[usuario.rol]}
          </Link>
          <button className="rounded-lg border border-stone-300 px-3 py-2">Salir</button>
        </form>
      </div>
    </header>
  );
}
