import { Cabecera } from "@/components/Cabecera";
import type { Usuario } from "@prisma/client";
import { hayClaveVendedores } from "@/lib/claveVendedores";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { EncabezadoComercial } from "../EncabezadoComercial";
import { FormClave } from "./Formularios";

// Pantalla de la contraseña: se ve cuando todavía no se entró al apartado Vendedores.
export async function PantallaBloqueada({ usuario }: { usuario: Usuario }) {
  const hay = await hayClaveVendedores();
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoComercial activa="vendedores" verVendedores />
        <div className="mx-auto mt-16 w-full max-w-md space-y-6 rounded-2xl border border-stone-200 bg-white px-8 py-10 text-center">
          <div>
            <h1 className="text-xl font-semibold">Vendedores</h1>
            <p className="mt-1 text-sm text-stone-500">{hay ? "Ingresá la contraseña para ver este apartado." : "Este apartado se abre con una contraseña."}</p>
          </div>
          <FormClave hayClave={hay} esDueno={usuario.rol === "DUENO"} />
        </div>
      </main>
    </>
  );
}
