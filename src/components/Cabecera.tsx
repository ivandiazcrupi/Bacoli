import Link from "next/link";
import type { Usuario } from "@prisma/client";
import { db } from "@/lib/db";
import { esPersonalDeOficina, puedeGestionarUsuarios } from "@/lib/roles";
import { salir } from "@/app/actions";

// PC: a la izquierda la marca, en el centro el menú (lo importante grande, el resto más discreto) y a la derecha los botones
// para cargar pedido / cliente. Celular: marca + "Salir" arriba, botones de carga y el menú en una fila que se desliza.
export async function Cabecera({ usuario }: { usuario: Usuario }) {
  const oficina = esPersonalDeOficina(usuario.rol);
  // Para los dueños: punto rojo en EMPRESA si hace más de un día que no se descarga una copia de seguridad.
  let copiaVencida = false;
  if (usuario.rol === "DUENO") {
    const e = await db.empresa.findUnique({ where: { id: "principal" }, select: { ultimaCopia: true } });
    copiaVencida = !e?.ultimaCopia || Date.now() - e.ultimaCopia.getTime() > 24 * 3600 * 1000;
  }
  const principal = "shrink-0 rounded-lg px-2 py-2 text-base font-bold uppercase tracking-wide";
  const secundario = "shrink-0 rounded-lg px-1.5 py-2 text-xs font-medium uppercase tracking-wide text-stone-500 hover:text-stone-900";
  const botonCargar = "rounded-lg px-3 py-2 text-center text-xs font-bold uppercase tracking-wide";
  const acciones = oficina && (
    <>
      <Link href="/pedidos/nuevo" className={`${botonCargar} bg-verde-700 text-white hover:bg-verde-800`}>Cargar pedido</Link>
      <Link href="/clientes/nuevo" className={`${botonCargar} bg-verde-700 text-white hover:bg-verde-800`}>Cargar cliente</Link>
    </>
  );
  return (
    <header className="border-b border-stone-300 bg-white print:hidden">
      <div className="mx-auto flex max-w-[1900px] flex-wrap items-center justify-between gap-x-4 px-4 pt-2 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:py-2">
        <Link href="/" className="py-2 text-xl font-extrabold uppercase tracking-wide">
          <span className="text-verde-700">BACOLI</span> <span className="font-medium text-rojo-700">GESTIÓN</span>
        </Link>

        <nav aria-label="Menú principal" className="order-[98] -mx-4 flex w-[calc(100%+2rem)] items-center gap-3 overflow-x-auto whitespace-nowrap px-4 pb-1 lg:order-none lg:mx-0 lg:w-auto lg:justify-center lg:gap-2 lg:overflow-visible lg:px-0 lg:pb-0">
          {oficina && <Link href="/clientes" className={principal}>Clientes</Link>}
          {oficina && <Link href="/pedidos" className={principal}>Pedidos</Link>}
          {oficina && <Link href="/cuentas" className={principal}>Cuenta corriente</Link>}
          {oficina && <span aria-hidden className="mx-2 hidden h-5 w-px bg-stone-300 lg:block" />}
          {oficina && <Link href="/productos" className={secundario}>Productos</Link>}
          {puedeGestionarUsuarios(usuario.rol) && <Link href="/usuarios" className={secundario}>Usuarios</Link>}
          {puedeGestionarUsuarios(usuario.rol) && <Link href="/empresa" className={secundario}>Empresa{copiaVencida && <span title="Falta descargar la copia de seguridad de hoy" aria-label="Falta la copia de seguridad" className="ml-1 inline-block h-2 w-2 rounded-full bg-rojo-600 align-middle" />}</Link>}
          <Link href="/cuenta" className={secundario}>Mi cuenta</Link>
        </nav>

        <div className="flex items-center justify-end gap-2">
          <div className="hidden items-center gap-2 lg:flex">{acciones}</div>
          <form action={salir} className="flex items-center gap-3 text-sm">
            <button className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-medium uppercase tracking-wide">Salir</button>
          </form>
        </div>

        {oficina && <div className="order-[97] grid w-full grid-cols-2 gap-2 pb-1 lg:hidden">{acciones}</div>}
      </div>
    </header>
  );
}
