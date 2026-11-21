import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import type { Usuario } from "@prisma/client";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import type { PestañaComercial } from "../EncabezadoComercial";

// Se ve cuando alguien que no es gerente abre este apartado (por ejemplo desde un enlace guardado).
export async function PantallaBloqueada({ usuario, titulo = "Vendedores" }: { usuario: Usuario; activa?: PestañaComercial; titulo?: string; volver?: string }) {
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <h1 className="text-2xl font-bold tracking-tight">Comercial</h1>
        <div className="mx-auto mt-16 w-full max-w-md space-y-3 rounded-2xl border border-stone-200 bg-white px-8 py-10 text-center">
          <h1 className="!border-0 text-xl font-semibold">{titulo}</h1>
          <p className="text-sm text-stone-500">Este apartado lo ven solamente los gerentes.</p>
          <Link href="/comercial" className="inline-block text-sm font-semibold text-verde-800 underline">Volver a Comercial</Link>
        </div>
      </main>
    </>
  );
}
